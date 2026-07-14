import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createMemoryGateway, MemoryGatewayError } from "../memory/gateway.mjs";

const TOKEN = "gateway-test-secret";

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function createFixtureServer(t) {
  const calls = { urls: [], authorization: [], writePage: null, deletePage: null };
  const server = http.createServer(async (req, res) => {
    calls.urls.push(req.url);
    calls.authorization.push(req.headers.authorization);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `token recusado: ${TOKEN}` }));
      return;
    }
    if (req.url.includes("q=unauthorized")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `credencial ${TOKEN} inválida` }));
      return;
    }
    if (req.url.includes("q=server-error")) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "falha interna" }));
      return;
    }
    if (req.url.includes("q=bad-json")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{not-json");
      return;
    }
    if (req.url.includes("q=timeout")) {
      setTimeout(() => {
        if (!res.destroyed) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ hits: [] }));
        }
      }, 100);
      return;
    }
    if (req.url === "/admin/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version: "1.13.0", counts: { pages_latest: 2 } }));
      return;
    }
    if (req.url === "/admin/write-page" && req.method === "POST") {
      calls.writePage = await readJson(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: calls.writePage.path }));
      return;
    }
    if (req.url === "/admin/delete-page" && req.method === "POST") {
      calls.deletePage = await readJson(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }
    if (req.url === "/admin/backup" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/gzip" });
      res.end(Buffer.from("backup-fixture"));
      return;
    }
    if (req.url.includes("/briefing?")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ briefing: [{ title: "Regra" }] }));
      return;
    }
    if (req.url.includes("/overview?")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ totals: { pages: 2 } }));
      return;
    }
    if (req.url.startsWith("/api/v1/search?")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ hits: [{ path: "rules/one.md" }] }));
      return;
    }
    if (req.url.includes("/pages/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: "outcomes/abc 123.md", body: "# Resultado" }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  return { calls, endpoint: `http://127.0.0.1:${address.port}` };
}

test("gateway autentica e monta somente rotas internas codificadas", async (t) => {
  const { calls, endpoint } = await createFixtureServer(t);
  const gateway = createMemoryGateway({ endpoint, getToken: () => TOKEN });

  assert.equal((await gateway.status()).version, "1.13.0");
  assert.equal(
    (await gateway.overview({ workspace: "forge", project: "app-probe", limit: 8 })).totals.pages,
    2,
  );
  assert.equal(
    (await gateway.search({ q: "regra útil", workspace: "forge", project: "app-probe", limit: 7 })).hits.length,
    1,
  );
  assert.equal(
    (await gateway.briefing({ workspace: "forge", project: "app-probe", limit: 6 })).briefing[0].title,
    "Regra",
  );
  assert.equal(
    (await gateway.readPage({
      workspace: "forge",
      project: "app-probe",
      pagePath: "outcomes/abc 123.md",
    })).body,
    "# Resultado",
  );

  assert.ok(calls.authorization.every((value) => value === `Bearer ${TOKEN}`));
  assert.ok(calls.urls.includes("/api/v1/workspaces/forge/projects/app-probe/overview?limit=8"));
  assert.ok(calls.urls.includes("/api/v1/workspaces/forge/projects/app-probe/pages/outcomes/abc%20123.md"));
});

test("writePage preserva o schema e deletePage envia somente o identificador", async (t) => {
  const { calls, endpoint } = await createFixtureServer(t);
  const gateway = createMemoryGateway({ endpoint, getToken: () => TOKEN });
  const page = {
    workspace: "forge",
    project: "app-probe",
    path: "outcomes/abc123.md",
    body: "# Resultado\n\nPASS",
    title: "Resultado",
    kind: "fact",
    tier: "episodic",
    tags: ["forge", "outcome"],
    pinned: false,
  };

  await gateway.writePage(page);
  assert.deepEqual(calls.writePage, page);
  await gateway.deletePage({
    workspace: "forge",
    project: "app-probe",
    pagePath: "outcomes/abc123.md",
    ignored: "não encaminhar",
  });
  assert.deepEqual(calls.deletePage, {
    workspace: "forge",
    project: "app-probe",
    path: "outcomes/abc123.md",
  });
});

test("validação fecha q, limit e travessia antes da rede", async () => {
  let fetched = 0;
  const gateway = createMemoryGateway({
    endpoint: "http://127.0.0.1:49374",
    getToken: () => TOKEN,
    fetchImpl: async () => {
      fetched += 1;
    },
  });

  await assert.rejects(gateway.search({ q: "x".repeat(501), workspace: "forge" }), /500/);
  await assert.rejects(gateway.search({ q: "ok", workspace: "forge", limit: 0 }), /limit/i);
  await assert.rejects(gateway.search({ q: "ok", workspace: "forge", limit: 51 }), /limit/i);
  await assert.rejects(
    gateway.readPage({ workspace: "forge", project: "app-probe", pagePath: "../secret" }),
    /path/i,
  );
  assert.equal(fetched, 0);
});

test("401, 500, timeout e JSON inválido viram erros seguros sem token", async (t) => {
  const { endpoint } = await createFixtureServer(t);
  const gateway = createMemoryGateway({ endpoint, getToken: () => TOKEN, timeoutMs: 1_000 });

  for (const [q, status] of [["unauthorized", 401], ["server-error", 500], ["bad-json", 502]]) {
    await assert.rejects(
      gateway.search({ q, workspace: "forge" }),
      (error) => {
        assert.ok(error instanceof MemoryGatewayError);
        assert.equal(error.status, status);
        assert.equal(error.message.includes(TOKEN), false);
        return true;
      },
    );
  }

  const timeoutGateway = createMemoryGateway({ endpoint, getToken: () => TOKEN, timeoutMs: 20 });
  await assert.rejects(
    timeoutGateway.search({ q: "timeout", workspace: "forge" }),
    (error) => {
      assert.ok(error instanceof MemoryGatewayError);
      assert.equal(error.status, 504);
      assert.equal(error.message.includes(TOKEN), false);
      return true;
    },
  );
});

test("backup é persistido atomicamente no destino interno", async (t) => {
  const { endpoint } = await createFixtureServer(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-backup-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "memory.tar.gz");
  const gateway = createMemoryGateway({ endpoint, getToken: () => TOKEN });

  const result = await gateway.backup({ target });
  assert.equal(fs.readFileSync(target, "utf8"), "backup-fixture");
  assert.equal(result.bytes, Buffer.byteLength("backup-fixture"));
  assert.deepEqual(fs.readdirSync(dir), ["memory.tar.gz"]);
});
