import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createEngineManager, normalizeDeployHost } from "../engine.mjs";

test("normalizeDeployHost remove vercel", () => {
  assert.equal(normalizeDeployHost("vercel", { forChat: true }), "cf-workers");
  assert.equal(normalizeDeployHost("vercel", { forChat: false }), "cf-pages");
  assert.equal(normalizeDeployHost("cf-workers"), "cf-workers");
});

test("startShip reabre killed com gate deploy e target CF", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-ship-"));
  const appId = "pmoc-acceptance-gate";
  try {
    fs.mkdirSync(path.join(root, "maestro", "pipelines"), { recursive: true });
    fs.mkdirSync(path.join(root, "maestro", "runs"), { recursive: true });
    fs.mkdirSync(path.join(root, "workbench"), { recursive: true });
    for (const f of ["QUEUE.md", "CLAIMS.md", "HANDOFF.md"]) {
      fs.writeFileSync(path.join(root, "workbench", f), `# ${f}\n\n## Doing\n\n## Done\n\n`, "utf8");
    }
    fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".forge", "profile.md"),
      '# T\n\n```forge-config\n{"name":"T","deploy":{"baseUrl":"gbbragadev.com","staticHost":"cf-pages","serverHost":"cf-workers"}}\n```\n',
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "maestro", "roster.json"),
      JSON.stringify({
        players: [{ id: "fake", name: "Fake", cli: "fake" }],
        teams: { "dry-run": { label: "Dry", dispatch: { default: "fake" }, fallbacks: {} } },
      }),
      "utf8"
    );

    const dir = path.join(root, "apps", appId);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "next.config.ts"), "export default {};\n", "utf8");
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `@forge/${appId}` }), "utf8");
    execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@forge.local"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Forge Test"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["branch", "-M", "master"], { cwd: dir, stdio: "ignore" });

    fs.writeFileSync(
      path.join(root, "maestro", "pipelines", `${appId}.json`),
      JSON.stringify({
        appId,
        status: "killed",
        capability: "chat",
        jobs: ["P3"],
        jobIndex: 0,
        history: [],
        gates: [],
        deploy: { target: "vercel", subdomain: appId, baseUrl: "example.com" },
        git: { branch: "master", checkpoints: [], lastCheckpoint: null },
      }),
      "utf8"
    );

    const manager = createEngineManager({
      root,
      emitLog: () => {},
      emitPipeline: () => {},
    });
    const snap = manager.startShip({
      appId,
      target: "cf-workers",
      subdomain: "pmoc-acceptance-gate",
    });
    assert.equal(snap.status, "paused_gate");
    assert.equal(snap.deploy.target, "cf-workers");
    assert.equal(snap.deploy.baseUrl, "gbbragadev.com");
    assert.equal(snap.deploy.subdomain, "pmoc-acceptance-gate");
    assert.deepEqual(snap.jobs, ["P3"]);
    const gate = snap.gates.find((g) => !g.decision);
    assert.equal(gate?.id, "deploy");
    assert.match(String(gate.prompt), /Redeploy|cf-workers/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
