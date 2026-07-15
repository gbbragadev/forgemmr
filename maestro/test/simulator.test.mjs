import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applySimulationResult, selectAutomaticFixes, validateSimulationReport } from "../simulator.mjs";

function report(overrides = {}) {
  return {
    verdict: "Strongest-fit users continue; others need clearer proof.",
    biggest_leak: { title: "Proof", detail: "Missing proof", evidence: "Hero" },
    personas: Array.from({ length: 5 }, (_, index) => ({ name: `P${index + 1}`, score: 60 + index })),
    fixes: [
      { rank: 1, change: "Clarify hero CTA copy", impact: "High", effort: "Small", confidence: "High", auto_apply: true },
      { rank: 2, change: "Change billing and pricing model", impact: "High", effort: "Small", confidence: "High", auto_apply: true },
      { rank: 3, change: "Polish empty state", impact: "Medium", effort: "Small", confidence: "High", auto_apply: true },
      { rank: 4, change: "Add proof near CTA", impact: "Medium", effort: "Small", confidence: "Medium", auto_apply: false },
      { rank: 5, change: "Test shorter onboarding", impact: "Medium", effort: "Medium", confidence: "Medium", auto_apply: false },
    ],
    experiment: { title: "CTA test" },
    limits: ["This is a structured simulation, not observed user behavior."],
    ...overrides,
  };
}

test("simulation contract requires exactly five personas and a real-user disclaimer", () => {
  assert.equal(validateSimulationReport(report()).pass, true);
  assert.match(validateSimulationReport(report({ personas: [{ name: "one" }] })).detail, /cinco personas/);
  assert.match(validateSimulationReport(report({ limits: [] })).detail, /simulação.*pesquisa real/i);
});

test("automatic fixes are high-confidence, reversible and never touch protected domains", () => {
  const selected = selectAutomaticFixes(report());
  assert.deepEqual(selected.map((fix) => fix.change), ["Clarify hero CTA copy", "Polish empty state"]);
});

test("simulation injects exactly one ITERATE → B5 cycle before P3", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-sim-"));
  const pipeline = {
    appId: "demo",
    runId: "run-1",
    jobs: ["L1/B5", "SIMULATE", "P3"],
    jobIndex: 1,
  };
  const dir = path.join(root, "apps", "demo", "docs", "simulations");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "run-1.json"), JSON.stringify(report()));
  const first = applySimulationResult({ root, pipeline });
  const second = applySimulationResult({ root, pipeline });
  assert.equal(first.autoFixes.length, 2);
  assert.equal(second.autoFixes.length, 0);
  assert.deepEqual(pipeline.jobs, ["L1/B5", "SIMULATE", "ITERATE", "L1/B5", "P3"]);
  assert.match(pipeline.feedbackText, /Clarify hero CTA copy/);
});
