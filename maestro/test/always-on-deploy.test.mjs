import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAlwaysOnDeployManager, listAlwaysOnDeployments } from "../control/always-on-deploy.mjs";
import { createActionCatalog } from "../control/catalog.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-always-on-"));
  fs.mkdirSync(path.join(root, "apps", "probe-app"), { recursive: true });
  let clock = Date.parse("2026-07-19T12:00:00.000Z");
  return { root, manager: createAlwaysOnDeployManager({ root, now: () => clock++ }) };
}

test("deploy Always-On separa prepare, confirmação, evidência de publicação e verificação", () => {
  const fx = fixture();
  try {
    const prepared = fx.manager.prepare({
      appId: "probe-app",
      sourceRoot: path.join(fx.root, "apps", "probe-app"),
      visibility: "private",
      startCommand: "npm.cmd start",
      persistentData: "SQLite em data/",
      workload: "20 usuários internos, pico 5 req/s",
      slo: "99% mensal; p95 abaixo de 2s",
      healthCheck: "GET /api/health",
      actor: "guilherme",
    });
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.handoff.skill, "always-on-deploy");
    assert.equal("commandOutput" in prepared, false);
    assert.throws(() => fx.manager.recordPublished({ appId: "probe-app" }), /esperado confirmed/);

    const confirmed = fx.manager.confirm({ appId: "probe-app", reviewed: true, why: "Contrato operacional revisado", actor: "guilherme" });
    assert.equal(confirmed.status, "confirmed");
    fs.mkdirSync(path.join(fx.root, "releases", "probe-app", "abc123"), { recursive: true });
    const published = fx.manager.recordPublished({
      appId: "probe-app",
      revision: "abc123",
      releasePath: path.join(fx.root, "releases", "probe-app", "abc123"),
      tasks: "probe-app-start\nprobe-app-health",
      healthUrl: "http://127.0.0.1:8080/api/health",
      capacityEvidence: "smoke local 5 req/s",
      rollbackEvidence: "release anterior preservada",
      actor: "always-on-deploy",
    });
    assert.equal(published.status, "published");
    assert.deepEqual(published.publication.tasks, ["probe-app-start", "probe-app-health"]);

    const verified = fx.manager.verify({
      appId: "probe-app",
      localHealth: "pass",
      ownership: "pass",
      externalHealth: "not-applicable",
      capacity: "not-measured",
      rollback: "not-tested",
      actor: "guilherme",
      notes: "Pendências visíveis, sem fingir evidência.",
    });
    assert.equal(verified.status, "verified");
    assert.deepEqual(verified.verification.pending, ["capacity", "rollback"]);
    assert.equal(listAlwaysOnDeployments(fx.root)[0].status, "verified");
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test("deploy público exige hostname e health externo; catálogo só libera após ship ou scale", () => {
  const fx = fixture();
  try {
    const base = {
      appId: "probe-app",
      sourceRoot: path.join(fx.root, "apps", "probe-app"),
      visibility: "public",
      startCommand: "npm.cmd start",
      persistentData: "sem dados persistentes",
      workload: "10 req/s",
      slo: "99% mensal",
      healthCheck: "GET /health",
      actor: "guilherme",
    };
    assert.throws(() => fx.manager.prepare(base), /hostname/);
    const idle = createActionCatalog({ pipelines: [{ appId: "probe-app", status: "idle" }] });
    assert.equal(idle.find(item => item.id === "always-on.prepare")?.enabled, false);
    const shipped = createActionCatalog({ pipelines: [{ appId: "probe-app", status: "done" }] });
    assert.equal(shipped.find(item => item.id === "always-on.prepare")?.enabled, true);
    const scaled = createActionCatalog({ lifecycle: [{ appId: "probe-app", p5: { decision: "scale" } }] });
    assert.equal(scaled.find(item => item.id === "always-on.prepare")?.enabled, true);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});
