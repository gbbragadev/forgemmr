import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildControlSnapshot } from "../control/snapshot.mjs";
import { createMemoryActions, createMemoryActionHandlers } from "../memory/control.mjs";
import { createMemoryService } from "../memory/service.mjs";

function fixtureRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-control-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "maestro", "runs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({ players: [], teams: {} }),
  );
  return root;
}

test("snapshot inclui status sanitizado e catálogo completo de memória", (t) => {
  const root = fixtureRoot(t);
  const memoryStatus = {
    state: "healthy",
    version: "1.13.0",
    managed: true,
    latencyMs: 12,
    pageCount: 8,
    pendingOutbox: 0,
    lastHealthAt: "2026-07-14T00:00:00.000Z",
    lastError: null,
  };
  const snapshot = buildControlSnapshot({
    root,
    engineManager: { snapshot: () => ({}), cooldowns: () => ({}) },
    memory: { status: () => memoryStatus },
    now: new Date("2026-07-14T12:00:00.000Z"),
  });

  assert.deepEqual(snapshot.memory, memoryStatus);
  const ids = snapshot.actions.map((action) => action.id);
  for (const id of [
    "memory.setup",
    "memory.retry",
    "memory.update",
    "memory.backup",
    "memory.reindex",
    "memory.rule.write",
    "memory.page.delete",
  ]) {
    assert.ok(ids.includes(id), `ação ausente: ${id}`);
  }
  assert.equal(snapshot.actions.find((action) => action.id === "memory.update").risk, "external");
  assert.equal(snapshot.actions.find((action) => action.id === "memory.reindex").risk, "destructive");
  assert.equal(snapshot.actions.find((action) => action.id === "memory.page.delete").risk, "destructive");
  for (const action of snapshot.actions.filter((item) => item.id.startsWith("memory."))) {
    const fieldNames = action.fields.map((field) => field.name);
    for (const forbidden of ["command", "executable", "url", "path", "args"]) {
      assert.equal(fieldNames.includes(forbidden), false, `${action.id} aceita ${forbidden}`);
    }
  }
});

test("handlers de memória são allowlisted e transformam apenas campos declarados", async () => {
  const calls = [];
  const service = {
    setup: async () => calls.push(["setup"]),
    retry: async () => calls.push(["retry"]),
    update: async () => calls.push(["update"]),
    backup: async () => calls.push(["backup"]),
    reindex: async () => calls.push(["reindex"]),
    writeRule: async (input) => calls.push(["rule", input]),
    deletePage: async (input) => calls.push(["delete", input]),
  };
  const handlers = createMemoryActionHandlers(service);

  await handlers["memory.setup"]({ input: {} });
  await handlers["memory.retry"]({ input: {} });
  await handlers["memory.update"]({ input: {} });
  await handlers["memory.backup"]({ input: {} });
  await handlers["memory.reindex"]({ input: {} });
  await handlers["memory.rule.write"]({
    input: {
      appId: "probe",
      summary: "Use npm.cmd no Windows",
      evidenceRefs: "docs/verify.md\ngit:abc123",
      sensitivity: "internal",
    },
  });
  await handlers["memory.page.delete"]({ input: { appId: "probe", pagePath: "rules/abc.md" } });

  assert.deepEqual(calls[5], ["rule", {
    appId: "probe",
    summary: "Use npm.cmd no Windows",
    evidenceRefs: ["docs/verify.md", "git:abc123"],
    sensitivity: "internal",
  }]);
  assert.deepEqual(calls[6], ["delete", { appId: "probe", pagePath: "rules/abc.md" }]);
  assert.equal(Object.hasOwn(handlers, "shell.run"), false);
});

test("service grava página ou enfileira sem lançar quando a memória cai", async (t) => {
  const root = fixtureRoot(t);
  const runtimeState = {
    state: "healthy",
    version: "1.13.0",
    managed: true,
    latencyMs: 5,
    lastHealthAt: "2026-07-14T00:00:00.000Z",
    lastError: null,
  };
  const runtime = {
    status: () => ({ ...runtimeState }),
    setup: async () => runtimeState,
    ensureRunning: async () => runtimeState,
    startIfInstalled: async () => runtimeState,
    runMaintenance: async () => runtimeState,
    stopManaged: async () => true,
  };
  const writes = [];
  const queued = [];
  const gateway = {
    status: async () => ({ counts: { pages_latest: 3 } }),
    writePage: async (page) => writes.push(page),
  };
  const outbox = {
    size: () => queued.length,
    enqueue: (record) => { queued.push(record); return true; },
    drain: async () => ({ attempted: 0, sent: 0, failed: 0, pending: queued.length }),
  };
  const service = createMemoryService({ root, runtime, gateway, outbox, now: () => new Date("2026-07-14T12:00:00.000Z") });

  const written = await service.record({ type: "outcome", appId: "probe", summary: "PASS" });
  assert.equal(written.queued, false);
  assert.equal(writes[0].project, "app-probe");
  gateway.writePage = async () => { throw new Error("offline"); };
  const fallback = await service.record({ type: "outcome", appId: "probe", summary: "FAIL" });
  assert.equal(fallback.queued, true);
  assert.equal(queued.length, 1);
  assert.equal(service.status().pendingOutbox, 1);
});

test("service normaliza o schema real v1.13 de busca e leitura", async (t) => {
  const root = fixtureRoot(t);
  const runtime = {
    status: () => ({ state: "healthy", version: "1.13.0", managed: true }),
    stopManaged: async () => true,
  };
  const gateway = {
    search: async () => [{ path: "rules/one.md", title: "Regra", kind: "rule", snippet: "alpha" }],
    readPage: async () => ({ path: "rules/one.md", body_markdown: "# Regra\n\nalpha" }),
  };
  const outbox = { size: () => 0, enqueue: () => true, drain: async () => ({ pending: 0 }) };
  const service = createMemoryService({ root, runtime, gateway, outbox });

  assert.deepEqual((await service.search({ q: "alpha", appId: "alpha" })).hits, [{
    path: "rules/one.md",
    title: "Regra",
    kind: "rule",
    snippet: "alpha",
  }]);
  assert.equal((await service.readPage({ appId: "alpha", pagePath: "rules/one.md" })).body, "# Regra\n\nalpha");
});
