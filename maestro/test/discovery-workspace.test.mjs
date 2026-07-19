import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-"));
  let sequence = 0;
  const starts = [];
  const workspace = createDiscoveryWorkspace({
    root,
    engineManager: {
      startFromDiscovery(options) {
        starts.push(options);
        return { appId: `app-${starts.length}`, runId: `run-${starts.length}` };
      },
    },
    now: () => "2026-07-18T12:00:00.000Z",
    idFactory: prefix => `${prefix}-${++sequence}`,
  });
  return { root, workspace, starts };
}

const thesisDraft = {
  buyer: "síndico",
  user: "técnico",
  painfulJob: "provar manutenção",
  currentAlternative: "planilha",
  reachableSegment: "administradoras",
  channel: "WhatsApp",
  fatalAssumption: "pagará pela auditoria",
  offer: "auditoria PMOC",
};

const evidenceInput = (validation, overrides = {}) => ({
  observation: `${validation} observado`,
  inference: "há sinal",
  validation,
  polarity: "supporting",
  source: `https://example.com/${validation}`,
  date: "2026-07-18",
  sensitivity: "public",
  synthetic: false,
  ...overrides,
});

const buildBrief = {
  hypothesisToTest: "síndicos pagam pela auditoria",
  minimalScope: "landing",
  capability: "static",
  profile: "pmoc",
  blueprint: "generic",
  channel: "WhatsApp",
  postBuildEvent: { name: "lead_submitted", required: true },
  successCriteria: "duas leads",
  killCriteria: "zero leads",
};

const experimentInput = overrides => ({
  hypothesis: "síndicos respondem à oferta",
  method: "entrevista",
  audience: "síndicos",
  expectedAction: "agendar call",
  successCriteria: "duas calls",
  killCriteria: "zero calls",
  window: "7d",
  costCap: 0,
  ...overrides,
});

function createConfirmedThesis(workspace, title = "PMOC") {
  const room = workspace.createRoom({ title, sourceRef: "manual" });
  const proposal = workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [], draft: thesisDraft });
  assert.equal(proposal.stage, "proposed");
  return workspace.confirmThesis({ thesisId: proposal.id, actor: "gui" });
}

function addVerifiedEvidence(workspace, thesisId, validation, overrides) {
  const recorded = workspace.recordEvidence({ thesisId, evidence: evidenceInput(validation, overrides) });
  return workspace.verifyEvidence({ evidenceId: recorded.id, actor: "gui", decision: "verified", notes: "fonte conferida" });
}

test("tese exige promoção humana explícita e registra entidades completas", () => {
  const { workspace } = fixture();
  const room = workspace.createRoom({ title: "PMOC", sourceRef: "manual" });
  const message = workspace.appendMessage({
    roomId: room.id,
    author: "human",
    text: "Existe uma dor real",
    executor: { provider: "claude", model: "sol" },
    refs: ["source-1"],
  });
  const thesis = workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [message.id], draft: thesisDraft });

  assert.equal(thesis.stage, "proposed");
  assert.deepEqual(workspace.getRoom(room.id).messages[0].executor, { provider: "claude", model: "sol" });
  assert.throws(
    () => workspace.startValidation({ thesisId: thesis.id, experimentId: "experiment-x", actor: "gui" }),
    /confirmada/,
  );
  assert.equal(workspace.confirmThesis({ thesisId: thesis.id, actor: "gui" }).stage, "confirmed");
  assert.throws(
    () => workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [], draft: { buyer: "x" } }),
    /thesis\.(user|painfulJob)/,
  );
});

test("E1, E2 e E3 usam somente evidência externa verificada e preservam contradições", () => {
  const { workspace } = fixture();
  const thesis = createConfirmedThesis(workspace);

  addVerifiedEvidence(workspace, thesis.id, "pain");
  addVerifiedEvidence(workspace, thesis.id, "reach");
  assert.equal(workspace.gatesFor(thesis.id).e1.ok, true);
  assert.equal(workspace.gatesFor(thesis.id).e2.ok, false);

  addVerifiedEvidence(workspace, thesis.id, "action", { synthetic: true });
  assert.equal(workspace.gatesFor(thesis.id).e2.ok, false);

  addVerifiedEvidence(workspace, thesis.id, "action");
  addVerifiedEvidence(workspace, thesis.id, "economic");
  const contradiction = addVerifiedEvidence(workspace, thesis.id, "pain", { polarity: "contradicting" });
  const gates = workspace.gatesFor(thesis.id);

  assert.equal(gates.e1.ok, true);
  assert.equal(gates.e2.ok, true);
  assert.equal(gates.e3.ok, true);
  assert.equal(gates.build.ok, true);
  assert.equal(workspace.getThesis(thesis.id).evidenceIds.includes(contradiction.id), true);
  assert.deepEqual(Object.keys(gates.e1).sort(), ["evidenceRefs", "ok", "unmet"]);
  assert.equal("score" in gates.e1, false);
});

