import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPlaybookService } from "../discovery/playbooks.mjs";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";

const draft = {
  buyer: "síndico", user: "técnico", painfulJob: "provar manutenção", currentAlternative: "planilha",
  reachableSegment: "administradoras", channel: "WhatsApp", fatalAssumption: "pagará", offer: "auditoria",
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-playbooks-"));
  const source = path.resolve("maestro", "discovery", "playbooks");
  const target = path.join(root, "maestro", "discovery", "playbooks");
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(source)) fs.copyFileSync(path.join(source, file), path.join(target, file));
  let sequence = 0;
  const workspace = createDiscoveryWorkspace({
    root,
    engineManager: { start() { return {}; } },
    now: () => "2026-07-18T12:00:00.000Z",
    idFactory: prefix => `${prefix}-${++sequence}`,
  });
  const room = workspace.createRoom({ title: "Playbooks" });
  const thesis = workspace.confirmThesis({
    thesisId: workspace.proposeThesis({ roomId: room.id, sourceMessageIds: [], draft }).id,
    actor: "gui",
  });
  const starts = [];
  const runner = {
    start(input) {
      starts.push(input);
      return { ok: true, runId: `executor-${starts.length}`, playerId: input.playerId };
    },
  };
  const service = createPlaybookService({
    root, runner, workspace,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    idFactory: prefix => `${prefix}-${++sequence}`,
  });
  return { root, workspace, thesis, service, starts };
}

function writeOutput(run, value) {
  fs.writeFileSync(run.outputFile, typeof value === "string" ? value : JSON.stringify(value), "utf8");
}

test("registry carrega cinco playbooks com hashes SHA-256 imutáveis", () => {
  const { service } = fixture();
  const registry = service.list();
  assert.deepEqual(registry.map(item => item.id), [
    "pressure-test", "pain-signal-miner", "first-customer-finder", "startup-user-simulator", "design-audit",
  ]);
  for (const item of registry) assert.match(item.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(service.list(), registry);
});

test("start cria artefatos privados por run e executa via runner", () => {
  const { service, thesis, starts } = fixture();
  const run = service.start({ playbookId: "pressure-test", thesisId: thesis.id, playerId: "claude", input: { idea: "PMOC" } });
  for (const file of ["input.json", "prompt.md", "output.json", "raw.log"]) {
    assert.equal(fs.existsSync(path.join(run.runDir, file)), true, file);
  }
  assert.match(fs.readFileSync(path.join(run.runDir, "prompt.md"), "utf8"), /Write JSON output only/);
  assert.equal(starts[0].scope.kind, "playbook");
  if (process.platform !== "win32") assert.equal(fs.statSync(run.runDir).mode & 0o777, 0o700);
});

test("output inválido causa zero mutações", () => {
  const { service, thesis, workspace } = fixture();
  const run = service.start({ playbookId: "pain-signal-miner", thesisId: thesis.id, playerId: "claude", input: {} });
  const before = workspace.snapshot();
  writeOutput(run, { candidates: [{ url: "javascript:bad", observation: "dor" }] });
  assert.throws(() => service.importOutput({ localRunId: run.localRunId, thesisId: thesis.id }), /url|inference/);
  assert.deepEqual(workspace.snapshot(), before);
});

test("pressure test importa hipótese, risco e metadata imutável", () => {
  const { service, thesis, workspace } = fixture();
  const run = service.start({ playbookId: "pressure-test", thesisId: thesis.id, playerId: "claude", input: {} });
  writeOutput(run, { hypothesis: "síndicos pagam", risk: "ninguém troca a planilha" });
  const [experiment] = service.importOutput({ localRunId: run.localRunId, thesisId: thesis.id });
  assert.equal(experiment.hypothesis, "síndicos pagam");
  assert.equal(experiment.risk, "ninguém troca a planilha");
  assert.equal(experiment.playbookId, "pressure-test");
  assert.equal(experiment.playbookHash, run.playbookHash);
  assert.equal(workspace.snapshot().experiments.length, 1);
});

test("pain e finder importam URLs unverified sem outreach", () => {
  for (const playbookId of ["pain-signal-miner", "first-customer-finder"]) {
    const { service, thesis, workspace } = fixture();
    const run = service.start({ playbookId, thesisId: thesis.id, playerId: "codex", input: {} });
    writeOutput(run, { candidates: [{
      url: "https://example.com/post", observation: "reclamação pública", inference: "há dor",
      polarity: "supporting", date: "2026-07-18", ...(playbookId === "first-customer-finder" ? { suggestedOpening: "Posso entender?" } : {}),
    }] });
    const [evidence] = service.importOutput({ localRunId: run.localRunId, thesisId: thesis.id });
    assert.equal(evidence.verification.decision, "unverified");
    assert.equal(evidence.outreachSent, false);
    assert.equal(evidence.playbookId, playbookId);
    assert.equal(evidence.playbookHash, run.playbookHash);
    assert.equal(workspace.gatesFor(thesis.id).build.ok, false);
  }
});

test("simulator e design audit permanecem synthetic e inelegíveis mesmo com score máximo", () => {
  for (const playbookId of ["startup-user-simulator", "design-audit"]) {
    const { service, thesis, workspace } = fixture();
    const run = service.start({ playbookId, thesisId: thesis.id, playerId: "grok", input: {} });
    writeOutput(run, { findings: [{ observation: "CTA claro", inference: "pode converter", polarity: "supporting", score: 100 }] });
    const [evidence] = service.importOutput({ localRunId: run.localRunId, thesisId: thesis.id });
    assert.equal(evidence.synthetic, true);
    workspace.verifyEvidence({ evidenceId: evidence.id, actor: "gui", decision: "verified" });
    assert.equal(workspace.gatesFor(thesis.id).e2.ok, false);
    assert.equal(workspace.gatesFor(thesis.id).build.ok, false);
  }
});

test("raw log é redigido e revisão cria proposta pendente sem alterar playbook ativo", () => {
  process.env.PLAYBOOK_SECRET = "playbook-secret-123456789";
  try {
    const { service, thesis, root } = fixture();
    const run = service.start({ playbookId: "pressure-test", thesisId: thesis.id, playerId: "claude", input: {} });
    service.appendRawLog({ localRunId: run.localRunId, text: process.env.PLAYBOOK_SECRET });
    assert.doesNotMatch(fs.readFileSync(path.join(run.runDir, "raw.log"), "utf8"), /playbook-secret/);
    const before = service.list().find(item => item.id === "pressure-test").contentHash;
    const proposal = service.proposeRevision({ playbookId: "pressure-test", actor: "gui", content: "# Nova versão", reason: "melhorar risco" });
    assert.equal(proposal.status, "pending_approval");
    assert.notEqual(proposal.proposedHash, proposal.activeHash);
    assert.equal(service.list().find(item => item.id === "pressure-test").contentHash, before);
    assert.equal(fs.existsSync(path.join(root, ".control", "discovery", "playbooks", "revisions", "pressure-test", `${proposal.id}.json`)), true);
  } finally {
    delete process.env.PLAYBOOK_SECRET;
  }
});
