import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  queueStart,
  queueDone,
  claimSet,
  claimFree,
  handoffUpdate,
  purgeApp,
} from "../workbench.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-wb-"));
  const wb = path.join(root, "workbench");
  fs.mkdirSync(wb, { recursive: true });
  fs.writeFileSync(
    path.join(wb, "QUEUE.md"),
    "# QUEUE\n\n## Backlog\n\n## Doing\n\n## Done\n\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(wb, "CLAIMS.md"),
    "# CLAIMS\n\n| F | agent | loop | job | app | hhmm | nota |\n|------|------|------|------|------|------|------|\n| — | — | — | — | — | — | livre |\n",
    "utf8"
  );
  fs.writeFileSync(path.join(wb, "HANDOFF.md"), "# HANDOFF\n\n", "utf8");
  return { root, paths: { root } };
}

test("queueStart e queueDone movem linhas Doing → Done", () => {
  const { root, paths } = fixture();
  try {
    queueStart(paths, "L1/B1", "demo-app");
    let q = fs.readFileSync(path.join(root, "workbench", "QUEUE.md"), "utf8");
    assert.match(q, /\*\*L1\/B1\*\* demo-app/);
    queueDone(paths, "L1/B1", "demo-app", "grok1");
    q = fs.readFileSync(path.join(root, "workbench", "QUEUE.md"), "utf8");
    assert.doesNotMatch(q, /- \[ \] \*\*L1\/B1\*\* demo-app/);
    assert.match(q, /## Done[\s\S]*- \[x\] \*\*L1\/B1\*\* demo-app — forge\/grok1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("claimSet substitui row livre e claimFree libera por app", () => {
  const { root, paths } = fixture();
  try {
    claimSet(paths, "claude-opus", "L1", "L1/B2", "app-a");
    let c = fs.readFileSync(path.join(root, "workbench", "CLAIMS.md"), "utf8");
    assert.match(c, /claude-opus/);
    assert.match(c, /app-a/);
    claimFree(paths, "app-a");
    c = fs.readFileSync(path.join(root, "workbench", "CLAIMS.md"), "utf8");
    assert.match(c, /livre/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("dois queueStart de apps diferentes coexistem", () => {
  const { root, paths } = fixture();
  try {
    queueStart(paths, "L0/P0", "app-one");
    queueStart(paths, "L0/P0", "app-two");
    const q = fs.readFileSync(path.join(root, "workbench", "QUEUE.md"), "utf8");
    assert.match(q, /app-one/);
    assert.match(q, /app-two/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("handoffUpdate e purgeApp não derrubam com paths válidos", () => {
  const { root, paths } = fixture();
  try {
    handoffUpdate(paths, {
      appId: "demo",
      idea: "ideia teste",
      status: "running",
      currentJob: "L1/B1",
      team: "t",
      runId: "r1",
      jobs: ["L1/B1"],
      jobIndex: 0,
      gates: [],
      git: { branch: "pipeline/demo", checkpoints: [] },
    });
    const h = fs.readFileSync(path.join(root, "workbench", "HANDOFF.md"), "utf8");
    assert.match(h, /demo/);
    assert.match(h, /L1\/B1/);
    purgeApp(paths, "demo");
    const h2 = fs.readFileSync(path.join(root, "workbench", "HANDOFF.md"), "utf8");
    assert.doesNotMatch(h2, /forge:begin:demo/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
