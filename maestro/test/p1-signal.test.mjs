import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager } from "../engine.mjs";

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-p1-signal-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "fake", name: "Fake", cli: "fake", model: "default", jobs: [], roles: [] }],
      teams: { "dry-run": { dispatch: { default: "fake" }, fallbacks: {} } },
    }),
    "utf8"
  );
  return root;
}

async function waitForGate(manager, appId, expected, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pipeline = manager.snapshot()[appId];
    const gate = pipeline?.gates.find((candidate) => !candidate.decision);
    if (pipeline?.status === "paused_gate" && gate) {
      assert.equal(gate.id, expected);
      return pipeline;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout esperando gate ${expected}`);
}

async function passPreP1Gates(manager, appId) {
  await waitForGate(manager, appId, "p0-go");
  manager.decide(appId, "p0-go", "go");
  await waitForGate(manager, appId, "foundation-review");
  manager.decide(appId, "foundation-review", "go");
  await waitForGate(manager, appId, "ds-pick");
  manager.decide(appId, "ds-pick", "1");
}

test("GO condicionado pausa em p1-signal depois do conteúdo e antes do build", async () => {
  const root = tmpRoot();
  const appId = "conditional-app";
  try {
    const manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "quiz GO condicionado a sinal do fake-door", team: "dry-run", capability: "quiz", appId });
    await passPreP1Gates(manager, appId);

    const pipeline = await waitForGate(manager, appId, "p1-signal");
    assert.equal(pipeline.history.find((entry) => entry.job === "L0/P1")?.pass, true);
    assert.equal(pipeline.history.some((entry) => entry.job === "L1/B1"), false);
    assert.deepEqual(pipeline.gates.find((gate) => !gate.decision)?.choices, ["go", "kill"]);

    manager.decide(appId, "p1-signal", "go");
    const afterSignal = await waitForGate(manager, appId, "b3-visual");
    assert.equal(afterSignal.history.find((entry) => entry.job === "L1/B1")?.pass, true);
    manager.stop(appId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("GO simples continua depois do P1 sem criar p1-signal", async () => {
  const root = tmpRoot();
  const appId = "simple-go-app";
  try {
    const manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "quiz semanal de abertura de anime", team: "dry-run", capability: "quiz", appId });
    await passPreP1Gates(manager, appId);

    const pipeline = await waitForGate(manager, appId, "b3-visual");
    assert.equal(pipeline.history.find((entry) => entry.job === "L0/P1")?.pass, true);
    assert.equal(pipeline.history.find((entry) => entry.job === "L1/B1")?.pass, true);
    assert.equal(pipeline.gates.some((gate) => gate.id === "p1-signal"), false);

    manager.stop(appId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
