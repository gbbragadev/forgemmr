import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertSafeEnvKey, cloudflarePagesDeployCommand, deployToCloudflarePages, waitUrl } from "../deploy.mjs";

function fixture(appId = "demo-app") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-deploy-"));
  fs.mkdirSync(path.join(root, "apps", appId, "out"), { recursive: true });
  fs.writeFileSync(path.join(root, "apps", appId, "out", "index.html"), "<!doctype html><title>demo</title>");
  return {
    root,
    pipeline: { appId, deploy: { target: "cf-pages", subdomain: appId, baseUrl: "example.com" } },
  };
}

function pagesProject(id, productionBranch = "main") {
  return {
    name: "demo-app",
    subdomain: "demo-app.pages.dev",
    production_branch: productionBranch,
    canonical_deployment: id ? { id } : null,
  };
}

function cloudflareRuntime({ afterDeploymentId = "new-deployment", dns = "correct", zone = "ok" } = {}) {
  const calls = [];
  let projectReads = 0;
  let healthCalls = 0;
  const domain = { name: "demo-app.example.com", status: "active", validation_data: { status: "active" } };
  const runtime = {
    accountId: "account-1",
    run(command) {
      calls.push({ type: "run", command });
      return { ok: true, output: "Deployment complete" };
    },
    async waitUrl() {
      healthCalls += 1;
      return { ok: true, status: 200 };
    },
    async cf(pathname, options = {}) {
      calls.push({ type: "cf", pathname, method: options.method || "GET" });
      if (pathname === "/accounts/account-1/pages/projects/demo-app") {
        projectReads += 1;
        return { ok: true, result: pagesProject(projectReads === 1 ? "old-deployment" : afterDeploymentId) };
      }
      if (pathname === "/accounts/account-1/pages/projects/demo-app/domains" && options.method === "POST") {
        return { ok: false, status: 409 };
      }
      if (pathname === "/accounts/account-1/pages/projects/demo-app/domains") return { ok: true, result: [domain] };
      if (pathname === "/zones?name=example.com") {
        return zone === "ok" ? { ok: true, result: [{ id: "zone-1" }] } : { ok: false, status: 403 };
      }
      if (pathname === "/zones/zone-1/dns_records?name=demo-app.example.com") {
        return dns === "correct"
          ? { ok: true, result: [{ id: "dns-1", type: "CNAME", content: "demo-app.pages.dev" }] }
          : { ok: true, result: [{ id: "dns-1", type: "A", content: "192.0.2.1" }] };
      }
      if (pathname === "/zones/zone-1/dns_records/dns-1" && options.method === "PATCH") return { ok: false, status: 403 };
      throw new Error(`chamada Cloudflare inesperada: ${options.method || "GET"} ${pathname}`);
    },
  };
  return { runtime, calls, healthCalls: () => healthCalls };
}

test("Cloudflare Pages usa master como branch de produção de projetos novos", () => {
  const command = cloudflarePagesDeployCommand("revisor-cetico-de");

  assert.match(command, /pages deploy apps\/revisor-cetico-de\/out/);
  assert.match(command, /--project-name revisor-cetico-de/);
  assert.match(command, /--branch master/);
  assert.throws(() => cloudflarePagesDeployCommand("app;malicioso"), /appId inválido/i);
});

test("assertSafeEnvKey aceita nomes de env e rejeita metacaracteres de shell", () => {
  assert.equal(assertSafeEnvKey("ZAI_API_KEY"), "ZAI_API_KEY");
  assert.equal(assertSafeEnvKey("OPEN_ROUTER_API_KEY"), "OPEN_ROUTER_API_KEY");
  assert.throws(() => assertSafeEnvKey("evil; calc"), /inválido/i);
  assert.throws(() => assertSafeEnvKey("a$(id)"), /inválido/i);
  assert.throws(() => assertSafeEnvKey("lowercase"), /inválido/i);
});

test("health pós-deploy rejeita 404 e aceita resposta 2xx", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not found", { status: 404 });
    assert.deepEqual(await waitUrl("https://example.test", [0]), { ok: false });

    globalThis.fetch = async () => new Response("ok", { status: 200 });
    assert.deepEqual(await waitUrl("https://example.test", [0]), { ok: true, status: 200 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deploy usa production_branch existente e aceita binding/CNAME já ativos", async () => {
  const { root, pipeline } = fixture();
  const { runtime, calls } = cloudflareRuntime();
  try {
    const result = await deployToCloudflarePages(pipeline, { root, log: () => {}, runtime });

    assert.equal(result.ok, true);
    assert.equal(result.url, "https://demo-app.example.com");
    assert.equal(result.dns.status, "ok");
    assert.match(calls.find((call) => call.type === "run").command, /--branch main/);
    assert.equal(calls.some((call) => call.method === "PATCH"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("deploy rejeita 200 antigo quando a produção canônica não avançou", async () => {
  const { root, pipeline } = fixture();
  const { runtime, healthCalls } = cloudflareRuntime({ afterDeploymentId: "old-deployment" });
  try {
    const result = await deployToCloudflarePages(pipeline, { root, log: () => {}, runtime });

    assert.equal(result.ok, false);
    assert.match(result.error, /produção.*não avançou/i);
    assert.equal(healthCalls(), 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("deploy rejeita falha de DNS mesmo se o domínio antigo responder 200", async () => {
  const { root, pipeline } = fixture();
  const { runtime, healthCalls } = cloudflareRuntime({ dns: "wrong" });
  try {
    const result = await deployToCloudflarePages(pipeline, { root, log: () => {}, runtime });

    assert.equal(result.ok, false);
    assert.match(result.error, /CNAME/i);
    assert.equal(healthCalls(), 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("deploy falha fechado quando a zona não pode ser comprovada", async () => {
  const { root, pipeline } = fixture();
  const { runtime, healthCalls } = cloudflareRuntime({ zone: "fail" });
  try {
    const result = await deployToCloudflarePages(pipeline, { root, log: () => {}, runtime });

    assert.equal(result.ok, false);
    assert.match(result.error, /zone/i);
    assert.equal(healthCalls(), 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
