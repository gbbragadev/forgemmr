import fs from "node:fs";
import path from "node:path";

import { writePrivateFile } from "../adapters.mjs";

const APP_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const VISIBILITY = new Set(["private", "public"]);
const STATUS = new Set(["prepared", "confirmed", "published", "verified"]);

function assertAppId(appId) {
  if (!APP_ID.test(String(appId || ""))) throw new Error(`appId inválido: ${appId}`);
  return appId;
}

function requiredText(value, label, { min = 1, max = 10_000 } = {}) {
  const text = String(value || "").trim();
  if (text.length < min) throw new Error(`${label} é obrigatório`);
  if (text.length > max) throw new Error(`${label} excede ${max} caracteres`);
  return text;
}

function optionalText(value, label, { max = 10_000 } = {}) {
  const text = String(value || "").trim();
  if (text.length > max) throw new Error(`${label} excede ${max} caracteres`);
  return text || null;
}

function deploymentDir(root) {
  return path.join(root, "maestro", "always-on");
}

function deploymentFile(root, appId) {
  return path.join(deploymentDir(root), `${assertAppId(appId)}.json`);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writePrivateFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
  return structuredClone(value);
}

function event(type, at, actor, detail = {}) {
  return { type, at, actor, ...detail };
}

function check(value, label, options) {
  if (!options.includes(value)) throw new Error(`${label} inválido: ${value}`);
  return value;
}

export function listAlwaysOnDeployments(root) {
  const dir = deploymentDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => APP_ID.test(name.replace(/\.json$/, "")) && name.endsWith(".json"))
    .sort()
    .map(name => readJson(path.join(dir, name)))
    .filter(entry => entry && APP_ID.test(entry.appId) && STATUS.has(entry.status));
}

