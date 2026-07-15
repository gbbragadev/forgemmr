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
  buildSpawn,
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
import { createMemoryActionHandlers } from "./memory/control.mjs";
import { createMemoryService, createUnavailableMemoryService } from "./memory/service.mjs";
import { createRunEventStore } from "./control/run-events.mjs";
import { createForgeOperator } from "./operator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.MAESTRO_PORT || 8799);
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
/** @type {import('node:child_process').ChildProcess | null} */
let child = null;

/**
 * Buffer bytes → only emit complete lines ending in \n.
 * \r alone = TUI overwrite of current line (keep buffer, don't emit crumbs).
 */
function createStreamSanitizer(prefix = "") {
  let buf = "";
  let lastEmitted = "";
  let lastProgressAt = 0;

  return {
    push(chunk) {
      let s = stripAnsi(String(chunk));
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "\r") {
          // TUI redraw: discard current incomplete line (status spinner)
          buf = "";
          continue;
        }
        if (ch === "\n") {
          const line = buf.replace(/\s+$/, "");
          buf = "";
          if (isNoiseLine(line)) continue;
          // dedupe identical consecutive lines (spinners)
          if (line === lastEmitted) continue;
          lastEmitted = line;
          log(prefix + line);
          continue;
        }
        buf += ch;
        // hard cap buffer (don't grow forever on binary noise)
        if (buf.length > 8000) buf = buf.slice(-2000);
      }
      // Optional: throttle status line without newline (e.g. "Running… 45%")
      const soft = buf.trim();
      if (
        soft.length >= 12 &&
        /[A-Za-z]/.test(soft) &&
        !isNoiseLine(soft) &&
        soft !== lastEmitted &&
        Date.now() - lastProgressAt > 2500
      ) {
        // only if it looks like a real status sentence
        if (/\b(run|build|error|pass|fail|writing|created|done|npm|✓|✗|▶)\b/i.test(soft)) {
          lastProgressAt = Date.now();
          lastEmitted = soft;
          log(prefix + soft + " …");
          // don't clear buf — still waiting for \n
        }
      }
    },
    flush() {
      const line = buf.replace(/\s+$/, "");
      buf = "";
      if (!isNoiseLine(line) && line !== lastEmitted) {
        log(prefix + line);
      }
    },
  };
}

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

function resolveBin(name) {
  const isWin = process.platform === "win32";
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    name,
    isWin ? `${name}.exe` : name,
    path.join(home, ".grok", "bin", isWin ? "grok.exe" : "grok"),
    path.join(home, ".local", "bin", name),
  ];
  // which via PATH — spawn will resolve; prefer known grok path
  if (name === "grok" || name === "grok.exe") {
    const p = path.join(home, ".grok", "bin", isWin ? "grok.exe" : "grok");
    if (fs.existsSync(p)) return p;
  }
  return name;
}

/**
 * @param {string} goal
 * @param {{ executor?: string, playerId?: string, maxTurns?: number }} opts
 */
