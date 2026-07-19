import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiscoveryStore } from "../discovery/store.mjs";
import { createDiscoveryWorkspace } from "../discovery/workspace.mjs";

function dependencies(root) {
  let sequence = 0;
  return {
    root,
    engineManager: { start() { return { appId: "app-1", runId: "run-1" }; } },
    now: () => "2026-07-18T12:00:00.000Z",
    idFactory: prefix => `${prefix}-${++sequence}`,
  };
}

test("store persiste schemaVersion e incrementa revision com escrita privada atômica", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-store-"));
  const store = createDiscoveryStore({ root });
  assert.equal(store.read().schemaVersion, 1);
  assert.equal(store.read().revision, 0);

  const saved = store.update(state => {
    state.rooms.push({ id: "room-1" });
  });
  assert.equal(saved.revision, 1);
  assert.equal(saved.schemaVersion, 1);
  assert.equal(fs.existsSync(`${store.file}.tmp`), false);
  if (process.platform !== "win32") assert.equal(fs.statSync(store.file).mode & 0o777, 0o600);
});

test("workspace recupera estado e revision após restart sem duplicar ações", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-recovery-"));
  const first = createDiscoveryWorkspace(dependencies(root));
  const room = first.createRoom({ title: "Persistida", sourceRef: "manual" });
  first.appendMessage({ roomId: room.id, author: "human", text: "olá", executor: "claude", refs: [] });
  const before = first.snapshot();

  const second = createDiscoveryWorkspace(dependencies(root));
  assert.equal(second.getRoom(room.id).messages.length, 1);
  assert.equal(second.snapshot().revision, before.revision);
  assert.equal(second.snapshot().rooms.length, 1);
});

test("fallback gera IDs duráveis e distintos após restart", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-ids-"));
  const first = createDiscoveryWorkspace({
    root,
    engineManager: { start() {} },
    now: () => "2026-07-18T12:00:00.000Z",
  });
  const original = first.createRoom({ title: "Original" });

  const restarted = createDiscoveryWorkspace({
    root,
    engineManager: { start() {} },
    now: () => "2026-07-18T12:01:00.000Z",
  });
  const next = restarted.createRoom({ title: "Depois do restart" });

  assert.notEqual(next.id, original.id);
  assert.deepEqual(restarted.snapshot().rooms.map(room => room.id), [original.id, next.id]);
});

test("JSON corrompido falha explicitamente e não é sobrescrito", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-corrupt-"));
  const file = path.join(root, ".control", "discovery", "workspace.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{truncado", "utf8");

  assert.throws(() => createDiscoveryStore({ root }).read(), /discovery store inválido/);
  assert.equal(fs.readFileSync(file, "utf8"), "{truncado");
});
