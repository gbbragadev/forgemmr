import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scaffoldProject } from "../forge.mjs";
import { recordDecision, writeApproval } from "../decisions.mjs";

test("scaffoldProject cria project.json com blueprint e slug", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
  const dir = scaffoldProject({ root: tmp, blueprint: "gameads", slug: "acme-launch", name: "Acme", idea: "lançar produto" });
  const j = JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8"));
  assert.equal(j.blueprint, "gameads");
  assert.equal(j.slug, "acme-launch");
  assert.equal(j.status, "intake-pending");
});

test("recordDecision numera sequencial e é append-only", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
  const pdir = path.join(tmp, "proj"); fs.mkdirSync(path.join(pdir, "decisions"), { recursive: true });
  const a = recordDecision({ projectDir: pdir, gateId: "brief-review", choice: "go" });
  const b = recordDecision({ projectDir: pdir, gateId: "concept-review", choice: "b" });
  assert.match(a, /001-brief-review\.json$/);
  assert.match(b, /002-concept-review\.json$/);
});

test("writeApproval não sobrescreve approval existente", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
  const pdir = path.join(tmp, "proj"); fs.mkdirSync(pdir, { recursive: true });
  writeApproval({ projectDir: pdir, payload: { approvedConcept: "b", version: 1 } });
  writeApproval({ projectDir: pdir, payload: { approvedConcept: "c", version: 2 } }); // deve ser no-op
  const j = JSON.parse(fs.readFileSync(path.join(pdir, "approval.json"), "utf8"));
  assert.equal(j.approvedConcept, "b"); // primeiro venceu
});
