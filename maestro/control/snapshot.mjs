import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { makeRedactor } from "../adapters.mjs";
import { listProfiles } from "../engine.mjs";
import { aggregateRuns, loadRuns } from "../stats.mjs";
import { createActionCatalog } from "./catalog.mjs";
import { listLifecycle as loadLifecycle } from "./lifecycle.mjs";
import { createMemoryActions } from "../memory/control.mjs";
import { createBlueprintAdmin } from "./blueprint-admin.mjs";

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stateVersion(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 16);
}

function sanitize(value) {
  const redact = makeRedactor();
  return JSON.parse(redact(JSON.stringify(value)));
}

function listBlueprints(root) {
  const result = [{ id: "generic", name: "Generic", title: "Pipeline padrão", jobs: [] }];
  result.push(...createBlueprintAdmin({ root }).list({ includeArchived: true }));
  return result;
}

function normalizeRoster(root) {
  const roster = readJson(path.join(root, "maestro", "roster.json"), { players: [], teams: {} });
  const providers = (roster.players || [])
    .map((player) => ({
      id: player.id,
      name: player.name,
      cli: player.cli,
      model: player.modelLabel || player.model || "default",
      roles: player.roles || [],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const teams = Object.entries(roster.teams || {})
    .map(([id, team]) => ({ id, ...team }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { providers, teams };
}

function pendingDecisions(pipelines) {
  const decisions = [];
  for (const pipeline of pipelines) {
    for (const gate of pipeline.gates || []) {
      if (gate.decision) continue;
      decisions.push({
        appId: pipeline.appId,
        gateId: gate.id,
        prompt: gate.prompt || "Decisão pendente",
        choices: gate.choices || [],
        payload: gate.payload || null,
        createdAt: gate.createdAt || null,
      });
    }
  }
  return decisions.sort((a, b) => a.appId.localeCompare(b.appId) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

/** Cache de snapshot: evita readdir/parse de runs a cada tick SSE (TTL + chave de pipelines). */
let _snapshotCache = null;

function pipelineCacheKey(pipelineMap) {
  return Object.keys(pipelineMap)
    .sort()
    .map((id) => {
      const p = pipelineMap[id] || {};
      return [
        id,
        p.status,
        p.currentJob,
        p.jobIndex,
        (p.gates || []).length,
        (p.history || []).length,
        p.endedAt || "",
        p.controlMode || "",
      ].join(":");
    })
    .join("|");
}

export function buildControlSnapshot({ root, engineManager, operations = [], now = new Date(), server = {}, providerHealth = null, memory = null }) {
  const pipelineMap = engineManager?.snapshot?.() || {};
  const key = pipelineCacheKey(pipelineMap);
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  if (
    _snapshotCache &&
    _snapshotCache.root === root &&
    _snapshotCache.key === key &&
    nowMs - _snapshotCache.at < 2000
  ) {
    return _snapshotCache.value;
  }

  const pipelines = Object.entries(pipelineMap)
    .map(([appId, pipeline]) => ({ appId, ...pipeline }))
    .sort((a, b) => a.appId.localeCompare(b.appId));
  const profiles = listProfiles(root);
  const roster = normalizeRoster(root);
  const providers = providerHealth || roster.providers;
  const teams = roster.teams;
  const blueprints = listBlueprints(root);
  const decisions = pendingDecisions(pipelines);
  const lifecycle = loadLifecycle(root);
  const stats = aggregateRuns(loadRuns(root));
  const memoryStatus = memory?.status?.() || {
    state: "unconfigured",
    version: "1.13.0",
    managed: false,
    latencyMs: null,
    pageCount: 0,
    pendingOutbox: 0,
    lastHealthAt: null,
    lastError: null,
  };
  const actions = createActionCatalog({
    pipelines,
    profiles,
    teams,
    blueprints,
    providers,
    lifecycle,
    memoryActions: createMemoryActions(memoryStatus),
  });
  const core = {
    server: {
      status: "online",
      product: "forge-nexus",
      host: "127.0.0.1",
      port: 8799,
      localOnly: true,
      cooldowns: engineManager?.cooldowns?.() || {},
      ...server,
    },
    providers,
    profiles,
    teams,
    blueprints,
    pipelines,
    decisions,
    lifecycle,
    memory: memoryStatus,
    stats,
    operations: operations.slice(),
    actions,
  };
  const snapshot = {
    version: stateVersion(core),
    generatedAt: now.toISOString(),
    ...core,
  };
  const value = sanitize(snapshot);
  _snapshotCache = { root, key, at: nowMs, value };
  return value;
}

/** Só para testes: limpa o cache do snapshot. */
export function clearControlSnapshotCache() {
  _snapshotCache = null;
}