export function createAlwaysOnDeployManager({ root, now = () => Date.now() } = {}) {
  function timestamp() {
    return new Date(now()).toISOString();
  }

  function load(appId) {
    return readJson(deploymentFile(root, appId));
  }

  function requireStatus(appId, expected) {
    const state = load(appId);
    if (!state) throw new Error(`deploy Always-On de ${appId} ainda não foi preparado`);
    if (state.status !== expected) throw new Error(`deploy Always-On de ${appId} está em ${state.status}; esperado ${expected}`);
    return state;
  }

  return {
    list: () => listAlwaysOnDeployments(root),

    prepare(input) {
      const appId = assertAppId(input?.appId);
      const existing = load(appId);
      if (existing && existing.status !== "prepared") {
        throw new Error(`deploy Always-On de ${appId} já avançou para ${existing.status}`);
      }
      const expectedSource = path.resolve(root, "apps", appId);
      const sourceRoot = path.resolve(requiredText(input?.sourceRoot, "sourceRoot"));
      if (sourceRoot !== expectedSource) throw new Error(`sourceRoot precisa apontar para apps/${appId}`);
      if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error(`sourceRoot inexistente: ${sourceRoot}`);
      const visibility = check(input?.visibility, "visibility", [...VISIBILITY]);
      const hostname = optionalText(input?.hostname, "hostname", { max: 253 });
      if (visibility === "public" && !hostname) throw new Error("hostname é obrigatório para exposição pública");
      const actor = requiredText(input?.actor, "actor", { max: 120 });
      const at = timestamp();
      const request = {
        sourceRoot,
        visibility,
        hostname,
        startCommand: requiredText(input?.startCommand, "startCommand", { max: 2_000 }),
        migrationCommand: optionalText(input?.migrationCommand, "migrationCommand", { max: 2_000 }),
        persistentData: requiredText(input?.persistentData, "persistentData"),
        workload: requiredText(input?.workload, "workload"),
        slo: requiredText(input?.slo, "slo"),
        healthCheck: requiredText(input?.healthCheck, "healthCheck", { max: 2_000 }),
      };
      const state = {
        appId,
        status: "prepared",
        request,
        handoff: {
          skill: "always-on-deploy",
          instruction: "Executar o deploy fora do Forge e devolver revision, releasePath, tasks e evidências de health/capacidade/rollback.",
        },
        publication: null,
        verification: null,
        createdAt: existing?.createdAt || at,
        updatedAt: at,
        history: [...(existing?.history || []), event("prepared", at, actor)],
      };
      return saveAtomic(deploymentFile(root, appId), state);
    },

    confirm(input) {
      const appId = assertAppId(input?.appId);
      const state = requireStatus(appId, "prepared");
      if (input?.reviewed !== true) throw new Error("confirmação exige reviewed=true");
      const actor = requiredText(input?.actor, "actor", { max: 120 });
      const why = requiredText(input?.why, "why", { min: 8, max: 2_000 });
      const at = timestamp();
      state.status = "confirmed";
      state.confirmation = { actor, why, at };
      state.updatedAt = at;
      state.history.push(event("confirmed", at, actor, { why }));
      return saveAtomic(deploymentFile(root, appId), state);
    },

    recordPublished(input) {
      const appId = assertAppId(input?.appId);
      const state = requireStatus(appId, "confirmed");
      const actor = requiredText(input?.actor, "actor", { max: 120 });
      const tasks = String(input?.tasks || "").split(/[\r\n,]+/).map(value => value.trim()).filter(Boolean);
      if (!tasks.length) throw new Error("tasks publicadas são obrigatórias");
      const releasePath = path.resolve(requiredText(input?.releasePath, "releasePath"));
      if (!fs.existsSync(releasePath)) throw new Error(`releasePath inexistente: ${releasePath}`);
      const at = timestamp();
      state.status = "published";
      state.publication = {
        revision: requiredText(input?.revision, "revision", { max: 200 }),
        releasePath,
        tasks,
        healthUrl: optionalText(input?.healthUrl, "healthUrl", { max: 2_000 }),
        capacityEvidence: requiredText(input?.capacityEvidence, "capacityEvidence"),
        rollbackEvidence: requiredText(input?.rollbackEvidence, "rollbackEvidence"),
        actor,
        at,
        source: "always-on-deploy",
      };
      state.updatedAt = at;
      state.history.push(event("published_evidence_recorded", at, actor, { revision: state.publication.revision }));
      return saveAtomic(deploymentFile(root, appId), state);
    },

    verify(input) {
      const appId = assertAppId(input?.appId);
      const state = load(appId);
      if (!state) throw new Error(`deploy Always-On de ${appId} ainda não foi preparado`);
      if (!["published", "verified"].includes(state.status)) throw new Error(`deploy Always-On de ${appId} está em ${state.status}; esperado published ou verified`);
      const actor = requiredText(input?.actor, "actor", { max: 120 });
      const localHealth = check(input?.localHealth, "localHealth", ["pass", "fail"]);
      const ownership = check(input?.ownership, "ownership", ["pass", "fail"]);
      const externalHealth = check(input?.externalHealth, "externalHealth", ["pass", "fail", "not-applicable"]);
      const capacity = check(input?.capacity, "capacity", ["pass", "fail", "not-measured"]);
      const rollback = check(input?.rollback, "rollback", ["pass", "fail", "not-tested"]);
      if (localHealth === "fail" || ownership === "fail") throw new Error("health local e ownership precisam passar");
      if (state.request.visibility === "public" && externalHealth !== "pass") throw new Error("deploy público exige health externo aprovado");
      if (externalHealth === "fail" || capacity === "fail" || rollback === "fail") throw new Error("a verificação contém checks reprovados");
      const pending = [];
      if (capacity === "not-measured") pending.push("capacity");
      if (rollback === "not-tested") pending.push("rollback");
      const at = timestamp();
      state.status = "verified";
      state.verification = {
        localHealth,
        ownership,
        externalHealth,
        capacity,
        rollback,
        pending,
        notes: optionalText(input?.notes, "notes"),
        actor,
        at,
      };
      state.updatedAt = at;
      state.history.push(event("verified", at, actor, { pending }));
      return saveAtomic(deploymentFile(root, appId), state);
    },
  };
}
