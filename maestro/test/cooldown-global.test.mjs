import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager } from "../engine.mjs";

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-cooldown-global-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [
        { id: "p1", face: "1", name: "P1", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] },
        { id: "p2", face: "2", name: "P2", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] },
      ],
      teams: {
        fallback: { emoji: "f", label: "fallback", dispatch: { default: "p1" }, fallbacks: { p1: ["p2"] } },
        solo: { emoji: "s", label: "solo", dispatch: { default: "p1" }, fallbacks: { p1: [] } },
      },
    }),
    "utf8"
  );
  return root;
}

async function waitFor(condition, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout esperando ${label}`);
}

function cleanup(manager, root, appIds) {
  for (const appId of appIds) {
    const status = manager?.snapshot()[appId]?.status;
    if (["running", "paused_gate", "blocked"].includes(status)) {
      try {
        manager.kill(appId);
      } catch {}
    }
  }
  fs.rmSync(root, { recursive: true, force: true });
}

test("setCooldown evita player em todas as pipelines", async () => {
  const root = tmpRoot();
  const manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });

  try {
    manager.setCooldown("p1", Date.now() + 60_000);
    manager.start({ idea: "app B normal", team: "fallback", appId: "app-b" });
    await waitFor(() => manager.snapshot()["app-b"]?.status === "paused_gate", "app B no p0-go");

    const pipeline = manager.snapshot()["app-b"];
    assert.equal(pipeline.gates.find((gate) => !gate.decision)?.id, "p0-go");
    assert.equal(pipeline.history.find((entry) => entry.job === "L0/P0")?.playerId, "p2");
    assert.ok(manager.cooldowns().p1);
  } finally {
    cleanup(manager, root, ["app-b"]);
  }
});

test("rate-limit de app A bloqueia p1 globalmente para app B", async () => {
  const root = tmpRoot();
  const previousEcho = process.env.FORGE_FAKE_ECHO;
  let manager;
  process.env.FORGE_FAKE_ECHO = "1";

  try {
    manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "falha simulada\nAPI Error: 429 FORGE_FAKE_FAIL", team: "solo", appId: "app-a" });
    await waitFor(() => manager.snapshot()["app-a"]?.status === "blocked", "app A bloqueado");

    manager.start({ idea: "app B normal", team: "fallback", appId: "app-b" });
    await waitFor(() => manager.snapshot()["app-b"]?.status === "paused_gate", "app B no p0-go");

    const snapshots = manager.snapshot();
    assert.equal(snapshots["app-b"].history.find((entry) => entry.job === "L0/P0")?.playerId, "p2");
    assert.match(snapshots["app-a"].cooldowns.p1, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof manager.cooldowns().p1, "number");
  } finally {
    if (previousEcho === undefined) delete process.env.FORGE_FAKE_ECHO;
    else process.env.FORGE_FAKE_ECHO = previousEcho;
    cleanup(manager, root, ["app-a", "app-b"]);
  }
});

test("cooldown persistido continua global depois de recriar o manager", async () => {
  const root = tmpRoot();
  const previousEcho = process.env.FORGE_FAKE_ECHO;
  let manager;
  process.env.FORGE_FAKE_ECHO = "1";

  try {
    manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "falha simulada\nAPI Error: 429 FORGE_FAKE_FAIL", team: "solo", appId: "app-a" });
    await waitFor(() => manager.snapshot()["app-a"]?.status === "blocked", "app A bloqueado");

    manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "app B depois do restart", team: "fallback", appId: "app-b" });
    await waitFor(() => manager.snapshot()["app-b"]?.status === "paused_gate", "app B no p0-go");

    assert.equal(manager.snapshot()["app-b"].history.find((entry) => entry.job === "L0/P0")?.playerId, "p2");
    assert.ok(manager.cooldowns().p1 > Date.now());
  } finally {
    if (previousEcho === undefined) delete process.env.FORGE_FAKE_ECHO;
    else process.env.FORGE_FAKE_ECHO = previousEcho;
    cleanup(manager, root, ["app-a", "app-b"]);
  }
});