function startRun(goal, opts = {}, runtime = {}) {
  const runRoot = runtime.root || ROOT;
  const spawnRun = runtime.spawnImpl || spawn;
  if (state.status === "running") {
    return { ok: false, error: "Já existe uma run em andamento. Aguarde ou POST /api/stop." };
  }
  if (!goal || !String(goal).trim()) {
    return { ok: false, error: "goal vazio" };
  }

  const roster = readRoster();
  let executor = (opts.executor || "grok").toLowerCase();
  let player = null;

  if (opts.playerId) {
    player = roster.players.find((p) => p.id === opts.playerId) || null;
    if (player) executor = (player.cli || executor).toLowerCase();
  }

  // normalize
  if (executor === "grok-solo" || executor === "xai") executor = "grok";
  if (executor === "claude-code") executor = "claude";

  const maxTurns = opts.maxTurns || 30;
  const fullGoal =
    goal.trim() +
    "\n\n---\nMaestro HQ constraints:\n" +
    "- Repo: " +
    runRoot +
    "\n- Surgical / YAGNI. Gate: npm run build if code changes.\n" +
    "- Do not commit secrets. Product AI = Z.AI (ZAI_API_KEY), not coding brain.\n" +
    "- Update workbench/HANDOFF.md when done.\n";

  state.status = "running";
  state.executor = executor;
  state.goal = fullGoal;
  state.startedAt = new Date().toISOString();
  state.endedAt = null;
  state.exitCode = null;
  state.logs = [];
  state.pid = null;
  broadcastStatus();

  // Goal em arquivo — evita quebra de args no Windows/shell
  const goalFile = path.join(__dirname, ".run-goal.txt");
  try {
    writePrivateFile(goalFile, fullGoal);
  } catch (e) {
    state.status = "error";
    state.exitCode = 1;
    state.endedAt = new Date().toISOString();
    log(`✗ não escreveu goal file: ${e}`);
    broadcastStatus();
    return { ok: false, error: String(e) };
  }

  // Matriz de executores unificada em adapters.mjs (mesma da engine autopilot)
  let spec;
  try {
    spec = buildSpawn(executor, fullGoal, { root: runRoot, maxTurns });
  } catch (err) {
    state.status = "error";
    state.exitCode = 1;
    state.endedAt = new Date().toISOString();
    log(`✗ executor inválido: ${err instanceof Error ? err.message : err}`);
    broadcastStatus();
    return { ok: false, error: String(err) };
  }
  const { cmd, args } = spec;

  const runsDir = path.join(__dirname, "runs");
  fs.mkdirSync(runsDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const rawLogPath = path.join(runsDir, `${runId}-${executor}.raw.log`);
  const rawFd = openPrivateFile(rawLogPath);

  log(`▶ Run start · executor=${executor} · player=${player?.id || "—"}`);
  log(`  raw log → maestro/runs/${path.basename(rawLogPath)}`);
  log(`$ ${cmd} … [goal]`);

  const quietUi = false; // grok agora roda via -p (headless real, output limpo) — ver adapters.mjs

  try {
    child = spawnRun(cmd, args, {
      cwd: runRoot,
      env: spec.env,
      shell: false,
      windowsHide: true,
    });
  } catch (err) {
    try {
      fs.closeSync(rawFd);
    } catch {
      /* ignore */
    }
    state.status = "error";
    state.exitCode = 1;
    state.endedAt = new Date().toISOString();
    log(`✗ spawn failed: ${err instanceof Error ? err.message : err}`);
    broadcastStatus();
    return { ok: false, error: String(err) };
  }

  state.pid = child.pid ?? null;
  broadcastStatus();

  if (quietUi) {
    log("⏳ Grok trabalhando… (log limpo: só marcos + arquivos alterados)");
    log("   Dica: raw TUI completo está no .raw.log se precisar debugar");
  }

  const outSan = createStreamSanitizer("");
  const errSan = createStreamSanitizer("");
  let jsonBuf = "";

  const redact = makeRedactor();
  const onChunk = (buf, isErr) => {
    buf = redact(buf); // nunca gravar segredos em raw log
    try {
      fs.writeSync(rawFd, buf);
    } catch {
      /* ignore */
    }
    if (quietUi) {
      // Parse JSON lines if any clean line appears
      jsonBuf += String(buf);
      // keep jsonBuf bounded
      if (jsonBuf.length > 500000) jsonBuf = jsonBuf.slice(-100000);
      // try extract useful JSON events from mixed stream
      const lines = jsonBuf.split("\n");
      jsonBuf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("{")) continue;
        try {
          const ev = JSON.parse(t);
          const kind = ev.type || ev.event || ev.kind || "";
          const tool = ev.tool || ev.name || ev.toolName || "";
          const text =
            ev.message?.content ||
            ev.content ||
            ev.text ||
            ev.result ||
            ev.summary ||
            "";
          if (kind && /tool|result|error|assistant|message|done|complete/i.test(String(kind))) {
            const snippet = String(text || tool || kind).replace(/\s+/g, " ").slice(0, 160);
            log(`· ${kind}${tool ? " " + tool : ""}${snippet ? ": " + snippet : ""}`);
          } else if (ev.error) {
            log(`✗ ${String(ev.error).slice(0, 200)}`);
          }
        } catch {
          /* not pure json */
        }
      }
      return;
    }
    if (isErr) errSan.push(buf);
    else outSan.push(buf);
  };

  child.stdout?.on("data", (buf) => onChunk(buf, false));
  child.stderr?.on("data", (buf) => onChunk(buf, true));
  child.on("error", (err) => {
    log(`✗ process error: ${err.message}`);
  });
  child.on("close", (code) => {
    try {
      fs.closeSync(rawFd);
    } catch {
      /* ignore */
    }
    if (!quietUi) {
      outSan.flush();
      errSan.flush();
    }
    finishRun(code, runRoot);
  });

  // Heartbeat clean status
  const heartbeat = setInterval(() => {
    if (state.status !== "running") {
      clearInterval(heartbeat);
      return;
    }
    const sec = Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000);
    log(`… ainda rodando (${sec}s) · pid=${state.pid}`);
  }, 8000);

  // Watch interesting files for clean progress
  const watched = new Map(); // path -> mtime
  const watchPaths = [
    path.join(__dirname, "e2e-result.md"),
    path.join(runRoot, "workbench", "HANDOFF.md"),
    path.join(runRoot, "workbench", "QUEUE.md"),
  ];
  const fileWatch = setInterval(() => {
    if (state.status !== "running") {
      clearInterval(fileWatch);
      clearInterval(heartbeat);
      return;
    }
    for (const p of watchPaths) {
      try {
        if (!fs.existsSync(p)) continue;
        const st = fs.statSync(p);
        const prev = watched.get(p);
        if (prev && st.mtimeMs !== prev) {
          log(`📝 atualizado: ${path.relative(runRoot, p)}`);
        }
        watched.set(p, st.mtimeMs);
      } catch {
        /* ignore */
      }
    }
    // e2e pass auto-stop
    const e2ePath = path.join(__dirname, "e2e-result.md");
    try {
      if (fs.existsSync(e2ePath)) {
        const txt = fs.readFileSync(e2ePath, "utf8");
        if (/status:\s*\*\*PASS\*\*|status:\s*PASS/i.test(txt)) {
          log("✓ e2e-result.md PASS — encerrando (anti-hang)");
          clearInterval(fileWatch);
          clearInterval(heartbeat);
          stopRun();
          setTimeout(() => {
            if (state.status === "running") finishRun(0, runRoot);
            else if (state.exitCode !== 0) {
              state.status = "done";
              state.exitCode = 0;
              broadcastStatus();
            }
          }, 1200);
        }
      }
    } catch {
      /* ignore */
    }
  }, 2000);

  // hard cap 12 min
  setTimeout(() => {
    if (state.status === "running") {
      log("■ timeout 12min — stop");
      clearInterval(fileWatch);
      clearInterval(heartbeat);
      stopRun();
    }
  }, 12 * 60 * 1000);

  return {
    ok: true,
    executor,
    playerId: player?.id || null,
    pid: state.pid,
    rawLog: path.relative(runRoot, rawLogPath),
  };
}