test("WIP bloqueia quarta validação, segundo build e segunda aquisição preservando a tese", () => {
  const { workspace, starts } = fixture();
  const items = Array.from({ length: 4 }, (_, index) => {
    const thesis = createConfirmedThesis(workspace, `Tese ${index + 1}`);
    const experiment = workspace.createExperiment({ thesisId: thesis.id, experiment: experimentInput() });
    return { thesis, experiment };
  });

  for (const item of items.slice(0, 3)) {
    workspace.startValidation({ thesisId: item.thesis.id, experimentId: item.experiment.id, actor: "gui" });
  }
  assert.throws(
    () => workspace.startValidation({ thesisId: items[3].thesis.id, experimentId: items[3].experiment.id, actor: "gui" }),
    /WIP.*3/,
  );
  assert.equal(workspace.getThesis(items[3].thesis.id).stage, "confirmed");

  for (const validation of ["pain", "reach", "action"]) {
    addVerifiedEvidence(workspace, items[0].thesis.id, validation);
  }
  workspace.proposeBuild({
    thesisId: items[0].thesis.id,
    brief: buildBrief,
    actor: "gui",
  });
  const firstBuild = workspace.startBuild({ thesisId: items[0].thesis.id, startOptions: { approved: true }, actor: "gui" });
  workspace.completeBuild({ buildId: firstBuild.id, url: "https://wip.test", instrumentationObserved: true, actor: "gui" });
  assert.equal(starts.length, 1);
  const repeatedBuild = workspace.startBuild({
    thesisId: items[0].thesis.id,
    startOptions: { approved: true },
    actor: "gui",
  });
  assert.equal(repeatedBuild.thesisId, items[0].thesis.id);
  assert.equal(starts.length, 1, "retry idempotente não inicia o engine novamente");

  workspace.reserveAcquisition({ thesisId: items[0].thesis.id, actor: "gui" });
  addVerifiedEvidence(workspace, items[1].thesis.id, "action");
  assert.throws(
    () => workspace.reserveAcquisition({ thesisId: items[1].thesis.id, actor: "gui" }),
    /WIP.*aquisição/,
  );
});

test("WIP de validação conta teses distintas, não experimentos da mesma tese", () => {
  const { workspace } = fixture();
  const theses = Array.from({ length: 4 }, (_, index) => createConfirmedThesis(workspace, `WIP ${index}`));
  const firstA = workspace.createExperiment({ thesisId: theses[0].id, experiment: experimentInput() });
  const firstB = workspace.createExperiment({ thesisId: theses[0].id, experiment: experimentInput({ method: "concierge" }) });
  workspace.startValidation({ thesisId: theses[0].id, experimentId: firstA.id, actor: "gui" });
  workspace.startValidation({ thesisId: theses[0].id, experimentId: firstB.id, actor: "gui" });

  for (const thesis of theses.slice(1, 3)) {
    const experiment = workspace.createExperiment({ thesisId: thesis.id, experiment: experimentInput() });
    workspace.startValidation({ thesisId: thesis.id, experimentId: experiment.id, actor: "gui" });
  }
  const fourth = workspace.createExperiment({ thesisId: theses[3].id, experiment: experimentInput() });
  assert.throws(
    () => workspace.startValidation({ thesisId: theses[3].id, experimentId: fourth.id, actor: "gui" }),
    /WIP.*3/,
  );
  assert.equal(workspace.snapshot().experiments.filter(item => item.status === "running").length, 4);
});

test("build exige promoção humana e WIP global bloqueia antes de chamar engine", () => {
  const { workspace, starts } = fixture();
  const room = workspace.createRoom({ title: "Sem promoção" });
  const proposed = workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [], draft: thesisDraft });
  for (const validation of ["pain", "reach", "action"]) addVerifiedEvidence(workspace, proposed.id, validation);
  assert.throws(
    () => workspace.proposeBuild({ thesisId: proposed.id, brief: buildBrief, actor: "gui" }),
    /confirmada/,
  );

  const first = workspace.confirmThesis({ thesisId: proposed.id, actor: "gui" });
  const second = createConfirmedThesis(workspace, "Segundo build");
  for (const validation of ["pain", "reach", "action"]) addVerifiedEvidence(workspace, second.id, validation);
  for (const thesis of [first, second]) {
    workspace.proposeBuild({ thesisId: thesis.id, brief: buildBrief, actor: "gui" });
  }
  workspace.startBuild({ thesisId: first.id, startOptions: { approved: true }, actor: "gui" });
  assert.throws(
    () => workspace.startBuild({ thesisId: second.id, startOptions: { approved: true }, actor: "gui" }),
    /WIP.*build/,
  );
  assert.equal(starts.length, 1);
});

test("experimento congela o contrato e gasto exige aprovação separada", () => {
  const { workspace } = fixture();
  const thesis = createConfirmedThesis(workspace);

  assert.throws(
    () => workspace.createExperiment({ thesisId: thesis.id, experiment: experimentInput({ method: "ads", costCap: 10 }) }),
    /gasto.*aprovação/i,
  );

  const input = experimentInput();
  const experiment = workspace.createExperiment({ thesisId: thesis.id, experiment: input });
  input.hypothesis = "mudou depois";
  assert.equal(workspace.snapshot().experiments[0].hypothesis, "síndicos respondem à oferta");
  assert.equal(experiment.status, "draft");
});
