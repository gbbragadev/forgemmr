import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createLifecycleManager } from "../control/lifecycle.mjs";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";
import { createPlaybookService } from "../discovery/playbooks.mjs";
import { createMaestroServer } from "../server.mjs";

const NOW = "2026-07-18T18:00:00.000Z";
const draft = {
  buyer: "síndico", user: "técnico", painfulJob: "provar manutenção", currentAlternative: "planilha",
  reachableSegment: "administradoras", channel: "WhatsApp", fatalAssumption: "pagará", offer: "auditoria",
};
const brief = {
  hypothesisToTest: "pagará por auditoria", minimalScope: "landing + formulário", capability: "static",
  profile: "pmoc", blueprint: "generic", channel: "WhatsApp",
  postBuildEvent: { name: "lead_submitted", required: true }, successCriteria: "2 leads", killCriteria: "0 leads em 7d",
};

class Stream extends EventEmitter {}
class Child extends EventEmitter {
  constructor() { super(); this.pid = 42; this.stdout = new Stream(); this.stderr = new Stream(); }
  kill() {}
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

function thesis(workspace, title) {
  const room = workspace.createRoom({ title });
  return workspace.confirmThesis({
    thesisId: workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [], draft }).id,
    actor: "gui",
  });
}

function experiment(workspace, thesisId, hypothesis = "síndicos respondem") {
  return workspace.createExperiment({ thesisId, experiment: {
    hypothesis, method: "outreach manual", audience: "síndicos", expectedAction: "responder",
    successCriteria: "2 respostas", killCriteria: "0 respostas", window: "7 dias", costCap: 0,
  } });
}

function verifiedEvidence(workspace, thesisId, validation, source = `https://example.test/${validation}`) {
  const item = workspace.recordEvidence({ thesisId, evidence: {
    observation: `${validation} observado`, inference: "sinal real", validation, polarity: "supporting",
    source, date: "2026-07-18", sensitivity: "public", synthetic: false,
  } });
  workspace.verifyEvidence({ evidenceId: item.id, actor: "gui", decision: "verified" });
  return item;
}

function writeOutput(run, output) {
  fs.writeFileSync(run.outputFile, JSON.stringify(output), "utf8");
}

function p4(appId, thesisId, experimentId, evidenceRefs, verdict) {
  return {
    appId, measuredAt: NOW, why: "Medição real do canal.", channel: "WhatsApp", daysLive: 7,
    visits: 20, activations: 5, ctaClicks: 4, conversions: 2, revenueBrl: 100, apiCostBrl: 0,
    verdict, thesisId, experimentId, evidenceRefs,
  };
}

function bragaReturn(experimentId) {
  return {
    schemaVersion: 1, experimentId, channel: "WhatsApp",
    window: { startedAt: "2026-07-18", endedAt: "2026-07-25" }, actions: [{ type: "message", count: 10 }],
    spend: 0, impressions: null, reach: 10, clicks: null, visits: 8, leads: 3, qualified: 2,
    responses: 4, calls: 1, registrations: 2, activations: 1, sales: 1, revenue: 297,
    rawRefs: ["local://braga/e2e.json"], attributionLimitations: ["Outreach manual"], anomalies: [], recommendation: "iterate",
  };
}

