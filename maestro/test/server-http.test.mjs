import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { createMaestroServer } from "../server.mjs";

function fakeEngine() {
  const calls = [];
  return {
    calls,
    snapshot: () => ({}),
    snapshotFor: () => null,
    start(input) {
      calls.push(input);
      return { appId: "control-probe", status: "running" };
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
  const engine = fakeEngine();
  const server = createMaestroServer({
    engineManager: engine,
    spawnImpl: () => {
      throw new Error("spawn não deveria ser chamado neste teste");
    },
  });
  t.after(() => server.close());
  const baseUrl = await start(server);

  const status = await fetch(`${baseUrl}/api/status`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, "idle");

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
});
