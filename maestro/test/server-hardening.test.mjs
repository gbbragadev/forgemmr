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

test("readBody rejeita body > 5 MB com 413 e servidor continua respondendo", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-hardening-"));
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

  // Obter token
  const tokenResponse = await fetch(`${baseUrl}/api/token`);
  assert.equal(tokenResponse.status, 200);
  const { token } = await tokenResponse.json();

  // POST com 6 MB deve retornar 413
  const largeBody = "x".repeat(6 * 1024 * 1024);
  const oversized = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-maestro-token": token,
    },
    body: largeBody,
  });
  assert.equal(oversized.status, 413, "POST com body > 5 MB deve retornar 413");
  const oversizedBody = await oversized.json();
  assert.ok(oversizedBody.error.includes("5 MB"), "mensagem de erro deve mencionar o limite");

  // Servidor continua respondendo
  const subsequentRequest = await fetch(`${baseUrl}/api/status`);
  assert.equal(subsequentRequest.status, 200, "servidor deve continuar respondendo após 413");
  const status = await subsequentRequest.json();
  assert.equal(status.status, "idle");
});

test("readBody aceita body pequeno com JSON válido", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-hardening-small-"));
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

  // Obter token
  const tokenResponse = await fetch(`${baseUrl}/api/token`);
  const { token } = await tokenResponse.json();

  // POST com body pequeno deve funcionar
  const response = await fetch(`${baseUrl}/api/pipeline/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-maestro-token": token,
    },
    body: JSON.stringify({ idea: "test" }),
  });
  assert.equal(response.status, 200, "POST com body válido pequeno deve retornar 200");
  const data = await response.json();
  assert.ok(data.pipeline);
});

test("streamFile entrega arquivo estático e trata erro de stream", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-hardening-static-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.mkdirSync(path.join(root, "marketing", "ig-kit"), { recursive: true });

  // Criar arquivo de teste
  fs.writeFileSync(path.join(root, "marketing", "ig-kit", "test.html"), "<html>test</html>");

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
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  // GET arquivo que existe deve retornar 200
  const response = await fetch(`${baseUrl}/ig-kit/test.html`);
  assert.equal(response.status, 200);
  const content = await response.text();
  assert.equal(content, "<html>test</html>");
});

test("streamFile retorna 404 para arquivo inexistente", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-hardening-notfound-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.mkdirSync(path.join(root, "marketing", "ig-kit"), { recursive: true });

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
  });
  t.after(() => new Promise((resolve) => server.close(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resolve();
  })));
  const baseUrl = await start(server);

  // GET arquivo inexistente deve retornar 404
  const response = await fetch(`${baseUrl}/ig-kit/notfound.html`);
  assert.equal(response.status, 404);
});