test("discovery-first percorre chat, prova, build, Braga e P5 com WIP, restart e stale protegidos", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-e2e-"));
  const playbookSource = path.resolve("maestro", "discovery", "playbooks");
  const playbookTarget = path.join(root, "maestro", "discovery", "playbooks");
  fs.mkdirSync(playbookTarget, { recursive: true });
  for (const file of fs.readdirSync(playbookSource)) fs.copyFileSync(path.join(playbookSource, file), path.join(playbookTarget, file));
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({ players: [
    { id: "claude", adapter: "fake", cli: "claude", model: "sonnet" },
    { id: "codex", adapter: "fake", cli: "codex", model: "sol" },
    { id: "grok", adapter: "fake", cli: "grok", model: "grok" },
  ], teams: {} }));

  let sequence = 0;
  const starts = [];
  const engineManager = {
    snapshot: () => ({}), cooldowns: () => ({}), start: () => null,
    startFromDiscovery(input) { starts.push(structuredClone(input)); return { appId: `app-${starts.length}`, runId: `run-${starts.length}` }; },
    startFeedback: input => ({ appId: input.appId, status: "running" }),
    decide: () => null, stop: () => ({ ok: true }), resume: () => null, setTarget: () => null, kill: () => null, removeApp: () => null,
  };
  const workspace = createDiscoveryWorkspace({ root, engineManager, now: () => NOW, idFactory: prefix => `${prefix}-${++sequence}` });
  const children = [];
  const prompts = [];
  const server = createMaestroServer({ root, engineManager, discoveryWorkspace: workspace, spawnImpl: (_command, args) => {
    const child = new Child(); children.push(child); prompts.push(args.at(-1)); return child;
  } });
  t.after(() => new Promise(resolve => server.close(() => { fs.rmSync(root, { recursive: true, force: true }); resolve(); })));
  const base = await listen(server);
  const token = (await (await fetch(`${base}/api/token`)).json()).token;
  const headers = { "content-type": "application/json", "x-maestro-token": token };
  async function execute(actionId, input, key, stateVersion) {
    const version = stateVersion || (await (await fetch(`${base}/api/control/snapshot`)).json()).version;
    const response = await fetch(`${base}/api/control/actions/execute`, {
      method: "POST", headers, body: JSON.stringify({ actionId, input, stateVersion: version, idempotencyKey: key }),
    });
    return { response, body: await response.json() };
  }

  const roomResult = await execute("room.create", { title: "Discovery E2E" }, "e2e-room");
  const roomId = roomResult.body.result.id;
  for (const [index, playerId] of ["claude", "codex", "grok"].entries()) {
    const sent = await execute("chat.send", { roomId, text: `turno-${index + 1}`, playerId, maxTurns: 1 }, `e2e-chat-${index}`);
    assert.equal(sent.response.status, 200);
    if (index) assert.match(prompts[index], new RegExp(`resposta-${index}`));
    children[index].stdout.emit("data", `resposta-${index + 1}`);
    children[index].emit("close", 0);
  }
  const room = workspace.getRoom(roomId);
  assert.deepEqual(room.messages.filter(item => item.author === "assistant").map(item => item.executor.playerId), ["claude", "codex", "grok"]);

  const main = workspace.confirmThesis({
    thesisId: workspace.proposeThesis({ roomId, sourceMessageIds: room.messages.map(item => item.id), draft }).id,
    actor: "gui",
  });
  const playbook = createPlaybookService({
    root, workspace, runner: { start: input => ({ ok: true, runId: `fake-${input.scope.localRunId}`, playerId: input.playerId }) },
    now: () => new Date(NOW), idFactory: prefix => `${prefix}-${++sequence}`,
  });
  const pressureRun = playbook.start({ playbookId: "pressure-test", thesisId: main.id, playerId: "claude", input: {} });
  writeOutput(pressureRun, { hypothesis: "síndicos pagam", risk: "ninguém troca a planilha" });
  const [mainExperiment] = playbook.importOutput({ localRunId: pressureRun.localRunId, thesisId: main.id });
  const painRun = playbook.start({ playbookId: "pain-signal-miner", thesisId: main.id, playerId: "codex", input: {} });
  writeOutput(painRun, { candidates: [{ url: "https://example.test/dor", observation: "dor pública", inference: "dor recorrente", polarity: "supporting", date: "2026-07-18" }] });
  const [pain] = playbook.importOutput({ localRunId: painRun.localRunId, thesisId: main.id });
  const finderRun = playbook.start({ playbookId: "first-customer-finder", thesisId: main.id, playerId: "grok", input: {} });
  writeOutput(finderRun, { candidates: [{ url: "https://example.test/acao", observation: "pedido de proposta", inference: "ação real", polarity: "supporting", date: "2026-07-18", suggestedOpening: "Posso entender?" }] });
  const [action] = playbook.importOutput({ localRunId: finderRun.localRunId, thesisId: main.id });
  const syntheticRun = playbook.start({ playbookId: "startup-user-simulator", thesisId: main.id, playerId: "grok", input: {} });
  writeOutput(syntheticRun, { findings: [{ observation: "score máximo", inference: "converteria", polarity: "supporting", score: 100 }] });
  const [synthetic] = playbook.importOutput({ localRunId: syntheticRun.localRunId, thesisId: main.id });
  workspace.verifyEvidence({ evidenceId: synthetic.id, actor: "gui", decision: "verified" });
  assert.equal(workspace.gatesFor(main.id).e2.ok, false, "score sintético não abre E2");
  workspace.verifyEvidence({ evidenceId: pain.id, actor: "gui", decision: "verified" });
  workspace.verifyEvidence({ evidenceId: action.id, actor: "gui", decision: "verified" });
  const reach = verifiedEvidence(workspace, main.id, "reach");
  assert.equal(workspace.gatesFor(main.id).build.ok, true);

  const validating = [];
  for (let index = 0; index < 4; index++) {
    const candidate = thesis(workspace, `WIP ${index}`);
    const candidateExperiment = experiment(workspace, candidate.id, `hipótese ${index}`);
    validating.push({ candidate, candidateExperiment });
    if (index < 3) workspace.startValidation({ thesisId: candidate.id, experimentId: candidateExperiment.id, actor: "gui" });
  }
  assert.throws(() => workspace.startValidation({ thesisId: validating[3].candidate.id, experimentId: validating[3].candidateExperiment.id, actor: "gui" }), /WIP de validação 3/);
  for (const item of validating.slice(0, 3)) workspace.completeExperiment({ experimentId: item.candidateExperiment.id, interpretation: "encerrado", decision: "iterate" });
  workspace.startValidation({ thesisId: main.id, experimentId: mainExperiment.id, actor: "gui" });

  workspace.proposeBuild({ thesisId: main.id, brief, actor: "gui" });
  const mainBuild = workspace.startBuild({ thesisId: main.id, startOptions: { approved: true }, actor: "gui" });
  const restarted = createDiscoveryWorkspace({ root, engineManager });
  assert.equal(restarted.startBuild({ thesisId: main.id, startOptions: { approved: true }, actor: "gui" }).id, mainBuild.id);
  assert.equal(starts.length, 1, "restart não duplica start");

  const second = thesis(workspace, "Segundo build");
  verifiedEvidence(workspace, second.id, "pain"); verifiedEvidence(workspace, second.id, "reach"); verifiedEvidence(workspace, second.id, "action");
  const secondExperiment = experiment(workspace, second.id);
  workspace.proposeBuild({ thesisId: second.id, brief, actor: "gui" });
  assert.throws(() => workspace.startBuild({ thesisId: second.id, startOptions: { approved: true }, actor: "gui" }), /WIP de build 1/);
  workspace.completeBuild({ buildId: mainBuild.id, url: "https://main.test", artifact: "out/", instrumentationObserved: true, actor: "gui" });
  const secondBuild = workspace.startBuild({ thesisId: second.id, startOptions: { approved: true }, actor: "gui" });
  workspace.completeBuild({ buildId: secondBuild.id, url: "https://second.test", instrumentationObserved: true, actor: "gui" });

  const prepared = workspace.prepareBragaHandoff({
    thesisId: main.id, experimentId: mainExperiment.id, testedMessage: "Posso revisar sua manutenção?", assets: ["out/"],
    events: [{ name: "lead_submitted" }], baseline: { visits: 0, leads: 0 }, timebox: "7 dias",
    budget: { requested: 0, approved: 0, ceiling: 0 }, legalRestrictions: ["Não emitir laudo"],
  });
  assert.equal(prepared.contract.appId, "app-1");
  assert.throws(() => workspace.importBragaReturn({ result: { ...bragaReturn(mainExperiment.id), spend: 10 }, actor: "gui" }), /gasto não aprovado/);
  const acquisition = workspace.startAcquisition({ thesisId: main.id, experimentId: mainExperiment.id, actor: "gui" });
  assert.equal(acquisition.status, "active");
  assert.throws(() => workspace.startAcquisition({ thesisId: second.id, experimentId: secondExperiment.id, actor: "gui" }), /WIP de aquisição 1/);
  const imported = workspace.importBragaReturn({ result: bragaReturn(mainExperiment.id), actor: "gui" });
  workspace.completeExperiment({ experimentId: mainExperiment.id, evidenceIds: [pain.id, reach.id, action.id, imported.evidenceId], interpretation: "Sinal real, testar nova mensagem", decision: "iterate" });

  for (const appId of ["app-1", "scale-app"]) fs.mkdirSync(path.join(root, "apps", appId, "docs"), { recursive: true });
  const lifecycle = createLifecycleManager({ root, engineManager, discoveryWorkspace: workspace, now: () => Date.parse(NOW) });
  lifecycle.recordP4(p4("app-1", main.id, mainExperiment.id, [imported.evidenceId], "iterate"));
  const iterated = lifecycle.decideP5({
    appId: "app-1", decision: "iterate", why: "Oferta respondeu, ativação pode melhorar.", feedback: "Teste nova mensagem.",
    nextHypothesis: "Uma prova curta aumenta ativação.", team: "dry-run", dryRun: true,
  });
  assert.equal(iterated.nextAction.hypothesis, "Uma prova curta aumenta ativação.");

  const scaleThesis = thesis(workspace, "Scale ready");
  const economic = verifiedEvidence(workspace, scaleThesis.id, "economic");
  const scaleExperiment = experiment(workspace, scaleThesis.id, "economia repetível");
  workspace.completeExperiment({ experimentId: scaleExperiment.id, evidenceIds: [economic.id], interpretation: "CAC positivo", decision: "scale" });
  lifecycle.recordP4(p4("scale-app", scaleThesis.id, scaleExperiment.id, [economic.id], "scale"));
  const scaled = lifecycle.decideP5({ appId: "scale-app", decision: "scale", why: "E3 e economia positivos.", ceiling: 100, measurementDate: "2026-08-01" });
  assert.deepEqual(scaled.nextAction, { type: "scale_acquisition", ceiling: 100, measurementDate: "2026-08-01" });

  const staleVersion = (await (await fetch(`${base}/api/control/snapshot`)).json()).version;
  workspace.createRoom({ title: "muda versão" });
  const stale = await execute("room.create", { title: "stale" }, "e2e-stale", staleVersion);
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.code, "state_stale");
  assert.match(stale.body.error, /estado da central mudou/i);
});