function finishRun(code, runRoot = ROOT) {
  if (state.status !== "running" && state.status !== "error") {
    // already finalized
  }
  state.exitCode = code;
  state.endedAt = new Date().toISOString();
  state.status = code === 0 ? "done" : "error";
  state.pid = null;
  child = null;
  if (code === 0) cleanupExternalizedPrompts(runRoot);
  log(code === 0 ? "✓ Run finished OK" : `✗ Run finished exit=${code}`);
  broadcastStatus();
  try {
    const snap = {
      ...state,
      logs: state.logs.slice(-200),
    };
    fs.writeFileSync(
      path.join(__dirname, "last-run.json"),
      JSON.stringify(snap, null, 2),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

function stopRun() {
  if (!child) return { ok: false, error: "Nenhuma run ativa" };
  log("■ Stop requested");
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
    } else {
      child.kill("SIGTERM");
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  return { ok: true };
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
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

export function createMaestroServer({
  root = ROOT,
  host = "127.0.0.1",
  port = PORT,
  engineManager,
  operationStore,
  memoryService,
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
  const factoryAdmin = createFactoryAdmin({ root, spawnImpl });
  const lifecycleManager = createLifecycleManager({ root, engineManager: engine });
  const forgeOperator = createForgeOperator({
    root,
    factoryAdmin,
    engineManager: engine,
    runFactory: (goal, options, runtime) => startRun(goal, options, { ...runtime, spawnImpl }),
  });
  const audit = createAuditLog({ root });
  const confirmations = createConfirmationManager();
  const controlSnapshot = () =>
    buildControlSnapshot({
      root,
      engineManager: engine,
      operations: operations.list(),
      providerHealth: factoryAdmin.listProviders(),
      server: { host, port },
      memory,
    });
  const control = createControlDispatcher({
    getSnapshot: controlSnapshot,
    operations,
    audit,
    confirmations,
    handlers: {
      ...createEngineActionHandlers({ root, engineManager: engine, factoryAdmin, lifecycleManager, forgeOperator }),
      ...createMemoryActionHandlers(memory),
    },
    emitEvent: (type, payload) => {
      const data = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
      for (const client of sseClients) {
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

  // toda mutação exige o token por instalação (maestro/.token)
  if (method === "POST" && url.pathname.startsWith("/api/") && !checkToken(req)) {
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
        initial += `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
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
      const result = startRun(body.goal || body.prompt || "", {
        executor: body.executor,
        playerId: body.playerId,
        maxTurns: body.maxTurns,
      }, { root, spawnImpl });
      sendJson(res, result.ok ? 200 : 409, result);
    } catch (e) {
      sendJson(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (url.pathname === "/api/stop" && method === "POST") {
    sendJson(res, 200, stopRun());
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
        sendJson(res, 200, { ok: true, pipeline: engine.start(body) });
      } else if (action === "feedback") {
        sendJson(res, 200, { ok: true, pipeline: engine.startFeedback(body) });
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
      sendJson(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) });
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
          res.writeHead(200, { "Content-Type": contentType(candidate) });
          fs.createReadStream(candidate).pipe(res);
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
      res.writeHead(200, { "Content-Type": contentType(f) });
      fs.createReadStream(f).pipe(res);
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
      res.writeHead(200, { "Content-Type": contentType(f) });
      fs.createReadStream(f).pipe(res);
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
      res.writeHead(200, { "Content-Type": contentType(f) });
      fs.createReadStream(f).pipe(res);
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
      res.writeHead(200, { "Content-Type": contentType(f) });
      fs.createReadStream(f).pipe(res);
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
      res.writeHead(200, { "Content-Type": contentType(f) });
      fs.createReadStream(f).pipe(res);
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
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
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
