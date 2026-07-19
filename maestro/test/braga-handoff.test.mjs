import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { contentHash } from "../discovery/braga-handoff.mjs";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";

const NOW = "2026-07-18T15:00:00.000Z";
const draft = {
  buyer: "síndico",
  user: "técnico de facilities",
  painfulJob: "provar conformidade do PMOC",
  currentAlternative: "planilha",
  reachableSegment: "administradoras de condomínio",
  channel: "WhatsApp",
  fatalAssumption: "pagará pela auditoria",
  offer: "auditoria por R$ 297",
};
const brief = {
  hypothesisToTest: "pagará pela auditoria",
  minimalScope: "landing + formulário",
  capability: "static",
  profile: "pmoc",
  blueprint: "generic",
  channel: "WhatsApp",
  postBuildEvent: { name: "lead_submitted", required: true },
  successCriteria: "2 leads qualificados",
  killCriteria: "0 leads em 7 dias",
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-braga-"));
  let seq = 0;
  const workspace = createDiscoveryWorkspace({
    root,
    now: () => NOW,
    idFactory: prefix => `${prefix}-${++seq}`,
    engineManager: { startFromDiscovery: () => ({ appId: "pmoc-probe", runId: "run-1" }) },
  });
  return { root, workspace };
}

function evidence(workspace, thesisId, validation, polarity = "supporting") {
  const item = workspace.recordEvidence({
    thesisId,
    evidence: {
      observation: `${validation} observado`, inference: "sinal real", validation, polarity,
      source: `https://example.test/${validation}/${polarity}`, date: "2026-07-18", sensitivity: "public",
    },
  });
  workspace.verifyEvidence({ evidenceId: item.id, actor: "gui", decision: "verified" });
  return item;
}

function readyFixture() {
  const fx = fixture();
  const room = fx.workspace.createRoom({ title: "PMOC" });
  const thesis = fx.workspace.confirmThesis({
    thesisId: fx.workspace.proposeThesis({ roomId: room.id, draft, sourceMessageIds: [] }).id,
    actor: "gui",
  });
  const pain = evidence(fx.workspace, thesis.id, "pain");
  const reach = evidence(fx.workspace, thesis.id, "reach");
  const action = evidence(fx.workspace, thesis.id, "action");
  const counter = evidence(fx.workspace, thesis.id, "reach", "contradicting");
  const experiment = fx.workspace.createExperiment({
    thesisId: thesis.id,
    experiment: {
      hypothesis: "síndicos respondem à oferta", method: "outreach manual", audience: "síndicos",
      expectedAction: "responder", successCriteria: "2 respostas", killCriteria: "0 respostas",
      window: "7 dias", costCap: 0,
    },
  });
  const proposal = fx.workspace.proposeBuild({ thesisId: thesis.id, brief, actor: "gui" });
  const build = fx.workspace.startBuild({ thesisId: thesis.id, startOptions: { approved: true }, actor: "gui" });
  fx.workspace.completeBuild({ buildId: build.id, url: "https://pmoc.test", artifact: "out/", instrumentationObserved: true, actor: "gui" });
  return { ...fx, thesis, experiment, proposal, pain, reach, action, counter };
}

function handoffInput(fx) {
  return {
    thesisId: fx.thesis.id,
    experimentId: fx.experiment.id,
    testedMessage: "Posso revisar uma medição PMOC?",
    assets: ["out/"],
    events: [{ name: "lead_submitted" }],
    baseline: { visits: 0, leads: 0 },
    timebox: "7 dias",
    budget: { requested: 0, approved: 0, ceiling: 0 },
    legalRestrictions: ["Não emitir laudo técnico"],
  };
}

function bragaReturn(experimentId, overrides = {}) {
  return {
    schemaVersion: 1,
    experimentId,
    channel: "WhatsApp",
    window: { startedAt: "2026-07-18", endedAt: "2026-07-25" },
    actions: [{ type: "message", count: 10 }],
    spend: 0,
    impressions: null,
    reach: null,
    clicks: null,
    visits: 8,
    leads: 3,
    qualified: 2,
    responses: 4,
    calls: 1,
    registrations: 2,
    activations: 1,
    sales: 0,
    revenue: 0,
    rawRefs: ["local://braga/run-1.json"],
    attributionLimitations: ["Impressões indisponíveis no outreach manual"],
    anomalies: [],
    recommendation: "iterate",
    ...overrides,
  };
}

