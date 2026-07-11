import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlueprint, interpolate } from "../blueprint-loader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("interpolate substitui ${appId} e deixa placeholder desconhecido", () => {
  assert.equal(interpolate("docs/${appId}/x.md", { appId: "acme" }), "docs/acme/x.md");
  assert.equal(interpolate("porta ${port}", { port: 8799 }), "porta 8799");
  assert.equal(interpolate("keep ${nope}", {}), "keep ${nope}");
});

test("generic é sentinela (external:false, sem jobs)", () => {
  const bp = loadBlueprint("generic", { root: ROOT });
  assert.equal(bp.external, false);
  assert.equal(bp.jobs, undefined);
});

test("blueprint desconhecido lança", () => {
  assert.throws(() => loadBlueprint("naoexiste", { root: ROOT }), /blueprint/i);
});

test("gameads carrega os 3 jobs de onboarding com verify de arquivo", () => {
  const bp = loadBlueprint("gameads", { root: ROOT });
  assert.equal(bp.external, true);
  assert.deepEqual(bp.jobs, ["STRATEGY", "CONCEPTS", "EXPERIENCE-PLAN"]);
  const strat = bp.jobSpecs["STRATEGY"];
  assert.equal(strat.verify.type, "file");
  assert.match(strat.verify.path, /campaign-strategy\.md$/);
  assert.equal(bp.jobSpecs["CONCEPTS"].gate.id, "concept-review");
  assert.equal(bp.jobSpecs["EXPERIENCE-PLAN"].gate.id, "experience-plan-review");
});
