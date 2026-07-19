/**
 * Maestro HQ server — Run real (sem digitar bernstein na mão)
 *
 *   node maestro/server.mjs
 *   http://127.0.0.1:8799
 *
 * POST /api/run  { goal, executor?, playerId?, maxTurns? }
 * GET  /api/status
 * GET  /api/events   (SSE log stream)
 * GET  /api/roster
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
// buildSpawn = matriz única de executores; sanitizers com fonte única em adapters.mjs.
import {
  appendPrivateFile,
  cleanupExternalizedPrompts,
  isNoiseLine,
  makeRedactor,
  openPrivateFile,
  stripAnsi,
  writePrivateFile,
} from "./adapters.mjs";
import { createEngineManager } from "./engine.mjs";
import { buildControlSnapshot } from "./control/snapshot.mjs";
import { createOperationStore } from "./control/store.mjs";
import { createAuditLog } from "./control/audit.mjs";
import { createConfirmationManager } from "./control/confirmations.mjs";
import { ControlError, createControlDispatcher } from "./control/dispatcher.mjs";
import { createEngineActionHandlers } from "./control/handlers.mjs";
import { createFactoryAdmin } from "./control/factory-admin.mjs";
import { createLifecycleManager } from "./control/lifecycle.mjs";
import { createAlwaysOnDeployManager } from "./control/always-on-deploy.mjs";
import { createMemoryActionHandlers } from "./memory/control.mjs";
import { createMemoryService, createUnavailableMemoryService } from "./memory/service.mjs";
import { createRunEventStore } from "./control/run-events.mjs";
import { createForgeOperator } from "./operator.mjs";
import { createDiscoveryWorkspace } from "./discovery/workspace.mjs";
import { buildCanonicalBrief } from "./discovery/context.mjs";
import { createExecutorRunService } from "./executor-run-service.mjs";
import { createPlaybookService } from "./discovery/playbooks.mjs";
import { runtimeSourceFingerprint } from "./runtime-version.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.MAESTRO_PORT || 8799);
const SERVER_STARTED_AT = new Date().toISOString();
const SOURCE_FINGERPRINT = runtimeSourceFingerprint(ROOT);
const ROSTER_PATH = path.join(__dirname, "roster.json");

// Token por instalação: bloqueia CSRF de sites no browser contra o loopback.
// UI (same-origin) pega via GET /api/token; forge.mjs lê o arquivo direto.
const TOKEN_PATH = path.join(__dirname, ".token");
if (!fs.existsSync(TOKEN_PATH)) {
  fs.writeFileSync(TOKEN_PATH, crypto.randomBytes(24).toString("hex"), { mode: 0o600 });
}
const API_TOKEN = fs.readFileSync(TOKEN_PATH, "utf8").trim();
const redactLog = makeRedactor();

function checkToken(req) {
  const got = String(req.headers["x-maestro-token"] || "");
  const a = Buffer.from(got);
  const b = Buffer.from(API_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** true se dentro de base (boundary com separador — evita prefixo tipo out-secret) */
function insideDir(base, candidate) {
  const resolved = path.resolve(candidate);
  return resolved === base || resolved.startsWith(base + path.sep);
}

/** @type {{ status: string, executor: string|null, goal: string|null, startedAt: string|null, endedAt: string|null, exitCode: number|null, logs: string[], pid: number|null }} */
const state = {
  status: "idle", // idle | running | done | error
  executor: null,
  goal: null,
  startedAt: null,
  endedAt: null,
  exitCode: null,
  logs: [],
  pid: null,
};

