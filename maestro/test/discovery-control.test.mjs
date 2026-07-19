import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createActionCatalog } from "../control/catalog.mjs";
import { createControlDispatcher, ControlError } from "../control/dispatcher.mjs";
import { createEngineActionHandlers } from "../control/handlers.mjs";
import { buildControlSnapshot, clearControlSnapshotCache } from "../control/snapshot.mjs";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";

function rootFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-control-"));
  fs.mkdirSync(path.join(root, "maestro", "runs"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({ players: [], teams: {} }));
  return root;
}

function engine() {
  const starts = [];
  return { starts, snapshot: () => ({}), cooldowns: () => ({}), start: input => (starts.push(input), { appId: "app-1", runId: "run-1" }) };
}

test("catálogo remove pipeline.start e bloqueia discovery sem workspace", () => {
  const blocked = createActionCatalog();
  assert.deepEqual(blocked.find(action => action.id === "operator.ingest").fields.map(field => field.name), ["source"]);
  assert.equal(blocked.some(action => action.id === "pipeline.start"), false);
  assert.match(blocked.find(action => action.id === "room.create").blockedReason, /não configurado/);
  const enabled = createActionCatalog({ discovery: { revision: 0 } });
  assert.equal(enabled.find(action => action.id === "room.create").enabled, true);
  for (const id of ["braga.prepare", "braga.export", "acquisition.start", "spend.approve", "braga.return.import"]) {
    assert.equal(enabled.find(action => action.id === id).enabled, true, id);
  }
  const spend = enabled.find(action => action.id === "spend.approve");
  assert.equal(spend.risk, "external");
  assert.ok(spend.fields.find(field => field.name === "why")?.required);
  assert.ok(spend.fields.find(field => field.name === "confirmed")?.required);
  assert.equal(enabled.find(action => action.id === "braga.export").risk, "guarded");
});

test("handlers aceitam JSON tipado e recusam start legado sem chamar engine", () => {
  const calls = [];
  const discoveryWorkspace = {
    proposeThesis: input => (calls.push(input), { id: "thesis-1", roomId: input.roomId }),
  };
  const engineManager = { start: () => calls.push("engine") };
  const handlers = createEngineActionHandlers({
    root: "x", engineManager, discoveryWorkspace,
    factoryAdmin: {}, lifecycleManager: {}, forgeOperator: {},
  });
  const thesis = handlers["thesis.propose"]({ input: { roomId: "room-1", sourceMessageIds: ["message-1"], draft: { buyer: "x" } } });
  assert.equal(thesis.id, "thesis-1");
  assert.deepEqual(calls[0].sourceMessageIds, ["message-1"]);
  assert.throws(() => handlers["pipeline.start"]({ input: {} }), /discovery\.build\.start/);
  assert.equal(calls.includes("engine"), false);
});

test("revision discovery invalida snapshot sem expor transcript ou evidência", () => {
  const root = rootFixture();
  const manager = engine();
  const discovery = createDiscoveryWorkspace({ root, engineManager: manager });
  clearControlSnapshotCache();
  const before = buildControlSnapshot({ root, engineManager: manager, discoveryWorkspace: discovery, now: new Date(0) });
  const room = discovery.createRoom({ title: "Privada" });
  discovery.appendMessage({ roomId: room.id, author: "human", text: "segredo privado", executor: null, refs: [] });
  const after = buildControlSnapshot({ root, engineManager: manager, discoveryWorkspace: discovery, now: new Date(1) });
  assert.notEqual(before.version, after.version);
  assert.equal(after.discovery.revision, 2);
  assert.equal(after.discovery.rooms[0].messageCount, 1);
  assert.doesNotMatch(JSON.stringify(after), /segredo privado/);
});

test("dispatcher preserva stale state, confirmação e idempotência", async () => {
  let version = "v1";
  const action = { id: "thesis.confirm", scope: "factory", enabled: true, blockedReason: null, risk: "guarded", fields: [] };
  const saved = [];
  const operations = {
    findByIdempotencyKey: key => saved.find(item => item.idempotencyKey === key) || null,
    put: item => { const index = saved.findIndex(existing => existing.id === item.id); if (index < 0) saved.push(structuredClone(item)); else saved[index] = structuredClone(item); },
    get: id => saved.find(item => item.id === id) || null,
  };
  const dispatcher = createControlDispatcher({
    getSnapshot: () => ({ version, actions: [action] }), operations,
    audit: { append() {} }, confirmations: { issue: () => "nonce", consume: () => true },
    handlers: { "thesis.confirm": () => ({ id: "thesis-1" }) }, randomUUID: () => "operation-1", now: () => 0,
  });
  const request = { actionId: "thesis.confirm", input: {}, stateVersion: "v1", idempotencyKey: "idem-key-001" };
  const first = await dispatcher.execute(request);
  assert.equal(first.result.id, "thesis-1");
  assert.deepEqual(await dispatcher.execute(request), first);
  version = "v2";
  await assert.rejects(() => dispatcher.execute({ ...request, idempotencyKey: "idem-key-002" }), error => error instanceof ControlError && error.code === "state_stale");
});
