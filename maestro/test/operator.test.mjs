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
  const folder = await readIntakeSource(root);
  assert.match(folder.text, /pipeline de revisão/);
  assert.doesNotMatch(folder.text, /do-not-read/);
  assert.match(folder.digest, /^sha256:[a-f0-9]{64}$/);
  const inline = await readIntakeSource("Uma ideia curta");
  assert.equal(inline.kind, "inline");
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

test("operator applies only a safe approved intake and preserves the decision artifact", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-operator-"));
  const calls = [];
  const factoryAdmin = {
    listProfiles: () => [],
    listBlueprints: () => [],
    createProfile: (input) => (calls.push(["profile", input]), { slug: "habit-tracker" }),
    saveBlueprint: (input) => (calls.push(["blueprint", input]), { id: "habit-tracker" }),
  };
  const engineManager = { start: (input) => (calls.push(["start", input]), { appId: "habit-tracker" }) };
  const operator = createForgeOperator({ root, factoryAdmin, engineManager });
  const result = await operator.ingest({
    source: "Um app simples de hábitos diários com progresso visual.",
    team: "grok-solo",
    approved: true,
  });
  assert.equal(result.applied, true);
  assert.ok(calls.some(([kind]) => kind === "start"));
  assert.ok(fs.existsSync(result.proposalFile));

  calls.length = 0;
  const review = await operator.evolve({ source: "Mude a pipeline interna do Forge.", executor: "codex" });
  assert.equal(review.applied, false);
  assert.equal(calls.length, 0);
});