/** @type {Set<import('node:http').ServerResponse>} */
const sseClients = new Set();
function log(line, metadata = {}, runEvents = null) {
  let msg = redactLog(stripAnsi(typeof line === "string" ? line : String(line))).trimEnd();
  // strip accidental "stderr: " prefix noise labels we no longer want for clean TUI
  if (msg.startsWith("stderr: ")) {
    const rest = msg.slice(8);
    if (isNoiseLine(rest)) return;
    // only keep stderr if it looks like a real error/message
    if (!/(error|fail|denied|unexpected|ENOENT|cannot|invalid|✗)/i.test(rest) && rest.length < 20) {
      return;
    }
    msg = rest;
  }
  if (
    isNoiseLine(msg) &&
    !/^\[?\d{2}:\d{2}/.test(msg) &&
    !msg.startsWith("▶") &&
    !msg.startsWith("✓") &&
    !msg.startsWith("✗") &&
    !msg.startsWith("■") &&
    !msg.startsWith("$")
  ) {
    return;
  }
  const stamp = new Date().toISOString().slice(11, 19);
  const entry = `[${stamp}] ${msg}`;
  state.logs.push(entry);
  if (state.logs.length > 2000) state.logs.shift();
  let event = { type: "log", line: entry };
  if (runEvents) {
    try {
      event = runEvents.append({ ...metadata, line: entry });
    } catch (error) {
      console.error(`run event descartado: ${error instanceof Error ? error.message : error}`);
    }
  }
  const data = `${event.sequence ? `id: ${event.sequence}\n` : ""}data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try {
      const filter = res.maestroEventFilter || {};
      if (event.type === "run_event" && filter.appId && event.appId !== filter.appId) continue;
      if (event.type === "run_event" && filter.runId && event.runId !== filter.runId) continue;
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
  console.log(entry);
}

function broadcastStatus() {
  const payload = {
    type: "status",
    status: state.status,
    executor: state.executor,
    goal: state.goal,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    exitCode: state.exitCode,
    pid: state.pid,
  };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

function readRoster() {
  return JSON.parse(fs.readFileSync(ROSTER_PATH, "utf8"));
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".ico")) return "image/x-icon";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

// ---------- Forge autopilot (pipeline engine) ----------

// multi-pipeline: o evento SSE "pipeline" carrega o MAPA { [appId]: snapshot }
function broadcastPipeline(snapMap) {
  const data = `data: ${JSON.stringify({ type: "pipeline", pipeline: snapMap })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  // sem Access-Control-Allow-Origin: UI é same-origin; CLI não é browser.
  // Cross-origin não lê respostas nem manda o header custom (preflight morre aqui).
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function sendControlError(res, error) {
  if (error instanceof ControlError) {
    sendJson(res, error.status, {
      ok: false,
      code: error.code,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  sendJson(res, 500, {
    ok: false,
    code: "control_internal",
    error: error instanceof Error ? error.message : String(error),
  });
}

const MAX_BODY_BYTES = 5 * 1024 * 1024; // protege o processo de OOM

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        // pausar stream para não consumir mais dados antes de rejeitar
        req.pause();
        const err = new Error("body excede o limite de 5 MB");
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// stream com guarda: arquivo pode sumir no meio (apps/out é reescrito por builds)
function streamFile(res, filePath, type) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    } else {
      res.destroy(); // headers já foram: derruba a conexão p/ sinalizar truncamento
    }
  });
  res.writeHead(200, { "Content-Type": type });
  stream.pipe(res);
}

export function createMaestroServer({
  root = ROOT,
  host = "127.0.0.1",
  port = PORT,
  engineManager,
  operationStore,
  memoryService,
  discoveryWorkspace,
  alwaysOnDeployManager,
  spawnImpl = spawn,
} = {}) {
  const runEvents = createRunEventStore({ root, redact: redactLog });
  let memory = memoryService;
  if (!memory) {
    try {
      memory = createMemoryService({ root });
    } catch (error) {
      memory = createUnavailableMemoryService(error);
    }
  }
  const engine =
    engineManager ||
    createEngineManager({
      root,
      emitLog: (line, metadata = {}) => log(line, metadata, runEvents),
      emitPipeline: broadcastPipeline,
      memory,
    });
  const operations = operationStore || createOperationStore({ root });
  const discovery = discoveryWorkspace || createDiscoveryWorkspace({ root, engineManager: engine });
  const factoryAdmin = createFactoryAdmin({ root, spawnImpl });
  const lifecycleManager = createLifecycleManager({ root, engineManager: engine, discoveryWorkspace: discovery });
  const alwaysOn = alwaysOnDeployManager || createAlwaysOnDeployManager({ root });
  const chatRuns = new Map();
  const legacyRunFiles = new Map();
  const rosterPath = path.join(root, "maestro", "roster.json");
  const rosterPlayers = () => JSON.parse(fs.readFileSync(rosterPath, "utf8")).players || [];
  const resolvePlayerId = ({ playerId, executor } = {}) => {
    const players = rosterPlayers();
    if (playerId) return playerId;
    if (executor) {
      const wanted = String(executor).toLowerCase();
      return players.find(player => [player.id, player.adapter, player.cli].filter(Boolean).map(String).map(value => value.toLowerCase()).includes(wanted))?.id
        || `unknown-executor:${wanted}`;
    }
    return players.find(player => [player.id, player.adapter, player.cli].some(value => String(value || "").toLowerCase() === "grok"))?.id
      || players[0]?.id
      || null;
  };
  const emitChatEvent = (payload) => {
    const event = runEvents.append({ runId: payload.runId, eventType: payload.type, line: JSON.stringify(payload) });
    const data = `id: ${event.sequence}\ndata: ${JSON.stringify({ ...payload, sequence: event.sequence })}\n\n`;
    for (const client of sseClients) {
      const filter = client.maestroEventFilter || {};
      if (filter.runId && filter.runId !== payload.runId) continue;
      try { client.write(data); } catch { sseClients.delete(client); }
    }
  };
  let playbookService;
  const runner = createExecutorRunService({
    root,
    rosterPath,
    spawnImpl,
    emit(type, payload) {
      if (type === "run.started") {
        state.status = "running";
        state.executor = payload.executor;
        state.startedAt = payload.startedAt;
        state.endedAt = null;
        state.exitCode = null;
        state.pid = payload.pid;
        state.logs = [];
        broadcastStatus();
        return;
      }
      const metadata = chatRuns.get(payload.runId);
      if (type === "run.chunk") {
        if (payload.scope?.kind === "playbook" && payload.scope.localRunId && playbookService) {
          playbookService.appendRawLog({ localRunId: payload.scope.localRunId, text: payload.text });
        }
        if (payload.scope === "legacy") {
          const legacy = legacyRunFiles.get(payload.runId);
          if (legacy) appendPrivateFile(legacy.rawLogPath, payload.text);
        }
        state.logs.push(`[${new Date().toISOString().slice(11, 19)}] ${payload.text}`);
        if (state.logs.length > 2000) state.logs.splice(0, state.logs.length - 2000);
        if (metadata) emitChatEvent({ type: "chat.chunk", runId: payload.runId, roomId: metadata.roomId, playerId: payload.playerId, stream: payload.stream, text: payload.text });
        return;
      }
      if (type === "run.finished") {
        state.status = payload.status === "done" ? "done" : "error";
        state.endedAt = payload.endedAt;
        state.exitCode = payload.exitCode;
        state.pid = null;
        broadcastStatus();
        finishLegacyRun(payload.runId, payload.exitCode);
        if (!metadata) return;
        const player = rosterPlayers().find(candidate => candidate.id === metadata.playerId) || {};
        const text = payload.status === "done"
          ? (payload.response || "Resposta concluída sem conteúdo.")
          : `Falha auditável (${payload.status}): ${payload.error || "erro desconhecido"}${payload.response ? `\nParcial: ${payload.response}` : ""}`;
        discovery.appendMessage({ roomId: metadata.roomId, author: "assistant", text, executor: { playerId: metadata.playerId, provider: player.adapter || player.cli || null, model: player.model || null }, refs: [payload.runId] });
        emitChatEvent({ type: "chat.finished", runId: payload.runId, roomId: metadata.roomId, playerId: metadata.playerId, status: payload.status });
        chatRuns.delete(payload.runId);
      }
    },
  });
  playbookService = createPlaybookService({ root, runner, workspace: discovery });
  const chatController = {
    send(input) {
      const room = discovery.getRoom(input.roomId);
      discovery.appendMessage({ roomId: room.id, author: "human", text: input.text, executor: null, refs: [] });
      const snapshot = discovery.snapshot();
      const candidates = snapshot.theses.filter(thesis => thesis.roomId === room.id);
      const thesis = [...candidates].reverse().find(item => ["confirmed", "validating"].includes(item.stage)) || candidates.at(-1) || null;
      const prompt = buildCanonicalBrief({
        room: discovery.getRoom(room.id),
        thesis,
        evidence: thesis ? snapshot.evidence.filter(item => item.thesisId === thesis.id) : [],
        experiments: thesis ? snapshot.experiments.filter(item => item.thesisId === thesis.id) : [],
        maxBytes: 32_000,
      });
      const playerId = resolvePlayerId(input);
      const result = runner.start({ scope: { kind: "chat", roomId: room.id }, playerId, prompt, maxTurns: input.maxTurns, resumeToken: input.resumeToken });
      if (!result.ok) {
        discovery.appendMessage({ roomId: room.id, author: "system", text: `Falha auditável ao iniciar chat: ${result.error}`, executor: { playerId }, refs: [] });
        return { ...result, roomId: room.id, playerId };
      }
      chatRuns.set(result.runId, { roomId: room.id, playerId });
      return { ...result, roomId: room.id };
    },
    stop(input) { return runner.stop(input); },
  };
  const runFactory = (goal, options = {}) => {
    state.goal = String(goal || "");
    const playerId = resolvePlayerId(options);
    const runRoot = root;
    const runDir = path.join(root, "maestro", "runs", `adhoc-${Date.now()}-${crypto.randomUUID()}`);
    fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
    const goalFile = path.join(runDir, "goal.txt");
    const rawLogPath = path.join(runDir, "raw.log");
    writePrivateFile(goalFile, String(goal || ""));
    const rawFd = openPrivateFile(rawLogPath);
    fs.closeSync(rawFd);
    const result = runner.start({ scope: "legacy", playerId, prompt: goal, maxTurns: options.maxTurns, resumeToken: options.resumeToken });
    if (result.ok) legacyRunFiles.set(result.runId, { runRoot, goalFile, rawLogPath });
    return result.ok ? { ...result, rawLog: path.relative(runRoot, rawLogPath) } : result;
  };
  function finishLegacyRun(runId, code) {
    const legacy = legacyRunFiles.get(runId);
    if (!legacy) return;
    const { runRoot } = legacy;
    if (code === 0) cleanupExternalizedPrompts(runRoot);
    legacyRunFiles.delete(runId);
  }
  const forgeOperator = createForgeOperator({
    root,
    factoryAdmin,
    engineManager: engine,
    discoveryWorkspace: discovery,
    runFactory,
  });
  const audit = createAuditLog({ root });
  const confirmations = createConfirmationManager();
  const controlSnapshot = () =>
    buildControlSnapshot({
      root,
      engineManager: engine,
      operations: operations.list(),
      providerHealth: factoryAdmin.listProviders(),
      server: { host, port, pid: process.pid, startedAt: SERVER_STARTED_AT, sourceFingerprint: SOURCE_FINGERPRINT },
      memory,
      discoveryWorkspace: discovery,
      runner: runner.snapshot(),
      alwaysOnDeployments: alwaysOn.list(),
    });
  const control = createControlDispatcher({
    getSnapshot: controlSnapshot,
    operations,
    audit,
    confirmations,
    handlers: {
      ...createEngineActionHandlers({ root, engineManager: engine, factoryAdmin, lifecycleManager, alwaysOnDeployManager: alwaysOn, forgeOperator, discoveryWorkspace: discovery, chatController, playbookService }),
      ...createMemoryActionHandlers(memory),
    },
    emitEvent: (type, payload) => {
      const result = payload?.result || {};
      const projected = {
        type,
        operationId: payload?.id || null,
        actionId: payload?.actionId || null,
        status: payload?.status || null,
        appId: payload?.appId || null,
        roomId: result.roomId || (payload?.actionId?.startsWith("room.") ? result.id : null),
        thesisId: result.thesisId || (payload?.actionId?.startsWith("thesis.") ? result.id : null),
      };
      const event = runEvents.append({
        runId: "control",
        eventType: "operation",
        line: JSON.stringify(projected),
      });
      const data = `id: ${event.sequence}\ndata: ${JSON.stringify({ ...projected, sequence: event.sequence })}\n\n`;
      for (const client of sseClients) {
        const filter = client.maestroEventFilter || {};
        if (filter.runId && filter.runId !== "control") continue;
        if (filter.appId && filter.appId !== projected.appId) continue;
        try {
          client.write(data);
        } catch {
          sseClients.delete(client);
        }
      }
    },
  });

  const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    // sem headers CORS de propósito: preflight cross-origin morre aqui
    res.writeHead(204);
    res.end();
    return;
  }

  // anti DNS-rebinding: só aceita Host loopback
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(req.headers.host || "")) {
    res.writeHead(403);
    res.end("Forbidden host");
    return;
  }

  // toda mutação e leitura privada de discovery exigem o token por instalação.
  const privateDiscoveryRead = method === "GET" && url.pathname.startsWith("/api/discovery/");
  if (((method === "POST" && url.pathname.startsWith("/api/")) || privateDiscoveryRead) && !checkToken(req)) {
    sendJson(res, 401, { ok: false, error: "X-Maestro-Token ausente/inválido — leia maestro/.token" });
    return;
  }

  if (url.pathname === "/api/token" && method === "GET") {
    // legível só same-origin (sem CORS, sites externos recebem resposta opaca)
    sendJson(res, 200, { token: API_TOKEN });
    return;
  }

  // API
  if (url.pathname === "/api/status") {
    sendJson(res, 200, {
      status: state.status,
      executor: state.executor,
      goal: state.goal,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      exitCode: state.exitCode,
      pid: state.pid,
      logCount: state.logs.length,
      recentLogs: state.logs.slice(-40),
    });
    return;
  }

  if (url.pathname === "/api/control/snapshot" && method === "GET") {
    try {
      sendJson(res, 200, controlSnapshot());
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `control_snapshot_failed: ${error instanceof Error ? error.message : String(error)}` });
    }
    return;
  }

  const discoveryRead = url.pathname.match(/^\/api\/discovery\/(rooms|theses)\/([A-Za-z0-9_-]+)$/);
  if (discoveryRead && method === "GET") {
    try {
      let value;
      if (discoveryRead[1] === "rooms") {
        value = discovery.getRoom(discoveryRead[2]);
      } else {
        const thesis = discovery.getThesis(discoveryRead[2]);
        const discoveryState = discovery.snapshot?.() || {};
        value = {
          ...thesis,
          gates: discovery.gatesFor?.(thesis.id) || {},
          build: discoveryState.builds?.find(item => item.id === thesis.buildId) || null,
          experiment: [...(discoveryState.experiments || [])].reverse().find(item => item.thesisId === thesis.id) || null,
          acquisition: discoveryState.acquisitions?.find(item => item.id === thesis.acquisitionId) || null,
        };
      }
      const redactDiscovery = makeRedactor();
      sendJson(res, 200, JSON.parse(redactDiscovery(JSON.stringify(value))));
    } catch (error) {
      sendJson(res, 404, { ok: false, error: redactLog(error instanceof Error ? error.message : String(error)) });
    }
    return;
  }

  const sendMemoryError = (error) => {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    sendJson(res, status, {
      ok: false,
      error: redactLog(error instanceof Error ? error.message : String(error)),
    });
  };
  const memoryAppId = (project) => {
    if (project === "factory") return null;
    const match = /^app-([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)$/.exec(project || "");
    if (!match) throw Object.assign(new Error("project de memória inválido."), { status: 400 });
    return match[1];
  };

  if (url.pathname === "/api/memory/status" && method === "GET") {
    sendJson(res, 200, memory.status());
    return;
  }

  if (url.pathname === "/api/memory/overview" && method === "GET") {
    try {
      sendJson(res, 200, await memory.overview({ appId: memoryAppId(url.searchParams.get("project")), limit: 10 }));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  if (url.pathname === "/api/memory/search" && method === "GET") {
    try {
      const q = url.searchParams.get("q") || "";
      if (!q.trim() || q.length > 500) throw Object.assign(new Error("q de memória inválido."), { status: 400 });
      sendJson(res, 200, await memory.search({ q, appId: memoryAppId(url.searchParams.get("project")), limit: 20 }));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  if (url.pathname === "/api/memory/briefing" && method === "GET") {
    try {
      sendJson(res, 200, await memory.briefing({ appId: memoryAppId(url.searchParams.get("project")), limit: 8 }));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  const memoryPagePrefix = "/api/memory/pages/";
  if (url.pathname.startsWith(memoryPagePrefix) && method === "GET") {
    try {
      const rest = url.pathname.slice(memoryPagePrefix.length);
      const slash = rest.indexOf("/");
      if (slash < 1) throw Object.assign(new Error("Página de memória inválida."), { status: 400 });
      const project = decodeURIComponent(rest.slice(0, slash));
      const pagePath = decodeURIComponent(rest.slice(slash + 1));
      if (
        !pagePath
        || pagePath.includes("\\")
        || pagePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
      ) {
        throw Object.assign(new Error("Path de memória inválido."), { status: 400 });
      }
      sendJson(res, 200, await memory.readPage({ appId: memoryAppId(project), pagePath }));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  if (url.pathname === "/api/memory/import/preview" && method === "POST") {
    try {
      sendJson(res, 200, await memory.importPreview(await readBody(req)));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  if (url.pathname === "/api/memory/import/apply" && method === "POST") {
    try {
      sendJson(res, 200, await memory.importApply(await readBody(req)));
    } catch (error) {
      sendMemoryError(error);
    }
    return;
  }

  if (url.pathname === "/api/control/confirmations" && method === "POST") {
    try {
      sendJson(res, 201, control.issueConfirmation(await readBody(req)));
    } catch (error) {
      sendControlError(res, error);
    }
    return;
  }

  if (url.pathname === "/api/control/actions/execute" && method === "POST") {
    try {
      sendJson(res, 200, await control.execute(await readBody(req)));
    } catch (error) {
      sendControlError(res, error);
    }
    return;
  }

  if (url.pathname.startsWith("/api/control/operations/") && method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/control/operations/".length));
    const operation = /^[a-zA-Z0-9_-]+$/.test(id) ? control.getOperation(id) : null;
    sendJson(
      res,
      operation ? 200 : 404,
      operation || { ok: false, code: "operation_not_found", error: "Operação não encontrada." },
    );
    return;
  }

  if (url.pathname === "/api/roster") {
    try {
      sendJson(res, 200, readRoster());
    } catch (e) {
      sendJson(res, 500, { error: String(e) });
    }
    return;
  }

  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const after = Number(url.searchParams.get("after") || req.headers["last-event-id"] || 0);
    const appId = url.searchParams.get("appId") || null;
    const runId = url.searchParams.get("runId") || null;
    res.maestroEventFilter = { appId, runId };
    const replay = runEvents.list({ after, appId, runId, limit: 500 });
    let initial = `data: ${JSON.stringify({ type: "hello", status: state.status })}\n\n`;
    if (replay.length) {
      for (const event of replay) {
        if (event.runId === "control" && event.eventType === "operation") {
          try {
            const projected = JSON.parse(event.line);
            initial += `id: ${event.sequence}\ndata: ${JSON.stringify({ ...projected, sequence: event.sequence })}\n\n`;
          } catch {
            // Evento control inválido não é exposto.
          }
        } else {
          initial += `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
        }
      }
    } else if (!after && !appId && !runId) {
      for (const line of state.logs.slice(-80)) {
        initial += `data: ${JSON.stringify({ type: "log", line })}\n\n`;
      }
    }
    res.write(initial);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (url.pathname === "/api/run" && method === "POST") {
    try {
      const body = await readBody(req);
      const result = runFactory(body.goal || body.prompt || "", {
        executor: body.executor,
        playerId: body.playerId,
        maxTurns: body.maxTurns,
        resumeToken: body.resumeToken,
      });
      sendJson(res, result.ok ? 200 : 409, result);
    } catch (e) {
      const status = Number.isInteger(e?.status) ? e.status : 400;
      sendJson(res, status, { ok: false, error: String(e) });
    }
    return;
  }

  if (url.pathname === "/api/stop" && method === "POST") {
    const activeRunId = runner.snapshot().activeRunId;
    sendJson(res, 200, activeRunId ? runner.stop({ runId: activeRunId }) : { ok: false, error: "Nenhuma run ativa" });
    return;
  }

  // ---------- Forge autopilot ----------

  if (url.pathname === "/api/pipeline" && method === "GET") {
    // mapa { [appId]: snapshot }; ?app=<id> devolve o snapshot individual
    const app = url.searchParams.get("app");
    sendJson(res, 200, app ? engine.snapshotFor(app) : engine.snapshot());
    return;
  }

  if (url.pathname.startsWith("/api/pipeline/") && method === "POST") {
    try {
      const body = await readBody(req);
      const action = url.pathname.split("/").pop();
      if (action === "start") {
        sendJson(res, 409, { ok: false, error: "Novos produtos exigem discovery.build.start." });
      } else if (action === "feedback") {
        sendJson(res, 200, { ok: true, pipeline: engine.startFeedback({ ...body, controlMode: body.controlMode || "full_auto" }) });
      } else if (action === "decide") {
        sendJson(res, 200, { ok: true, pipeline: engine.decide(body.appId, body.gateId, body.choice, body.feedback) });
      } else if (action === "stop") {
        sendJson(res, 200, engine.stop(body.appId));
      } else if (action === "resume") {
        sendJson(res, 200, { ok: true, pipeline: engine.resume(body.appId) });
      } else if (action === "shutdown") {
        // usado por `forge restart` (que recarrega o código do maestro). O CLI sobe o server de novo.
        const running = Object.values(engine.snapshot()).filter((p) => p && p.status === "running");
        if (running.length && !body.force) {
          sendJson(res, 409, {
            ok: false,
            error: `job vivo em ${running.map((p) => `${p.appId}/${p.currentJob}`).join(", ")} — espere o gate ou use --force (perde o job em andamento)`,
          });
          return;
        }
        sendJson(res, 200, { ok: true, killed: running.map((p) => p.appId) });
        setTimeout(async () => {
          try {
            await memory.close?.();
          } finally {
            process.exit(0);
          }
        }, 50);
      } else if (action === "target") {
        sendJson(res, 200, engine.setTarget(body.appId, body.target, body.subdomain));
      } else if (action === "kill") {
        sendJson(res, 200, engine.kill(body.appId));
      } else if (action === "remove") {
        sendJson(res, 200, engine.removeApp(body.appId, { force: !!body.force }));
      } else {
        sendJson(res, 404, { ok: false, error: `ação desconhecida: ${action}` });
      }
    } catch (e) {
      const status = Number.isInteger(e?.status) ? e.status : 409;
      sendJson(res, status, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  // Assets do Next export referenciam a raiz (/_next/*): resolve no out/ dos apps
  // (necessário pro /preview/<app>/ funcionar — gate visual da pipeline)
  if (url.pathname.startsWith("/_next/") || url.pathname === "/favicon.ico") {
    const appsDir = path.join(root, "apps");
    try {
      for (const app of fs.readdirSync(appsDir)) {
        if (!/^[a-z0-9-]+$/.test(app)) continue;
        const candidate = path.resolve(appsDir, app, "out", "." + url.pathname);
        if (!insideDir(path.join(appsDir, app, "out"), candidate)) continue;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          streamFile(res, candidate, contentType(candidate));
          return;
        }
      }
    } catch {}
    res.writeHead(404);
    res.end();
    return;
  }

  // Templates do kit IG (marketing/ig-kit): /ig-kit/<arquivo>?params
  if (url.pathname.startsWith("/ig-kit/")) {
    const kitDir = path.join(root, "marketing", "ig-kit");
    const f = path.resolve(kitDir, "." + url.pathname.slice("/ig-kit".length));
    if (insideDir(kitDir, f) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      streamFile(res, f, contentType(f));
      return;
    }
    res.writeHead(404);
    res.end();
    return;
  }

  // docs/ read-only (cockpit renderiza scorecard/system-design/design-system nos gates)
  if (url.pathname.startsWith("/docs/")) {
    const docsDir = path.join(root, "docs");
    const f = path.resolve(docsDir, "." + url.pathname.slice("/docs".length));
    if (insideDir(docsDir, f) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      streamFile(res, f, contentType(f));
      return;
    }
    res.writeHead(404);
    res.end("doc não encontrado");
    return;
  }

  // Docs de run do app (repo-por-app): /apps/<app>/docs/<file>.md|.html — read-only p/ os gates
  if (/^\/apps\/[a-z0-9-]+\/docs\//.test(url.pathname)) {
    const appsDir = path.join(root, "apps");
    const f = path.resolve(root, "." + url.pathname);
    if (insideDir(appsDir, f) && /\.(md|html)$/i.test(f) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      streamFile(res, f, contentType(f));
      return;
    }
    res.writeHead(404);
    res.end("doc do app não encontrado");
    return;
  }

  // Propostas do DS-GEN (gate ds-pick): /proposals/<app>/proposal-N.html — vivem sob maestro/, não ROOT
  if (url.pathname.startsWith("/proposals/")) {
    const propDir = path.join(__dirname, "proposals");
    const f = path.resolve(propDir, "." + url.pathname.slice("/proposals".length));
    if (insideDir(propDir, f) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      streamFile(res, f, contentType(f));
      return;
    }
    res.writeHead(404);
    res.end("proposta não encontrada");
    return;
  }

  // Preview estático do app buildado (gate visual pós-B3): /preview/<appId>/...
  if (url.pathname.startsWith("/preview/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const appId = parts[1] || "";
    if (!/^[a-z0-9-]+$/.test(appId)) {
      res.writeHead(400);
      res.end("app id inválido");
      return;
    }
    const outDir = path.join(root, "apps", appId, "out");
    const relPath = parts.slice(2).join("/") || "index.html";
    let f = path.resolve(outDir, relPath);
    if (relPath.split(/[\\/]/).includes("..") || !insideDir(outDir, f)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f) && fs.existsSync(`${f}.html`)) f = `${f}.html`;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      streamFile(res, f, contentType(f));
      return;
    }
    res.writeHead(404);
    res.end("preview não buildado — rode o build do app primeiro");
    return;
  }

  // static from maestro/
  let rel = url.pathname === "/" ? "/index.html" : url.pathname;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.resolve(__dirname, "." + path.sep + rel);
  if (!insideDir(__dirname, filePath) || path.basename(filePath) === ".token") {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    streamFile(res, filePath, contentType(filePath));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
  });

  server.on("close", () => {
    void memory.close?.();
  });
  void memory.startIfInstalled?.().catch?.(() => {});
  return server;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const server = createMaestroServer();
  server.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log(`  ◆  Forge Nexus  http://127.0.0.1:${PORT}`);
    console.log(`  Run API            POST /api/run`);
    console.log(`  Live logs          GET  /api/events (SSE)`);
    console.log(`  CWD                ${ROOT}`);
    console.log("");
  });
}
