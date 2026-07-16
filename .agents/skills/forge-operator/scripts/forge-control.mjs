#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      rest.push(value);
      continue;
    }
    const key = value.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else flags[key] = argv[++index];
  }
  return { flags, rest };
}

function findRoot(start) {
  let current = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(current, "maestro", "forge.mjs"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("repo Forge nao encontrado; abra a sessao dentro do repo");
    current = parent;
  }
}

const { flags, rest } = parseArgs(process.argv.slice(2));
const command = rest[0] || "help";
const root = findRoot(flags.root || process.cwd());
const port = Number(process.env.MAESTRO_PORT || 8799);
const baseUrl = `http://127.0.0.1:${port}`;

function token() {
  const file = path.join(root, "maestro", ".token");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
}

async function request(pathname, body) {
  const response = await fetch(baseUrl + pathname, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-Maestro-Token": token() }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}

async function ensureServer() {
  try {
    await request("/api/status");
    return;
  } catch {}

  const processHandle = spawn(process.execPath, [path.join(root, "maestro", "server.mjs")], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  processHandle.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      await request("/api/status");
      return;
    } catch {}
  }
  throw new Error(`Forge Nexus indisponivel em ${baseUrl}`);
}

function summarizePipeline(pipeline) {
  if (!pipeline) return null;
  const pendingGate = (pipeline.gates || []).find((gate) => !gate.decision) || null;
  return {
    runId: pipeline.runId,
    appId: pipeline.appId,
    status: pipeline.status,
    mode: pipeline.mode,
    controlMode: pipeline.controlMode,
    team: pipeline.team,
    profileName: pipeline.profileName,
    blueprint: pipeline.blueprint,
    currentJob: pipeline.currentJob,
    currentPlayer: pipeline.currentPlayer,
    jobIndex: pipeline.jobIndex,
    jobs: pipeline.jobs,
    startedAt: pipeline.startedAt,
    endedAt: pipeline.endedAt,
    pendingGate: pendingGate
      ? {
          id: pendingGate.id,
          prompt: pendingGate.prompt,
          choices: pendingGate.choices,
          payload: pendingGate.payload,
          createdAt: pendingGate.createdAt,
        }
      : null,
    lastHistory: (pipeline.history || []).slice(-3).map((entry) => ({
      job: entry.job,
      playerId: entry.playerId,
      attempt: entry.attempt,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      exitCode: entry.exitCode,
      pass: entry.pass,
      detail: entry.detail,
      errorTail: entry.errorTail,
    })),
    deploy: pipeline.deploy,
  };
}

function readEvents(appId, after, limit) {
  const file = path.join(root, ".control", "run-events.jsonl");
  if (!fs.existsSync(file)) return [];
  const events = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.appId === appId && Number(event.sequence || 0) > after) events.push(event);
    } catch {}
  }
  const selected = after > 0 ? events.slice(0, limit) : events.slice(-limit);
  return selected.map((event) => ({
    sequence: event.sequence,
    timestamp: event.timestamp,
    runId: event.runId,
    job: event.job,
    playerId: event.playerId,
    stream: event.stream,
    level: event.level,
    eventType: event.eventType,
    line: event.line,
  }));
}

async function getPipelines() {
  const response = await request("/api/pipeline");
  if (response?.appId) return { [response.appId]: response };
  return response || {};
}

function selectApp(pipelines, requested) {
  if (requested) {
    if (!pipelines[requested]) throw new Error(`pipeline inexistente: ${requested}`);
    return requested;
  }
  const active = Object.values(pipelines).filter((pipeline) =>
    ["running", "paused_gate", "blocked", "error"].includes(pipeline?.status),
  );
  if (active.length === 1) return active[0].appId;
  const ids = active.map((pipeline) => pipeline.appId);
  throw new Error(ids.length ? `mais de uma pipeline ativa: ${ids.join(", ")}; use --app` : "nenhuma pipeline ativa");
}

