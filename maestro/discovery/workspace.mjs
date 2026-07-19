import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { buildBragaHandoff, canonicalJson, contentHash, exportPreparedHandoff, renderBragaMarkdown, validateBragaReturn, writePreparedHandoff } from "./braga-handoff.mjs";
import { evaluateGates } from "./gates.mjs";
import { clone, deepFreeze, normalizeEvidence, normalizeExperiment, normalizeThesisDraft } from "./model.mjs";
import { createDiscoveryStore } from "./store.mjs";

function required(value, label) {
  if (value === undefined || value === null || value === "") throw new Error(`${label} é obrigatório`);
  return value;
}

export function createDiscoveryWorkspace({ root, engineManager, now = () => new Date().toISOString(), idFactory }) {
  const store = createDiscoveryStore({ root });
  const makeId = prefix => idFactory ? idFactory(prefix) : `${prefix}-${randomUUID()}`;

  function state() {
    return store.read();
  }

  function find(collection, id, label) {
    const item = state()[collection].find(candidate => candidate.id === id);
    if (!item) throw new Error(`${label} não encontrado: ${id}`);
    return item;
  }

  function mutate(mutator) {
    let result;
    store.update(current => {
      result = mutator(current);
    });
    return clone(result);
  }

  function history(stage, actor) {
    return { stage, actor, at: now() };
  }

  return {
    createRoom({ title, sourceRef = null }) {
      required(title, "room.title");
      return mutate(current => {
        const room = { id: makeId("room"), title, sourceRef, messages: [], createdAt: now(), updatedAt: now() };
        current.rooms.push(room);
        return room;
      });
    },

    appendMessage({ roomId, author, text, executor = null, refs = [] }) {
      required(author, "message.author");
      required(text, "message.text");
      return mutate(current => {
        const room = current.rooms.find(candidate => candidate.id === roomId);
        if (!room) throw new Error(`room não encontrada: ${roomId}`);
        const message = { id: makeId("message"), author, text, executor: clone(executor), refs: clone(refs), createdAt: now() };
        room.messages.push(message);
        room.updatedAt = now();
        return message;
      });
    },

    proposeThesis({ roomId, sourceMessageIds = [], draft }) {
      const normalized = normalizeThesisDraft(draft);
      return mutate(current => {
        const room = current.rooms.find(candidate => candidate.id === roomId);
        if (!room) throw new Error(`room não encontrada: ${roomId}`);
        const knownMessages = new Set(room.messages.map(message => message.id));
        if (sourceMessageIds.some(id => !knownMessages.has(id))) throw new Error("sourceMessageIds inválido");
        const thesis = {
          id: makeId("thesis"), roomId, sourceMessageIds: clone(sourceMessageIds), ...normalized,
          stage: "proposed", history: [history("proposed", "system")], evidenceIds: [], experimentIds: [],
          buildProposal: null, buildId: null, acquisitionId: null, createdAt: now(), updatedAt: now(),
        };
        current.theses.push(thesis);
        return thesis;
      });
    },

    confirmThesis({ thesisId, actor }) {
      required(actor, "actor");
      return mutate(current => {
        const thesis = current.theses.find(candidate => candidate.id === thesisId);
        if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
        if (thesis.stage === "confirmed") return thesis;
        if (thesis.stage !== "proposed") throw new Error("somente tese proposta pode ser confirmada");
        thesis.stage = "confirmed";
        thesis.history.push(history("confirmed", actor));
        thesis.updatedAt = now();
        return thesis;
      });
    },

    startValidation({ thesisId, experimentId, actor }) {
      required(actor, "actor");
      return mutate(current => {
        const thesis = current.theses.find(candidate => candidate.id === thesisId);
        if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
        if (thesis.stage !== "confirmed" && thesis.stage !== "validating") throw new Error("tese precisa estar confirmada");
        const experiment = current.experiments.find(candidate => candidate.id === experimentId && candidate.thesisId === thesisId);
        if (!experiment) throw new Error(`experimento não encontrado: ${experimentId}`);
        if (experiment.status === "running") return experiment;
        const activeThesisIds = new Set(
          current.experiments.filter(candidate => candidate.status === "running").map(candidate => candidate.thesisId),
        );
        if (!activeThesisIds.has(thesisId) && activeThesisIds.size >= 3) {
          throw new Error("WIP de validação 3 atingido");
        }
        experiment.status = "running";
        experiment.startedAt = now();
        experiment.startedBy = actor;
        thesis.stage = "validating";
        thesis.history.push(history("validating", actor));
        thesis.updatedAt = now();
        return experiment;
      });
    },

    recordEvidence({ thesisId, evidence }) {
      const normalized = normalizeEvidence(evidence);
      return mutate(current => {
        const thesis = current.theses.find(candidate => candidate.id === thesisId);
        if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
        const item = {
          id: makeId("evidence"), thesisId, ...normalized,
          verification: { decision: "unverified", actor: null, notes: null, at: null }, createdAt: now(),
        };
        current.evidence.push(item);
        thesis.evidenceIds.push(item.id);
        thesis.updatedAt = now();
        return item;
      });
    },

    verifyEvidence({ evidenceId, actor, decision, notes = "" }) {
      required(actor, "actor");
      if (!(["verified", "rejected"].includes(decision))) throw new Error("decision inválida");
      return mutate(current => {
        const evidence = current.evidence.find(candidate => candidate.id === evidenceId);
        if (!evidence) throw new Error(`evidência não encontrada: ${evidenceId}`);
        evidence.verification = { decision, actor, notes, at: now() };
        return evidence;
      });
    },

    createExperiment({ thesisId, experiment }) {
      const normalized = normalizeExperiment(experiment);
      if (normalized.costCap > 0) throw new Error("gasto exige aprovação separada");
      return mutate(current => {
        const thesis = current.theses.find(candidate => candidate.id === thesisId);
        if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
        const item = { id: makeId("experiment"), thesisId, ...normalized, status: "draft", evidenceIds: [], createdAt: now() };
        current.experiments.push(item);
        thesis.experimentIds.push(item.id);
        return item;
      });
    },

    completeExperiment({ experimentId, evidenceIds = [], interpretation, decision }) {
      required(interpretation, "interpretation");
      required(decision, "decision");
      return mutate(current => {
        const experiment = current.experiments.find(candidate => candidate.id === experimentId);
        if (!experiment) throw new Error(`experimento não encontrado: ${experimentId}`);
        if (evidenceIds.some(id => !current.evidence.some(item => item.id === id && item.thesisId === experiment.thesisId))) {
          throw new Error("evidenceIds inválido");
        }
        experiment.status = "completed";
        experiment.evidenceIds = clone(evidenceIds);
        experiment.interpretation = interpretation;
        experiment.decision = decision;
        experiment.completedAt = now();
        return experiment;
      });
    },

    proposeBuild({ thesisId, brief, actor }) {
      required(actor, "actor");
      const requiredFields = ["hypothesisToTest", "minimalScope", "capability", "profile", "blueprint", "channel", "postBuildEvent", "successCriteria", "killCriteria"];
      for (const field of requiredFields) required(brief?.[field], `brief.${field}`);
      const thesis = find("theses", thesisId, "tese");
      if (!["confirmed", "validating"].includes(thesis.stage)) throw new Error("tese precisa estar confirmada para propor build");
      const gates = this.gatesFor(thesisId);
      if (!gates.build.ok) throw new Error(`build bloqueado: ${gates.build.unmet.join(", ")}`);
      const proposal = mutate(current => {
        const currentThesis = current.theses.find(candidate => candidate.id === thesisId);
        const value = { id: makeId("build-proposal"), thesisId, ...clone(brief), evidenceRefs: clone(gates.build.evidenceRefs), actor, createdAt: now() };
        currentThesis.buildProposal = value;
        currentThesis.updatedAt = now();
        return value;
      });
      return deepFreeze(proposal);
    },

    startBuild({ thesisId, startOptions = {}, actor }) {
      required(actor, "actor");
      if (startOptions.approved !== true) throw new Error("approval explícita é obrigatória");
      let snapshot = state();
      let thesis = snapshot.theses.find(candidate => candidate.id === thesisId);
      if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
      if (thesis.buildId) return clone(snapshot.builds.find(build => build.id === thesis.buildId));
      if (!thesis.buildProposal) throw new Error("build precisa de proposta");
      if (snapshot.builds.some(build => ["starting", "building"].includes(build.status))) throw new Error("WIP de build 1 atingido");
      const reserved = mutate(current => {
        const currentThesis = current.theses.find(candidate => candidate.id === thesisId);
        const build = { id: makeId("build"), thesisId, proposalId: currentThesis.buildProposal.id, appId: null, runId: null, status: "starting", actor, createdAt: now() };
        current.builds.push(build);
        currentThesis.buildId = build.id;
        return build;
      });
      try {
        const options = clone(startOptions); delete options.approved;
        const result = engineManager.startFromDiscovery({ thesisId, buildProposal: clone(thesis.buildProposal), ...options });
        return mutate(current => {
          const build = current.builds.find(candidate => candidate.id === reserved.id);
          const currentThesis = current.theses.find(candidate => candidate.id === thesisId);
          Object.assign(build, { appId: result?.appId ?? null, runId: result?.runId ?? null, status: "building", startedAt: now() });
          currentThesis.stage = "building";
          currentThesis.history.push(history("building", actor));
          return build;
        });
      } catch (error) {
        mutate(current => {
          const build = current.builds.find(candidate => candidate.id === reserved.id);
          build.status = "failed"; build.error = String(error.message || error); build.endedAt = now();
          const currentThesis = current.theses.find(candidate => candidate.id === thesisId);
          currentThesis.buildId = null;
          return build;
        });
        throw error;
      }
    },

    completeBuild({ buildId, url = null, artifact = null, instrumentationObserved, actor }) {
      required(actor, "actor");
      if (!url && !artifact) throw new Error("URL ou artifact é obrigatório");
      if (instrumentationObserved !== true) throw new Error("instrumentação precisa ser observada");
      return mutate(current => {
        const build = current.builds.find(candidate => candidate.id === buildId);
        if (!build) throw new Error(`build não encontrado: ${buildId}`);
        Object.assign(build, { status: "completed", url, artifact, instrumentationObserved: true, completedAt: now() });
        const thesis = current.theses.find(candidate => candidate.id === build.thesisId);
        thesis.stage = "acquisition_ready";
        thesis.history.push(history("acquisition_ready", actor));
        return build;
      });
    },

    terminateBuild({ buildId, status, reason, actor }) {
      required(actor, "actor");
      required(reason, "reason");
      if (!["killed", "failed"].includes(status)) throw new Error("status terminal inválido");
      return mutate(current => {
        const build = current.builds.find(candidate => candidate.id === buildId);
        if (!build) throw new Error(`build não encontrado: ${buildId}`);
        if (!["starting", "building"].includes(build.status)) throw new Error("somente build ativo pode ser terminado");
        Object.assign(build, { status, reason, terminatedBy: actor, endedAt: now() });
        const thesis = current.theses.find(candidate => candidate.id === build.thesisId);
        thesis.stage = status;
        thesis.history.push({ ...history(status, actor), reason, buildId });
        thesis.updatedAt = now();
        return build;
      });
    },

    attachValidationAsset({ experimentId, asset, actor }) {
      required(actor, "actor");
      if (!asset || !["url", "mockup", "landing", "concierge"].includes(asset.type)) throw new Error("asset.type inválido");
      required(asset.url || asset.path, "asset.url/path");
      return mutate(current => {
        const experiment = current.experiments.find(candidate => candidate.id === experimentId);
        if (!experiment) throw new Error(`experimento não encontrado: ${experimentId}`);
        const value = { id: makeId("asset"), ...clone(asset), actor, createdAt: now() };
        experiment.validationAssets ||= [];
        experiment.validationAssets.push(value);
        return value;
      });
    },

    prepareBragaHandoff(input) {
      const snapshot = state();
      const thesis = snapshot.theses.find(item => item.id === input?.thesisId);
      if (!thesis) throw new Error(`tese não encontrada: ${input?.thesisId}`);
      const experiment = snapshot.experiments.find(item => item.id === input?.experimentId && item.thesisId === thesis.id);
      if (!experiment) throw new Error(`experimento não encontrado: ${input?.experimentId}`);
      const build = snapshot.builds.find(item => item.id === thesis.buildId && item.status === "completed");
      if (!build) throw new Error("build concluído é obrigatório");
      if (!thesis.buildProposal) throw new Error("proposta de build é obrigatória");
      const budget = input?.budget;
      if (!budget || typeof budget !== "object" || Array.isArray(budget)) throw new Error("budget inválido");
      const approved = experiment.spendApproval;
      if (approved) {
        if (budget.requested !== approved.requested || budget.approved !== approved.approved || budget.ceiling !== approved.ceiling) {
          throw new Error("budget precisa corresponder à aprovação de gasto do experimento");
        }
      } else if (budget.requested !== 0 || budget.approved !== 0 || budget.ceiling !== 0) {
        throw new Error("budget sem aprovação precisa permanecer zero");
      }
      const preparedAt = now();
      const contract = buildBragaHandoff({
        thesis, experiment, build, proposal: thesis.buildProposal,
        evidence: snapshot.evidence.filter(item => item.thesisId === thesis.id), input, preparedAt,
      });
      const hash = contentHash(contract);
      const existing = snapshot.handoffs.find(item => item.hash === hash);
      if (existing) return { ...clone(existing), contract: clone(contract), json: canonicalJson(contract), markdown: renderBragaMarkdown(contract) };
      const id = makeId("braga-handoff");
      const markdown = renderBragaMarkdown(contract);
      const paths = writePreparedHandoff({ root, id, contract, markdown });
      const record = mutate(current => {
        const item = { id, thesisId: thesis.id, experimentId: experiment.id, hash, ...paths, preparedAt, exports: [] };
        current.handoffs.push(item);
        return item;
      });
      return { ...record, contract, json: canonicalJson(contract), markdown };
    },

    exportBragaHandoff({ handoffId, target, actor }) {
      required(actor, "actor");
      const snapshot = state();
      const handoff = snapshot.handoffs.find(item => item.id === handoffId);
      if (!handoff) throw new Error(`handoff não encontrado: ${handoffId}`);
      const contract = JSON.parse(fs.readFileSync(handoff.jsonPath, "utf8"));
      const exportedPath = exportPreparedHandoff({ root, target, contract });
      return mutate(current => {
        const currentHandoff = current.handoffs.find(item => item.id === handoffId);
        const exported = { path: exportedPath, actor, exportedAt: now() };
        currentHandoff.exports.push(exported);
        return exported;
      });
    },

    approveSpend({ experimentId, requested, ceiling, actor, why = "" }) {
      required(actor, "actor");
      if (!Number.isFinite(requested) || requested <= 0) throw new Error("gasto solicitado precisa ser positivo; zero não cria aprovação");
      if (!Number.isFinite(ceiling) || ceiling <= 0 || ceiling > requested) throw new Error("teto de gasto inválido");
      if (typeof why !== "string" || !why.trim()) throw new Error("why é obrigatório para aprovar gasto");
      return mutate(current => {
        const experiment = current.experiments.find(item => item.id === experimentId);
        if (!experiment) throw new Error(`experimento não encontrado: ${experimentId}`);
        const approval = { requested, approved: ceiling, ceiling, approvedAt: now(), actor, why: why.trim() };
        experiment.spendApproval = approval;
        return approval;
      });
    },

    startAcquisition({ thesisId, experimentId, actor }) {
      required(actor, "actor");
      const gates = this.gatesFor(thesisId);
      if (!gates.e2.ok) throw new Error(`aquisição bloqueada por E2: ${gates.e2.unmet.join(", ")}`);
      return mutate(current => {
        const thesis = current.theses.find(candidate => candidate.id === thesisId);
        if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
        if (!thesis.acquisitionId && current.acquisitions.some(item => item.status === "active")) throw new Error("WIP de aquisição 1 atingido");
        const experiment = current.experiments.find(item => item.id === experimentId && item.thesisId === thesisId);
        if (!experiment) throw new Error(`experimento não encontrado: ${experimentId}`);
        const build = current.builds.find(item => item.id === thesis.buildId);
        if (!build || build.status !== "completed" || build.instrumentationObserved !== true || (!build.url && !build.artifact)) {
          throw new Error("aquisição exige build concluído, testável e instrumentado");
        }
        if (thesis.acquisitionId) return current.acquisitions.find(item => item.id === thesis.acquisitionId);
        if (current.acquisitions.some(item => item.status === "active")) throw new Error("WIP de aquisição 1 atingido");
        const acquisition = { id: makeId("acquisition"), thesisId, experimentId, status: "active", actor, createdAt: now() };
        current.acquisitions.push(acquisition);
        thesis.acquisitionId = acquisition.id;
        return acquisition;
      });
    },

    reserveAcquisition({ thesisId, actor }) {
      const thesis = find("theses", thesisId, "tese");
      const experimentId = thesis.experimentIds.at(-1);
      return this.startAcquisition({ thesisId, experimentId, actor });
    },

    completeAcquisition({ acquisitionId, actor, reason = "Experimento concluído" }) {
      required(actor, "actor");
      required(reason, "reason");
      return mutate(current => {
        const acquisition = current.acquisitions.find(item => item.id === acquisitionId);
        if (!acquisition) throw new Error(`aquisição não encontrada: ${acquisitionId}`);
        if (acquisition.status !== "active") return acquisition;
        Object.assign(acquisition, { status: "completed", completedAt: now(), completedBy: actor, reason });
        return acquisition;
      });
    },

    terminateAcquisition({ acquisitionId, actor, reason }) {
      required(actor, "actor");
      required(reason, "reason");
      return mutate(current => {
        const acquisition = current.acquisitions.find(item => item.id === acquisitionId);
        if (!acquisition) throw new Error(`aquisição não encontrada: ${acquisitionId}`);
        if (acquisition.status !== "active") throw new Error("somente aquisição ativa pode ser terminada");
        Object.assign(acquisition, { status: "terminated", terminatedAt: now(), terminatedBy: actor, reason });
        return acquisition;
      });
    },

    importBragaReturn({ result, actor }) {
      required(actor, "actor");
      const normalized = validateBragaReturn(result);
      const hash = contentHash(normalized);
      const snapshot = state();
      const experiment = snapshot.experiments.find(item => item.id === normalized.experimentId);
      if (!experiment) throw new Error(`experimento não encontrado: ${normalized.experimentId}`);
      if (normalized.spend > 0 && !experiment.spendApproval) throw new Error("gasto não aprovado para o experimento");
      if (normalized.spend > (experiment.spendApproval?.ceiling ?? 0)) throw new Error("gasto excede o teto aprovado");
      const previous = snapshot.bragaReturns.find(item => item.experimentId === normalized.experimentId);
      if (previous) {
        if (previous.hash !== hash) throw new Error(`conflito no retorno do experimento ${normalized.experimentId}`);
        return clone(previous);
      }
      return mutate(current => {
        const currentExperiment = current.experiments.find(item => item.id === normalized.experimentId);
        const evidence = {
          id: makeId("evidence"), thesisId: currentExperiment.thesisId, experimentId: currentExperiment.id,
          observation: `Métricas do canal ${normalized.channel}`,
          inference: normalized.recommendation,
          validation: "channel_metric", polarity: "supporting",
          source: normalized.rawRefs[0], date: normalized.window.endedAt || normalized.window.startedAt,
          sensitivity: "private", synthetic: false, metrics: clone(normalized),
          verification: { decision: "verified", actor, notes: "Importado de retorno Braga validado", at: now() }, createdAt: now(),
        };
        current.evidence.push(evidence);
        currentExperiment.evidenceIds ||= [];
        currentExperiment.evidenceIds.push(evidence.id);
        const imported = {
          id: makeId("braga-return"), experimentId: currentExperiment.id, thesisId: currentExperiment.thesisId,
          hash, evidenceId: evidence.id, metrics: clone(normalized.metrics),
          attributionLimitations: clone(normalized.attributionLimitations), result: clone(normalized), importedAt: now(), importedBy: actor,
        };
        current.bragaReturns.push(imported);
        const acquisition = current.acquisitions.find(item => item.experimentId === currentExperiment.id && item.status === "active");
        if (acquisition) {
          Object.assign(acquisition, {
            status: "completed", completedAt: now(), completedBy: actor,
            reason: "Retorno Braga importado", returnExperimentId: currentExperiment.id,
          });
        }
        return imported;
      });
    },

    gatesFor(thesisId) {
      const snapshot = state();
      const thesis = snapshot.theses.find(candidate => candidate.id === thesisId);
      if (!thesis) throw new Error(`tese não encontrada: ${thesisId}`);
      return evaluateGates(snapshot.evidence.filter(item => item.thesisId === thesisId));
    },

    snapshot() {
      return state();
    },

    getRoom(roomId) {
      return clone(find("rooms", roomId, "room"));
    },

    getThesis(thesisId) {
      return clone(find("theses", thesisId, "tese"));
    },
  };
}
