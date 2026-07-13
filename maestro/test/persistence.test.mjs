import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager } from "../engine.mjs";

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-persistence-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "fake-1", face: "test", name: "Fake", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] }],
      teams: { "dry-run": { emoji: "test", label: "fake executor", dispatch: { default: "fake-1" }, fallbacks: {} } },
    }),
    "utf8"
  );
  return root;
}

function makeManager(root, logs = []) {
  return createEngineManager({ root, emitLog: (line) => logs.push(line), emitPipeline: () => {} });
}

async function waitFor(condition, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("timeout esperando pipeline persistida");
}

function cleanup(root, manager, appId) {
  try {
    if (["running", "paused_gate", "blocked"].includes(manager.snapshotFor(appId).status)) manager.kill(appId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("recovery: estado truncado é preservado, reportado e permanece idle", () => {
  const root = tmpRoot();
  const logs = [];
  const broken = path.join(root, "maestro", "pipelines", "broken.json");
  let manager;

  try {
    fs.mkdirSync(path.dirname(broken), { recursive: true });
    fs.writeFileSync(broken, '{"appId":"broken",', "utf8");

    manager = makeManager(root, logs);

    assert.deepEqual(manager.snapshotFor("broken"), { status: "idle" });
    assert.ok(fs.existsSync(broken), "estado corrompido deve ser preservado");
    assert.ok(logs.some((line) => /pipelines[\\/]broken\.json.*preservado/i.test(line)), "recovery deve avisar sobre o arquivo preservado");
  } finally {
    cleanup(root, manager || { snapshotFor: () => ({ status: "idle" }) }, "broken");
  }
});

test("save: publica JSON válido por rename sem deixar arquivo temporário", async () => {
  const root = tmpRoot();
  const appId = "atomic-save";
  const manager = makeManager(root);

  try {
    manager.start({ idea: "app para persistência atômica", team: "dry-run", capability: "static", appId });
    await waitFor(() => manager.snapshotFor(appId).status === "paused_gate");

    const statePath = path.join(root, "maestro", "pipelines", `${appId}.json`);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(statePath, "utf8")));
    assert.equal(fs.existsSync(`${statePath}.tmp`), false);
  } finally {
    cleanup(root, manager, appId);
  }
});
