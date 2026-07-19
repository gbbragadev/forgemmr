import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createMaestroServer } from "../server.mjs";

function engine() {
  const calls = [];
  return {
    calls,
    snapshot: () => ({}),
    cooldowns: () => ({}),
    start: input => (calls.push(input), {}),
    startFeedback: () => null,
    decide: () => null,
    stop: () => ({ ok: true }),
    resume: () => null,
    setTarget: () => null,
    kill: () => null,
    removeApp: () => null,
  };
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

test("GET discovery exige token e devolve room/tese redigidas", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-server-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({ players: [], teams: {} }));
  process.env.DISCOVERY_TEST_SECRET = "private-secret-value-987654";
  const discoveryWorkspace = {
    snapshot: () => ({ revision: 1, rooms: [], theses: [], evidence: [], experiments: [], builds: [], acquisitions: [] }),
    getRoom: id => ({ id, title: "Room", messages: [{ text: process.env.DISCOVERY_TEST_SECRET }] }),
    getThesis: id => ({ id, roomId: "room-1", buyer: process.env.DISCOVERY_TEST_SECRET, stage: "confirmed", evidenceIds: [], experimentIds: [] }),
  };
  const server = createMaestroServer({ root, engineManager: engine(), discoveryWorkspace });
  t.after(() => new Promise(resolve => server.close(() => {
    delete process.env.DISCOVERY_TEST_SECRET;
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const base = await listen(server);
  assert.equal((await fetch(`${base}/api/discovery/rooms/room-1`)).status, 401);
  const token = (await (await fetch(`${base}/api/token`)).json()).token;
  const headers = { "x-maestro-token": token };
  const room = await fetch(`${base}/api/discovery/rooms/room-1`, { headers });
  assert.equal(room.status, 200);
  assert.doesNotMatch(JSON.stringify(await room.json()), /private-secret-value/);
  const thesis = await fetch(`${base}/api/discovery/theses/thesis-1`, { headers });
  assert.equal(thesis.status, 200);
  assert.doesNotMatch(JSON.stringify(await thesis.json()), /private-secret-value/);
  assert.equal((await fetch(`${base}/api/discovery/rooms/..%2Fsecret`, { headers })).status, 404);
});

test("SSE control replay projeta IDs e respeita cursor Last-Event-ID", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-sse-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({ players: [], teams: {} }));
  const server = createMaestroServer({ root, engineManager: engine() });
  t.after(() => new Promise(resolve => server.close(() => { fs.rmSync(root, { recursive: true, force: true }); resolve(); })));
  const base = await listen(server);
  const token = (await (await fetch(`${base}/api/token`)).json()).token;
  const snapshot = await (await fetch(`${base}/api/control/snapshot`)).json();
  const operationResponse = await fetch(`${base}/api/control/actions/execute`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({
      actionId: "room.create",
      input: { title: "Room SSE privada" },
      stateVersion: snapshot.version,
      idempotencyKey: "sse-room-create-001",
    }),
  });
  assert.equal(operationResponse.status, 200);
  const operation = await operationResponse.json();

  async function readReplay(after, lastEventId) {
    const controller = new AbortController();
    const response = await fetch(`${base}/api/events?runId=control&after=${after}`, {
      headers: lastEventId ? { "last-event-id": String(lastEventId) } : {},
      signal: controller.signal,
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      while (!text.includes("\n\n")) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      controller.abort();
    }
    return text;
  }

  const replay = await readReplay(0, null);
  const payloads = replay.split("\n\n")
    .map(block => block.match(/^data: (.+)$/m)?.[1])
    .filter(Boolean)
    .map(value => JSON.parse(value));
  const succeeded = payloads.find(payload => payload.operationId === operation.id && payload.status === "succeeded");
  assert.ok(succeeded);
  assert.equal(succeeded.actionId, "room.create");
  assert.equal(succeeded.roomId, operation.result.id);
  assert.equal(typeof succeeded.sequence, "number");
  assert.equal("result" in succeeded, false);
  assert.doesNotMatch(replay, /Room SSE privada/);

  const afterCursor = await readReplay(succeeded.sequence, succeeded.sequence);
  assert.doesNotMatch(afterCursor, new RegExp(operation.id));
});

test("start legado retorna 409 e não chama engine", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-legacy-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({ players: [], teams: {} }));
  const fakeEngine = engine();
  const server = createMaestroServer({ root, engineManager: fakeEngine });
  t.after(() => new Promise(resolve => server.close(() => { fs.rmSync(root, { recursive: true, force: true }); resolve(); })));
  const base = await listen(server);
  const token = (await (await fetch(`${base}/api/token`)).json()).token;
  const response = await fetch(`${base}/api/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ idea: "não iniciar" }),
  });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /discovery\.build\.start/);
  assert.equal(fakeEngine.calls.length, 0);
});
