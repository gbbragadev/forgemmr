import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { classifyIntake, createForgeOperator, readIntakeSource } from "../operator.mjs";

test("readIntakeSource accepts inline text, files and folders with a stable digest", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-intake-"));
  fs.writeFileSync(path.join(root, "plan.md"), "# Plano\nUma pipeline de revisão.");
  fs.writeFileSync(path.join(root, ".env"), "SECRET=do-not-read");
  const folder = await readIntakeSource(root, { root });
  assert.match(folder.text, /pipeline de revisão/);
  assert.doesNotMatch(folder.text, /do-not-read/);
  assert.match(folder.digest, /^sha256:[a-f0-9]{64}$/);
  const inline = await readIntakeSource("Uma ideia curta", { root });
  assert.equal(inline.kind, "inline");
});

test("readIntakeSource bloqueia path fora do root e hosts privados", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-intake-safe-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "forge-intake-out-"));
  fs.writeFileSync(path.join(root, "ok.md"), "dentro");
  fs.writeFileSync(path.join(outside, "segredo.md"), "não vaze");
  try {
    await assert.rejects(() => readIntakeSource(path.join(outside, "segredo.md"), { root }), /fora do repositório/i);
    await assert.rejects(() => readIntakeSource("http://127.0.0.1/secret", { root }), /bloqueado/i);
    await assert.rejects(() => readIntakeSource("http://169.254.169.254/latest", { root }), /bloqueado/i);
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("triage never silently changes Forge and flags high-stakes plans for review", () => {
  const own = classifyIntake({
    source: { title: "forge.md", text: "Altere o Forge, crie um blueprint e mude a pipeline." },
    mode: "evolve",
    profiles: [],
    blueprints: [],
  });
  assert.equal(own.intent, "forge_change");
  assert.equal(own.requiresReview, true);
  assert.equal(own.autoStart, false);

  const risky = classifyIntake({
    source: { title: "legal.md", text: "Revisão jurídica com aprovação humana obrigatória e orçamento." },
    profiles: [],
    blueprints: [],
  });
  assert.equal(risky.highStake, true);
  assert.equal(risky.requiresReview, true);
});

test("operator.ingest cria room e proposta sem profile, blueprint ou pipeline", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-operator-"));
  const calls = [];
  const factoryAdmin = {
    listProfiles: () => [],
    listBlueprints: () => [],
    createProfile: () => calls.push("profile"),
    saveBlueprint: () => calls.push("blueprint"),
  };
  const engineManager = { start: () => calls.push("start") };
  const discoveryWorkspace = {
    createRoom: (input) => (calls.push(["room", input]), { id: "room-1" }),
    appendMessage: (input) => (calls.push(["message", input]), { id: "message-1" }),
    proposeThesis: (input) => (calls.push(["thesis", input]), { id: "thesis-1" }),
  };
  const operator = createForgeOperator({ root, factoryAdmin, engineManager, discoveryWorkspace });
  const result = await operator.ingest({ source: "Um app simples de hábitos diários.", approved: true });
  assert.equal(result.roomId, "room-1");
  assert.equal(result.thesisId, "thesis-1");
  assert.equal(result.nextAction, "thesis.confirm");
  assert.equal(calls.some((call) => ["start", "profile", "blueprint"].includes(call)), false);
  assert.ok(fs.existsSync(result.proposalFile));

  calls.length = 0;
  const review = await operator.evolve({ source: "Mude a pipeline interna do Forge.", executor: "codex" });
  assert.equal(review.applied, false);
  assert.equal(calls.length, 0);
});
