import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMaestroServer } from "../server.mjs";

function fakeEngine() {
  const calls = [];
  const pipelines = {};
  return {
    calls,
    snapshot: () => pipelines,
    snapshotFor: () => null,
    start(input) {
      calls.push(input);
      pipelines["control-probe"] = { appId: "control-probe", status: "running", gates: [], history: [] };
      return pipelines["control-probe"];
    },
    startFeedback: () => null,
    decide: () => null,
    stop: () => ({ ok: true }),
    resume: () => null,
    setTarget: () => ({ ok: true }),
    kill: () => ({ ok: true }),
    removeApp: () => ({ ok: true }),
  };
}

async function start(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test("createMaestroServer expõe HTTP real sem iniciar a porta 8799 ao importar", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-server-http-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      players: [{ id: "fake-dry", name: "Fake", cli: "fake", roles: ["qa"] }],
      teams: { "dry-run": { label: "Dry-run", dispatch: { default: "fake-dry" }, fallbacks: {} } },
    }),
  );
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => {
      throw new Error("spawn não deveria ser chamado neste teste");
    },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const status = await fetch(`${baseUrl}/api/status`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, "idle");

  const controlSnapshot = await fetch(`${baseUrl}/api/control/snapshot`);
  assert.equal(controlSnapshot.status, 200);
  const control = await controlSnapshot.json();
  assert.match(control.version, /^[a-f0-9]{16}$/);
  assert.ok(control.actions.some((action) => action.id === "pipeline.start"));

  const denied = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idea: "probe" }),
  });
  assert.equal(denied.status, 401);
  assert.equal(engine.calls.length, 0);

  const tokenResponse = await fetch(`${baseUrl}/api/token`);
  assert.equal(tokenResponse.status, 200);
  const { token } = await tokenResponse.json();
  assert.ok(token.length >= 32);

  const accepted = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-maestro-token": token,
    },
    body: JSON.stringify({ idea: "probe" }),
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).pipeline.appId, "control-probe");
  assert.deepEqual(engine.calls, [{ idea: "probe" }]);

  const freshSnapshot = await (await fetch(`${baseUrl}/api/control/snapshot`)).json();
  const execute = await fetch(`${baseUrl}/api/control/actions/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-maestro-token": token,
    },
    body: JSON.stringify({
      actionId: "pipeline.start",
      appId: null,
      input: { idea: "pela central", team: "dry-run" },
      stateVersion: freshSnapshot.version,
      idempotencyKey: "http-idem-123456",
      confirmation: null,
    }),
  });
  assert.equal(execute.status, 200);
  const operation = await execute.json();
  assert.equal(operation.status, "succeeded");

  const operationResponse = await fetch(`${baseUrl}/api/control/operations/${operation.id}`);
  assert.equal(operationResponse.status, 200);
  assert.equal((await operationResponse.json()).id, operation.id);
});