test("prepare gera contrato canônico validado, JSON e Markdown privados e versionados", () => {
  const fx = readyFixture();
  try {
    const prepared = fx.workspace.prepareBragaHandoff(handoffInput(fx));
    assert.equal(prepared.contract.schemaVersion, 1);
    assert.equal(prepared.contract.handoffVersion, 1);
    assert.equal(prepared.contract.thesisId, fx.thesis.id);
    assert.equal(prepared.contract.appId, "pmoc-probe");
    assert.equal(prepared.contract.icp, draft.reachableSegment);
    assert.equal(prepared.contract.buyer, draft.buyer);
    assert.equal(prepared.contract.user, draft.user);
    assert.equal(prepared.contract.pain, draft.painfulJob);
    assert.equal(prepared.contract.counterevidence.length, 1);
    assert.deepEqual(prepared.contract.evidenceRefs, fx.proposal.evidenceRefs);
    assert.equal(prepared.contract.build.url, "https://pmoc.test");
    assert.equal(prepared.contract.build.instrumented, true);
    assert.match(prepared.markdown, /# Handoff BragaMarketing/);
    assert.deepEqual(JSON.parse(prepared.json), prepared.contract);
    assert.ok(prepared.jsonPath.startsWith(path.join(fx.root, ".control", "discovery", "handoffs")));
    assert.ok(prepared.markdownPath.startsWith(path.join(fx.root, ".control", "discovery", "handoffs")));
    assert.equal(fs.statSync(prepared.jsonPath).isFile(), true);
    assert.equal(fs.statSync(prepared.markdownPath).isFile(), true);
    assert.equal(fx.workspace.snapshot().handoffs.length, 1);
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("JSON canônico ignora ordem de chaves e budget não pode forjar aprovação", () => {
  assert.equal(contentHash({ b: 2, a: { d: 4, c: 3 } }), contentHash({ a: { c: 3, d: 4 }, b: 2 }));
  const fx = readyFixture();
  try {
    assert.throws(
      () => fx.workspace.prepareBragaHandoff({ ...handoffInput(fx), budget: { requested: 50, approved: 50, ceiling: 50 } }),
      /budget.*aprova|permanecer zero/i,
    );
    assert.throws(
      () => fx.workspace.approveSpend({ experimentId: fx.experiment.id, requested: 50, ceiling: 40, actor: "gui", why: "" }),
      /why/i,
    );
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("export é explícito, fica dentro do root e rejeita traversal e BragaMarketing externo", () => {
  const fx = readyFixture();
  try {
    const prepared = fx.workspace.prepareBragaHandoff(handoffInput(fx));
    const target = "exports/pmoc-braga.json";
    const exported = fx.workspace.exportBragaHandoff({ handoffId: prepared.id, target, actor: "gui" });
    assert.equal(exported.path, path.join(fx.root, target));
    assert.deepEqual(JSON.parse(fs.readFileSync(exported.path, "utf8")), prepared.contract);
    assert.throws(() => fx.workspace.exportBragaHandoff({ handoffId: prepared.id, target: "../fora.json", actor: "gui" }), /root|caminho|traversal/i);
    assert.throws(() => fx.workspace.exportBragaHandoff({ handoffId: prepared.id, target: "C:\\projects\\BragaMarketing\\handoff.json", actor: "gui" }), /root|caminho|externo/i);
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("acquisition.start exige E2, build concluído instrumentado e mantém WIP global 1", () => {
  const early = fixture();
  const ready = readyFixture();
  try {
    const room = early.workspace.createRoom({ title: "cedo" });
    const thesis = early.workspace.confirmThesis({ thesisId: early.workspace.proposeThesis({ roomId: room.id, draft, sourceMessageIds: [] }).id, actor: "gui" });
    assert.throws(() => early.workspace.startAcquisition({ thesisId: thesis.id, experimentId: "exp-x", actor: "gui" }), /E2|action|build/i);
    const first = ready.workspace.startAcquisition({ thesisId: ready.thesis.id, experimentId: ready.experiment.id, actor: "gui" });
    assert.equal(first.status, "active");
    const secondRoom = ready.workspace.createRoom({ title: "segunda" });
    const second = ready.workspace.confirmThesis({ thesisId: ready.workspace.proposeThesis({ roomId: secondRoom.id, draft, sourceMessageIds: [] }).id, actor: "gui" });
    evidence(ready.workspace, second.id, "pain"); evidence(ready.workspace, second.id, "reach"); evidence(ready.workspace, second.id, "action");
    assert.throws(() => ready.workspace.startAcquisition({ thesisId: second.id, experimentId: ready.experiment.id, actor: "gui" }), /WIP.*aquisição/);
  } finally { fs.rmSync(early.root, { recursive: true, force: true }); fs.rmSync(ready.root, { recursive: true, force: true }); }
});

test("spend.approve é positivo, exato e isolado por experimento; zero não cria aprovação", () => {
  const fx = readyFixture();
  try {
    assert.throws(() => fx.workspace.approveSpend({ experimentId: fx.experiment.id, requested: 0, ceiling: 0, actor: "gui" }), /positivo|zero/i);
    assert.equal(fx.workspace.snapshot().experiments[0].spendApproval, undefined);
    const approval = fx.workspace.approveSpend({ experimentId: fx.experiment.id, requested: 50, ceiling: 40, actor: "gui", why: "Teste controlado" });
    assert.deepEqual(approval, { requested: 50, approved: 40, ceiling: 40, approvedAt: NOW, actor: "gui", why: "Teste controlado" });
    const other = fx.workspace.createExperiment({ thesisId: fx.thesis.id, experiment: { hypothesis: "h2", method: "manual", audience: "a", expectedAction: "reply", successCriteria: "1", killCriteria: "0", window: "3d", costCap: 0 } });
    assert.equal(fx.workspace.snapshot().experiments.find(item => item.id === other.id).spendApproval, undefined);
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("retorno preserva atribuição incompleta, deriva só o calculável e vira channel_metric ligado", () => {
  const fx = readyFixture();
  try {
    const imported = fx.workspace.importBragaReturn({ result: bragaReturn(fx.experiment.id), actor: "gui" });
    assert.equal(imported.metrics.cpa, null);
    assert.equal(imported.metrics.cac, null);
    assert.equal(imported.metrics.roi, null);
    assert.deepEqual(imported.attributionLimitations, ["Impressões indisponíveis no outreach manual"]);
    const metric = fx.workspace.snapshot().evidence.find(item => item.id === imported.evidenceId);
    assert.equal(metric.validation, "channel_metric");
    assert.equal(metric.experimentId, fx.experiment.id);
    assert.equal(metric.verification.decision, "verified");
    assert.ok(fx.workspace.snapshot().experiments.find(item => item.id === fx.experiment.id).evidenceIds.includes(metric.id));
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("gasto importado exige aprovação do experimento e respeita o teto exato", () => {
  const fx = readyFixture();
  try {
    assert.throws(() => fx.workspace.importBragaReturn({ result: bragaReturn(fx.experiment.id, { spend: 10 }), actor: "gui" }), /gasto não aprovado/i);
    fx.workspace.approveSpend({ experimentId: fx.experiment.id, requested: 20, ceiling: 15, actor: "gui", why: "Teste limitado" });
    assert.throws(() => fx.workspace.importBragaReturn({ result: bragaReturn(fx.experiment.id, { spend: 16 }), actor: "gui" }), /teto/i);
    assert.doesNotThrow(() => fx.workspace.importBragaReturn({ result: bragaReturn(fx.experiment.id, { spend: 15 }), actor: "gui" }));
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("retorno importado conclui aquisição com auditoria e libera WIP", () => {
  const fx = readyFixture();
  try {
    const acquisition = fx.workspace.startAcquisition({ thesisId: fx.thesis.id, experimentId: fx.experiment.id, actor: "gui" });
    fx.workspace.importBragaReturn({ result: bragaReturn(fx.experiment.id), actor: "gui" });
    const completed = fx.workspace.snapshot().acquisitions.find(item => item.id === acquisition.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.completedBy, "gui");
    assert.equal(completed.returnExperimentId, fx.experiment.id);
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});

test("import duplicado idêntico é idempotente e payload divergente conflita", () => {
  const fx = readyFixture();
  try {
    fx.workspace.approveSpend({ experimentId: fx.experiment.id, requested: 30, ceiling: 30, actor: "gui", why: "Teste controlado" });
    const payload = bragaReturn(fx.experiment.id, { spend: 30, sales: 2, revenue: 120, leads: 4 });
    const first = fx.workspace.importBragaReturn({ result: payload, actor: "gui" });
    const same = fx.workspace.importBragaReturn({ result: structuredClone(payload), actor: "outro" });
    assert.equal(same.id, first.id);
    assert.equal(fx.workspace.snapshot().bragaReturns.length, 1);
    assert.equal(fx.workspace.snapshot().evidence.filter(item => item.validation === "channel_metric").length, 1);
    assert.throws(() => fx.workspace.importBragaReturn({ result: { ...payload, leads: 5 }, actor: "gui" }), /conflito/i);
  } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
});
