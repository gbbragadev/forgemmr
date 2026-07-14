import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createMaestroServer } from "../server.mjs";

function fixtureRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-http-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "maestro", "runs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({ players: [], teams: {} }),
  );
  return root;
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test("API de memória cobre leitura e import sem expor token interno", async (t) => {
  const root = fixtureRoot(t);
  const calls = [];
  const memoryService = {
    status: () => ({ state: "healthy", version: "1.13.0", managed: true, latencyMs: 4, pageCount: 2, pendingOutbox: 0, lastHealthAt: null, lastError: null }),
    overview: async (input) => { calls.push(["overview", input]); return { totals: { pages: 2 } }; },
    search: async (input) => { calls.push(["search", input]); return { hits: [] }; },
    briefing: async (input) => { calls.push(["briefing", input]); return { items: [], text: "" }; },
    readPage: async (input) => { calls.push(["page", input]); return { path: input.pagePath, body: "# Rule" }; },
    importPreview: async (input) => { calls.push(["preview", input]); return { count: 1 }; },
    importApply: async (input) => { calls.push(["apply", input]); return { imported: 1 }; },
    startIfInstalled: async () => ({ state: "healthy" }),
    close: async () => true,
  };
  const engineManager = { snapshot: () => ({}), cooldowns: () => ({}) };
  const server = createMaestroServer({ root, port: 0, engineManager, memoryService });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const maestroToken = fs.readFileSync(path.resolve(import.meta.dirname, "..", ".token"), "utf8").trim();

  assert.equal((await json(await fetch(`${base}/api/memory/status`))).body.state, "healthy");
  assert.equal((await json(await fetch(`${base}/api/memory/overview?project=app-probe`))).body.totals.pages, 2);
  assert.deepEqual((await json(await fetch(`${base}/api/memory/search?q=term&project=app-probe`))).body.hits, []);
  assert.equal((await json(await fetch(`${base}/api/memory/briefing?project=app-probe`))).body.text, "");
  assert.equal(
    (await json(await fetch(`${base}/api/memory/pages/app-probe/${encodeURIComponent("rules/one.md")}`))).body.body,
    "# Rule",
  );

  const unauthorized = await fetch(`${base}/api/memory/import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sources: ["runs"] }),
  });
  assert.equal(unauthorized.status, 401);
  const preview = await json(await fetch(`${base}/api/memory/import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Maestro-Token": maestroToken },
    body: JSON.stringify({ sources: ["runs"] }),
  }));
  assert.equal(preview.body.count, 1);
  const apply = await json(await fetch(`${base}/api/memory/import/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Maestro-Token": maestroToken },
    body: JSON.stringify({ previewId: "preview-1" }),
  }));
  assert.equal(apply.body.imported, 1);

  const serialized = JSON.stringify({ calls, status: memoryService.status() });
  assert.equal(serialized.includes("AI_MEMORY_AUTH_TOKEN"), false);
  assert.equal(serialized.includes("49374"), false);
});

test("API rejeita projeto fora do Forge e traversal de página", async (t) => {
  const root = fixtureRoot(t);
  const memoryService = {
    status: () => ({ state: "healthy", version: "1.13.0", managed: false, latencyMs: 1, pageCount: 0, pendingOutbox: 0, lastHealthAt: null, lastError: null }),
    overview: async () => ({}),
    readPage: async () => assert.fail("path inválido não pode alcançar o service"),
    startIfInstalled: async () => ({}),
    close: async () => true,
  };
  const server = createMaestroServer({
    root,
    port: 0,
    engineManager: { snapshot: () => ({}), cooldowns: () => ({}) },
    memoryService,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${base}/api/memory/overview?project=other`)).status, 400);
  assert.equal(
    (await fetch(`${base}/api/memory/pages/app-probe/${encodeURIComponent("../secret")}`)).status,
    400,
  );
});
