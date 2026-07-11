import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlan, JOBS_BY_CAPABILITY } from "../engine.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("generic: resolvePlan devolve JOBS_BY_CAPABILITY intacto e sem jobSpecs", () => {
  for (const cap of ["static", "quiz", "chat"]) {
    const plan = resolvePlan({ root: ROOT, blueprint: "generic", capability: cap, appId: "demo" });
    assert.deepEqual(plan.jobs, JOBS_BY_CAPABILITY[cap]);
    assert.equal(plan.jobSpecs, null);
  }
});

test("gameads: resolvePlan devolve os 3 jobs + jobSpecs", () => {
  const plan = resolvePlan({ root: ROOT, blueprint: "gameads", capability: "static", appId: "acme" });
  assert.deepEqual(plan.jobs, ["STRATEGY", "CONCEPTS", "EXPERIENCE-PLAN"]);
  assert.equal(plan.jobSpecs.STRATEGY.verify.type, "file");
});
