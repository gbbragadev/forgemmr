import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createLifecycleManager, listLifecycle } from "../control/lifecycle.mjs";

function fixtureRoot(...apps) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-lifecycle-"));
  for (const appId of apps) fs.mkdirSync(path.join(root, "apps", appId, "docs"), { recursive: true });
  return root;
}

function measurement(appId, verdict = "iterate") {
  return {
    appId,
    measuredAt: "2026-07-14T12:00:00.000Z",
    why: "Medição real do primeiro canal.",
    channel: "Instagram",
    daysLive: 7,
    visits: 100,
    activations: 24,
    ctaClicks: 12,
    conversions: 3,
    revenueBrl: 29.7,
    apiCostBrl: 2.1,
    verdict,
  };
}

test("P4 valida schema e persiste artefato comparável + lifecycle atômico", () => {
  const root = fixtureRoot("probe");
  const lifecycle = createLifecycleManager({ root, now: () => Date.parse("2026-07-14T12:30:00.000Z") });
  try {
    assert.throws(() => lifecycle.recordP4({ appId: "probe", visits: -1 }), /P4 inválido/);
    const saved = lifecycle.recordP4(measurement("probe"));
    assert.equal(saved.status, "measured");
    assert.equal(saved.p4.conversions, 3);

    const p4File = path.join(root, "apps", "probe", "docs", "p4-result.json");
    const lifecycleFile = path.join(root, "maestro", "lifecycle", "probe.json");
    assert.equal(JSON.parse(fs.readFileSync(p4File, "utf8")).verdict, "iterate");
    assert.equal(JSON.parse(fs.readFileSync(lifecycleFile, "utf8")).status, "measured");
    assert.equal(fs.existsSync(`${p4File}.tmp`), false);
    assert.equal(fs.existsSync(`${lifecycleFile}.tmp`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("P5 kill aposenta sem remover; iterate inicia feedback; scale só registra", () => {
  const root = fixtureRoot("kill-app", "iterate-app", "scale-app");
  const calls = { feedback: [], remove: 0 };
  const engineManager = {
    startFeedback(input) {
      calls.feedback.push(input);
      return { appId: input.appId, status: "running" };
    },
    removeApp() {
      calls.remove++;
      throw new Error("removeApp nunca deveria ser chamado por P5");
    },
  };
  const lifecycle = createLifecycleManager({ root, engineManager, now: () => Date.parse("2026-07-14T13:00:00.000Z") });
  try {
    for (const appId of ["kill-app", "iterate-app", "scale-app"]) lifecycle.recordP4(measurement(appId));

    const killed = lifecycle.decideP5({ appId: "kill-app", decision: "kill", why: "Sem sinal de compra." });
    assert.equal(killed.status, "retired");
    assert.equal(calls.remove, 0);
    assert.ok(fs.existsSync(path.join(root, "apps", "kill-app")), "aposentar não pode apagar o app");

    const iterated = lifecycle.decideP5({
      appId: "iterate-app",
      decision: "iterate",
      why: "CTA promissor, ativação fraca.",
      feedback: "Simplifique o primeiro valor e teste novo CTA.",
      team: "dry-run",
      dryRun: true,
    });
    assert.equal(iterated.status, "iterating");
    assert.equal(calls.feedback.length, 1);
    assert.equal(calls.feedback[0].feedbackText, "Simplifique o primeiro valor e teste novo CTA.");

    const scaled = lifecycle.decideP5({ appId: "scale-app", decision: "scale", why: "Receita e retenção positivas." });
    assert.equal(scaled.status, "scaling");
    assert.equal(calls.feedback.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("listLifecycle inclui apps ainda não medidos e recupera P4 existente", () => {
  const root = fixtureRoot("fresh-app", "measured-app");
  const lifecycle = createLifecycleManager({ root });
  try {
    lifecycle.recordP4(measurement("measured-app", "scale"));
    const entries = listLifecycle(root);
    assert.deepEqual(entries.map((entry) => entry.appId), ["fresh-app", "measured-app"]);
    assert.equal(entries.find((entry) => entry.appId === "fresh-app").status, "unmeasured");
    assert.equal(entries.find((entry) => entry.appId === "measured-app").p4.verdict, "scale");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
