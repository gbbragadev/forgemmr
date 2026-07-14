import fs from "node:fs";
import path from "node:path";

import { writePrivateFile } from "../adapters.mjs";
import { validateP4Result } from "../p4-result.mjs";

const P5_DECISIONS = new Set(["kill", "iterate", "scale"]);

function assertAppId(appId) {
  if (!/^[a-z0-9-]+$/.test(String(appId || ""))) throw new Error(`appId inválido: ${appId}`);
  return appId;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeAtomic(file, value, { privateFile = false } = {}) {
  const temp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(value, null, 2);
  if (privateFile) writePrivateFile(temp, body);
  else fs.writeFileSync(temp, body, "utf8");
  fs.renameSync(temp, file);
}

function lifecycleFile(root, appId) {
  return path.join(root, "maestro", "lifecycle", `${assertAppId(appId)}.json`);
}

function p4File(root, appId) {
  return path.join(root, "apps", assertAppId(appId), "docs", "p4-result.json");
}

function defaultState(appId) {
  return { appId, status: "unmeasured", p4: null, p5: null, history: [] };
}

export function listLifecycle(root) {
  const appIds = new Set();
  const appsDir = path.join(root, "apps");
  const lifecycleDir = path.join(root, "maestro", "lifecycle");
  if (fs.existsSync(appsDir)) {
    for (const name of fs.readdirSync(appsDir)) {
      if (/^[a-z0-9-]+$/.test(name) && fs.statSync(path.join(appsDir, name)).isDirectory()) appIds.add(name);
    }
  }
  if (fs.existsSync(lifecycleDir)) {
    for (const name of fs.readdirSync(lifecycleDir)) {
      if (/^[a-z0-9-]+\.json$/.test(name)) appIds.add(name.slice(0, -5));
    }
  }
  return [...appIds].sort().map((appId) => {
    const persisted = readJson(lifecycleFile(root, appId), null);
    const state = persisted && persisted.appId === appId ? persisted : defaultState(appId);
    const p4 = readJson(p4File(root, appId), null);
    if (p4 && validateP4Result(p4).valid) {
      state.p4 = p4;
      if (state.status === "unmeasured") state.status = "measured";
    }
    state.history = Array.isArray(state.history) ? state.history : [];
    return state;
  });
}

export function createLifecycleManager({ root, engineManager, now = () => Date.now() } = {}) {
  function load(appId) {
    return listLifecycle(root).find((entry) => entry.appId === appId) || defaultState(assertAppId(appId));
  }

  function save(state) {
    writeAtomic(lifecycleFile(root, state.appId), state, { privateFile: true });
    return structuredClone(state);
  }

  return {
    list: () => listLifecycle(root),
    recordP4(result) {
      const validation = validateP4Result(result);
      if (!validation.valid) throw new Error(`P4 inválido: ${validation.errors.join("; ")}`);
      const appId = assertAppId(result.appId);
      if (!fs.existsSync(path.join(root, "apps", appId))) throw new Error(`app ${appId} não existe em apps/`);
      const normalized = structuredClone(result);
      writeAtomic(p4File(root, appId), normalized);
      const state = load(appId);
      state.p4 = normalized;
      state.status = "measured";
      state.updatedAt = new Date(now()).toISOString();
      state.history.push({ type: "p4", at: state.updatedAt, verdict: normalized.verdict });
      return save(state);
    },
    decideP5(input) {
      const appId = assertAppId(input?.appId);
      const decision = input?.decision;
      if (!P5_DECISIONS.has(decision)) throw new Error(`decisão P5 inválida: ${decision}`);
      const why = String(input?.why || "").trim();
      if (why.length < 8) throw new Error("P5 precisa explicar a decisão em why");
      const state = load(appId);
      if (!state.p4 || !validateP4Result(state.p4).valid) throw new Error(`P4 de ${appId} ainda não foi registrado`);

      let pipeline = null;
      if (decision === "iterate") {
        const feedback = String(input?.feedback || "").trim();
        if (feedback.length < 8) throw new Error("iterate precisa de feedback acionável");
        if (!engineManager?.startFeedback) throw new Error("engine indisponível para iniciar iterate");
        pipeline = engineManager.startFeedback({
          appId,
          feedbackText: feedback,
          team: input.team,
          dryRun: Boolean(input.dryRun),
          target: input.target,
          controlMode: input.controlMode,
        });
      }

      const decidedAt = new Date(now()).toISOString();
      const status = decision === "kill" ? "retired" : decision === "iterate" ? "iterating" : "scaling";
      state.status = status;
      state.p5 = { decision, why, decidedAt };
      state.updatedAt = decidedAt;
      state.history.push({ type: "p5", at: decidedAt, decision, why });
      const saved = save(state);
      return {
        ...saved,
        ...(pipeline ? { pipeline } : {}),
        nextActions:
          decision === "kill"
            ? ["Arquivar aprendizados", "Abrir nova hipótese P0"]
            : decision === "iterate"
              ? ["Acompanhar a pipeline ITERATE", "Repetir P4 após o próximo ship"]
              : ["Escolher canal de escala", "Definir limite de custo e próxima medição"],
      };
    },
  };
}
