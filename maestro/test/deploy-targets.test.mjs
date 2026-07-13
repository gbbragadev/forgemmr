import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deployApp } from "../deploy.mjs";

async function withPagesRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-deploy-target-"));
  const workflowsDir = path.join(root, ".github", "workflows");
  let server;
  try {
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(path.join(workflowsDir, "deploy-pages.yml"), "# deploy-pages\n", "utf8");
    server = http.createServer((_req, res) => res.end("ok"));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    await run({ root, url: `http://127.0.0.1:${port}` });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function pipeline(target) {
  return { appId: "test-app", deploy: { target } };
}

function options(root, ghPagesUrl, logs) {
  return {
    root,
    log: (line) => logs.push(line),
    profileDeploy: { ghPagesUrl },
    limits: { deployRetryDelaysMs: [0] },
  };
}

test("gh-pages e seu alias legado despacham para GitHub Pages", async () => {
  await withPagesRoot(async ({ root, url }) => {
    for (const target of ["gh-pages", "gh-pages-path"]) {
      const logs = [];
      const result = await deployApp(pipeline(target), options(root, url, logs));
      assert.deepEqual(result, { ok: true, url, dns: { status: "ok" } });
      assert.ok(logs.some((line) => line.includes("GitHub Pages")), `${target} deveria logar GitHub Pages`);
    }
  });
});

test("target inválido oferece apenas o nome canônico gh-pages", async () => {
  const result = await deployApp(pipeline("invalid"), { root: process.cwd(), log: () => {} });
  assert.equal(result.ok, false);
  assert.match(result.fallbackSteps[0], /gh-pages/);
  assert.doesNotMatch(result.fallbackSteps[0], /gh-pages-path/);
});
