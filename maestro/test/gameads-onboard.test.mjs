import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scaffoldProject } from "../forge.mjs";

test("scaffoldProject cria project.json com blueprint e slug", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
  const dir = scaffoldProject({ root: tmp, blueprint: "gameads", slug: "acme-launch", name: "Acme", idea: "lançar produto" });
  const j = JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8"));
  assert.equal(j.blueprint, "gameads");
  assert.equal(j.slug, "acme-launch");
  assert.equal(j.status, "intake-pending");
});
