import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveMemoryLayout } from "../memory/layout.mjs";
import { createMemoryService } from "../memory/service.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const enabled = process.env.FORGE_MEMORY_REAL_SMOKE === "1"
  && process.platform === "win32"
  && process.arch === "x64";

test("runtime real grava, busca, isola apps e drena a outbox após restart", {
  skip: !enabled,
  timeout: 120_000,
}, async (t) => {
  const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-real-"));
  const layout = resolveMemoryLayout({ env: { LOCALAPPDATA: localAppData }, platform: "win32" });
  let service = createMemoryService({ root, layout });
  t.after(async () => {
    await service.close().catch(() => {});
    fs.rmSync(localAppData, { recursive: true, force: true });
  });

  const setup = await service.setup();
  assert.equal(setup.state, "healthy", setup.lastError || "runtime não ficou saudável");
  assert.equal(setup.managed, true);

  const alphaWrite = await service.record({ type: "rule", appId: "alpha", summary: "alpha-only-memory", actor: "real-smoke" });
  const betaWrite = await service.record({ type: "rule", appId: "beta", summary: "beta-only-memory", actor: "real-smoke" });
  assert.equal(alphaWrite.queued, false);
  assert.equal(betaWrite.queued, false);
  const alphaPage = await service.readPage({ appId: "alpha", pagePath: alphaWrite.path });
  const alphaBody = alphaPage.body ?? alphaPage.body_markdown;
  assert.ok(typeof alphaBody === "string", JSON.stringify(alphaPage));
  assert.match(alphaBody, /alpha-only-memory/);

  const alpha = await service.search({ q: "alpha-only-memory", appId: "alpha" });
  const beta = await service.search({ q: "alpha-only-memory", appId: "beta" });
  assert.ok(
    (alpha.hits || alpha.results || []).length >= 1,
    JSON.stringify({ alphaWrite, alphaPage, alphaSearch: alpha }),
  );
  assert.equal((beta.hits || beta.results || []).length, 0);

  assert.equal(await service.close(), true);
  service = createMemoryService({ root, layout });
  const queued = await service.record({
    type: "outcome",
    appId: "alpha",
    summary: "queued-across-real-restart",
    outcome: "pass",
    actor: "real-smoke",
  });
  assert.equal(queued.queued, true);
  assert.equal(service.status().pendingOutbox, 1);

  const restarted = await service.startIfInstalled();
  assert.equal(restarted.state, "healthy", restarted.lastError || "restart não ficou saudável");
  assert.equal(service.status().pendingOutbox, 0);
  const recovered = await service.search({ q: "queued-across-real-restart", appId: "alpha" });
  assert.ok((recovered.hits || recovered.results || []).length >= 1);
});
