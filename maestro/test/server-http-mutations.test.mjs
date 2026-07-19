import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMaestroServer } from "../server.mjs";

// Rotas mutantes testadas (linha de origem em maestro/server.mjs):
// - /api/run (POST) L.888 → startRun()
// - /api/stop (POST) L.903 → stopRun()
// - /api/pipeline/start (POST) L.922 → engine.start()
// - /api/pipeline/feedback (POST) L.924 → engine.startFeedback()
// - /api/pipeline/decide (POST) L.926 → engine.decide()
// - /api/pipeline/stop (POST) L.928 → engine.stop()
// - /api/pipeline/resume (POST) L.930 → engine.resume()
// - /api/pipeline/target (POST) L.950 → engine.setTarget()
// - /api/pipeline/kill (POST) L.952 → engine.kill()
// - /api/pipeline/remove (POST) L.954 → engine.removeApp()
// - /api/memory/import/preview (POST) L.805 → memory.importPreview()
// - /api/memory/import/apply (POST) L.814 → memory.importApply()

function fakeEngine() {
  const calls = [];
  const pipelines = {};
  return {
    calls,
    snapshot: () => pipelines,
    snapshotFor: () => ({ appId: "test-app", status: "running", gates: [], history: [] }),
    start(input) {
      calls.push({ method: "start", args: input });
      pipelines[input.appId || "test-app"] = { appId: input.appId || "test-app", status: "running", gates: [], history: [] };
      return pipelines[input.appId || "test-app"];
    },
    startFeedback(input) {
      calls.push({ method: "startFeedback", args: input });
      pipelines[input.appId || "test-app"] = { appId: input.appId || "test-app", status: "feedback", gates: [], history: [] };
      return pipelines[input.appId || "test-app"];
    },
    decide(appId, gateId, choice, feedback) {
      calls.push({ method: "decide", args: { appId, gateId, choice, feedback } });
      return { ok: true, pipeline: pipelines[appId] };
    },
    stop(appId) {
      calls.push({ method: "stop", args: appId });
      return { ok: true };
    },
    resume(appId) {
      calls.push({ method: "resume", args: appId });
      return { ok: true, pipeline: pipelines[appId] };
    },
    setTarget(appId, target, subdomain) {
      calls.push({ method: "setTarget", args: { appId, target, subdomain } });
      return { ok: true };
    },
    kill(appId) {
      calls.push({ method: "kill", args: appId });
      return { ok: true };
    },
    removeApp(appId, opts) {
      calls.push({ method: "removeApp", args: { appId, opts } });
      return { ok: true };
    },
  };
}

function fakeMemory() {
  const calls = [];
  return {
    calls,
    status: () => ({ healthy: true }),
    importPreview: async (data) => {
      calls.push({ method: "importPreview", args: data });
      return { ok: true, items: [] };
    },
    importApply: async (data) => {
      calls.push({ method: "importApply", args: data });
      return { ok: true, applied: 0 };
    },
  };
}

async function start(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function setupTestDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-server-mutations-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      players: [{ id: "test-player", name: "Test", cli: "test", roles: ["qa"] }],
      teams: { "test": { label: "Test", dispatch: { default: "test-player" }, fallbacks: {} } },
    }),
  );
  return root;
}

test("POST /api/pipeline/start recusa start legado sem chamar engine", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app", idea: "test mutation" }),
  });

  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.match(data.error, /discovery\.build\.start/);
  assert.equal(engine.calls.length, 0);
});

test("POST /api/pipeline/start com JSON inválido retorna erro 409", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: "{oops broken json",
  });

  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.ok(data.error);
  // servidor continua vivo
  assert.equal((await fetch(`${baseUrl}/api/status`)).status, 200);
});

test("POST /api/pipeline/feedback com body válido chama engine.startFeedback()", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app", feedback: "ok" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "startFeedback");
  assert.equal(engine.calls[0].args.appId, "test-app");
  assert.equal(engine.calls[0].args.feedback, "ok");
});

