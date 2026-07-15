import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const VENDOR = path.join(ROOT, "integrations", "startup-user-simulator");

test("Startup User Simulator is pinned, MIT licensed and its HTML generator runs", () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(VENDOR, "FORGE-VENDOR.json"), "utf8"));
  assert.equal(provenance.commit, "834a2a37661743cc241a70781b859c1e68d08f99");
  assert.match(fs.readFileSync(path.join(VENDOR, "LICENSE"), "utf8"), /MIT License/);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-sim-vendor-"));
  const input = path.join(temp, "report.json");
  const output = path.join(temp, "report.html");
  fs.writeFileSync(input, JSON.stringify({
    title: "Forge simulation smoke",
    verdict: "Smoke verdict",
    personas: Array.from({ length: 5 }, (_, index) => ({ name: `P${index}`, score: 50 + index })),
    fixes: [{ rank: 1, change: "Clarify CTA", impact: "High", effort: "Small", confidence: "High" }],
    limits: ["Simulation, not observed user behavior."],
  }));
  const result = spawnSync("python", [
    path.join(VENDOR, "startup-user-simulator", "scripts", "generate_report.py"),
    input,
    output,
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const html = fs.readFileSync(output, "utf8");
  assert.match(html, /Five customers/);
  assert.match(html, /Forge simulation smoke/);
});