async function executeAction(actionId, input, appId = null) {
  const snapshot = await request("/api/control/snapshot");
  return request("/api/control/actions/execute", {
    actionId,
    appId,
    input,
    stateVersion: snapshot.version,
    idempotencyKey: `forge-skill-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  });
}

function validateTeamSpec(spec, state) {
  if (typeof spec?.name !== "string" || spec.name.trim().length < 2) throw new Error("nome do time invalido");
  if (!Array.isArray(spec.members) || spec.members.length < 1 || spec.members.length > 8) {
    throw new Error("time precisa de 1-8 membros");
  }
  if (!["strict", "fallback"].includes(spec.fallbackPolicy || "fallback")) {
    throw new Error("fallbackPolicy precisa ser strict ou fallback");
  }
  const validRoles = new Set(["Estrategista", "Engenheiro", "Designer", "QA", "Revisor"]);
  const providers = new Map((state.providers || []).map((provider) => [provider.id, provider]));
  for (const [index, member] of spec.members.entries()) {
    const provider = providers.get(member?.provider);
    if (!provider?.installed) throw new Error(`membro ${index + 1}: provider indisponivel`);
    if (!(provider.models || []).some((model) => model.id === member.model)) {
      throw new Error(`membro ${index + 1}: modelo invalido`);
    }
    if (!(provider.efforts || []).includes(member.effort)) throw new Error(`membro ${index + 1}: effort invalido`);
    if (!Array.isArray(member.roles) || !member.roles.length || member.roles.some((role) => !validRoles.has(role))) {
      throw new Error(`membro ${index + 1}: papeis invalidos`);
    }
  }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function snapshot() {
  const state = await request("/api/control/snapshot");
  print({
    version: state.version,
    server: state.server,
    providers: (state.providers || []).map((provider) => ({
      id: provider.id,
      cli: provider.cli,
      installed: provider.installed,
      models: provider.models,
      efforts: provider.efforts,
    })),
    teams: (state.teams || []).map((team) => ({
      id: team.id,
      label: team.label,
      emoji: team.emoji,
      fallbackPolicy: team.fallbackPolicy || "fallback",
      dispatch: team.dispatch,
      fallbacks: team.fallbacks,
      review: team.review,
    })),
    profiles: state.profiles,
    blueprints: state.blueprints,
    pipelines: (state.pipelines || []).map(summarizePipeline),
  });
}

async function saveTeam() {
  if (!flags.spec) throw new Error("uso: save-team --spec <time.json>");
  const specPath = path.resolve(root, String(flags.spec));
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const state = await request("/api/control/snapshot");
  validateTeamSpec(spec, state);
  if (flags.dryRun) {
    print({ valid: true, applied: false, spec });
    return;
  }
  const result = await executeAction("team.save", spec);
  print(result.result || result);
}

async function observe() {
  const after = Math.max(0, Number(flags.after || 0));
  const limit = Math.min(100, Math.max(1, Number(flags.limit || 25)));
  const waitSeconds = Math.min(45, Math.max(0, Number(flags.wait || 0)));
  let pipelines = await getPipelines();
  const appId = selectApp(pipelines, flags.app);
  let events = readEvents(appId, after, limit);
  const initialStatus = pipelines[appId]?.status;
  const deadline = Date.now() + waitSeconds * 1000;

  while (!events.length && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    pipelines = await getPipelines();
    events = readEvents(appId, after, limit);
    if (pipelines[appId]?.status !== initialStatus) break;
  }

  const allSequences = events.map((event) => Number(event.sequence || 0));
  print({
    pipeline: summarizePipeline(pipelines[appId]),
    events,
    nextCursor: allSequences.length ? Math.max(after, ...allSequences) : after,
  });
}

function help() {
  console.log(`Forge Operator helper

  snapshot
  observe [--app <id>] [--after <sequence>] [--limit 25] [--wait 45]
  save-team --spec <time.json> [--dry-run]

Use --root <repo> quando o cwd nao estiver dentro do Forge.`);
}

await ensureServer();
if (command === "snapshot") await snapshot();
else if (command === "observe") await observe();
else if (command === "save-team") await saveTeam();
else help();