test("POST /api/pipeline/decide com body válido chama engine.decide(appId, gateId, choice, feedback)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/decide`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app", gateId: "gate-1", choice: "approve", feedback: "looks good" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "decide");
  assert.equal(engine.calls[0].args.appId, "test-app");
  assert.equal(engine.calls[0].args.gateId, "gate-1");
  assert.equal(engine.calls[0].args.choice, "approve");
  assert.equal(engine.calls[0].args.feedback, "looks good");
});

test("POST /api/pipeline/stop com body válido chama engine.stop(appId)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/stop`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "stop");
  assert.equal(engine.calls[0].args, "test-app");
});

test("POST /api/pipeline/resume com body válido chama engine.resume(appId)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/resume`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "resume");
  assert.equal(engine.calls[0].args, "test-app");
});

test("POST /api/pipeline/target com body válido chama engine.setTarget(appId, target, subdomain)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/target`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app", target: "production", subdomain: "api" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "setTarget");
  assert.deepEqual(engine.calls[0].args, { appId: "test-app", target: "production", subdomain: "api" });
});

test("POST /api/pipeline/kill com body válido chama engine.kill(appId)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/kill`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app" }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "kill");
  assert.equal(engine.calls[0].args, "test-app");
});

test("POST /api/pipeline/remove com body válido chama engine.removeApp(appId, opts)", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/remove`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ appId: "test-app", force: true }),
  });

  assert.equal(response.status, 200);
  assert.equal(engine.calls.length, 1);
  assert.equal(engine.calls[0].method, "removeApp");
  assert.equal(engine.calls[0].args.appId, "test-app");
  assert.equal(engine.calls[0].args.opts.force, true);
});

test("POST /api/pipeline/remove com JSON inválido retorna erro 409 e servidor continua vivo", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/remove`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: "{invalid json",
  });

  assert.equal(response.status, 409);
  const data = await response.json();
  assert.equal(data.ok, false);
  // servidor continua vivo e responde
  const statusResponse = await fetch(`${baseUrl}/api/status`);
  assert.equal(statusResponse.status, 200);
});

test("POST /api/pipeline/<ação desconhecida> retorna 404", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/pipeline/unknownaction`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 404);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.match(data.error, /ação desconhecida/);
});

test("POST /api/stop com body válido retorna ok", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/stop`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  // stopRun() retorna { ok: false, error: "Nenhuma run ativa" } quando não há child
  assert.equal(data.ok, false);
  assert.match(data.error, /Nenhuma run ativa/);
});

test("POST /api/memory/import/preview com body válido chama memory.importPreview()", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const memory = fakeMemory();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    memoryService: memory,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/memory/import/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ source: "test", items: [{ title: "test" }] }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(memory.calls.length, 1);
  assert.equal(memory.calls[0].method, "importPreview");
  assert.deepEqual(memory.calls[0].args.source, "test");
});

test("POST /api/memory/import/preview com JSON inválido retorna erro de memória", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const memory = fakeMemory();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    memoryService: memory,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/memory/import/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: "{bad json",
  });

  assert.equal(response.status, 500);
  const data = await response.json();
  assert.equal(data.ok, false);
  // servidor continua vivo
  assert.equal((await fetch(`${baseUrl}/api/status`)).status, 200);
});

test("POST /api/memory/import/apply com body válido chama memory.importApply()", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const memory = fakeMemory();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    memoryService: memory,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/memory/import/apply`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({ source: "test", items: [] }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(memory.calls.length, 1);
  assert.equal(memory.calls[0].method, "importApply");
});

test("POST /api/nao-existe retorna 404", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const token = (await (await fetch(`${baseUrl}/api/token`)).json()).token;
  const response = await fetch(`${baseUrl}/api/nao-existe`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-maestro-token": token },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 404);
});

test("requisições sem token são rejeitadas com 401", async (t) => {
  const root = setupTestDir();
  const engine = fakeEngine();
  const server = createMaestroServer({
    root,
    engineManager: engine,
    spawnImpl: () => { throw new Error("spawn não deveria ser chamado"); },
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  const response = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appId: "test" }),
  });

  assert.equal(response.status, 401);
  const data = await response.json();
  assert.equal(data.ok, false);
});
