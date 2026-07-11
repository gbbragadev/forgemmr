import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scaffoldProject, writeBriefArtifacts } from "../forge.mjs";
import { recordDecision, writeApproval } from "../decisions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_EXEC = path.join(__dirname, "..", "fake-exec.mjs");

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

test("writeBriefArtifacts escreve intake.json, brief.json e brief.md", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forge-"));
  const { briefMd } = writeBriefArtifacts({
    root: tmp, slug: "acme",
    intake: { company: "Acme", brand: "Acme", product: "X", campaign: "lançar" },
    brief: { problem: "baixa consideração", behavior: "experimentar", audience: "jovens" },
  });
  assert.ok(fs.existsSync(path.join(tmp, ".forge", "projects", "acme", "brief.json")));
  const md = fs.readFileSync(path.join(tmp, "docs", "acme", "brief.md"), "utf8");
  assert.match(md, /Acme/);
  assert.match(md, /baixa consideração/);
  const intakeBack = JSON.parse(fs.readFileSync(path.join(tmp, ".forge", "projects", "acme", "intake.json"), "utf8"));
  assert.equal(intakeBack.company, "Acme");
  const briefBack = JSON.parse(fs.readFileSync(path.join(tmp, ".forge", "projects", "acme", "brief.json"), "utf8"));
  assert.equal(briefBack.problem, "baixa consideração");
});

test("fake-exec cria artefato declarativo quando FORGE_FAKE_OUTFILE é set", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-fakeexec-"));
  const outFile = path.join(tmpDir, "campaign-strategy.md");
  const goal = "Job: STRATEGY\nApp: demo\nRepo: /fake";
  const env = {
    ...process.env,
    FORGE_FAKE_OUTFILE: outFile,
    FORGE_FAKE_SECTIONS: "Objetivo|Métricas",
  };
  try {
    execFileSync(process.execPath, [FAKE_EXEC, goal], { env, cwd: __dirname });
    assert.ok(fs.existsSync(outFile), `arquivo não foi criado: ${outFile}`);
    const content = fs.readFileSync(outFile, "utf8");
    assert.match(content, /## Objetivo/i, "faltou seção Objetivo");
    assert.match(content, /## Métricas/i, "faltou seção Métricas");
    assert.match(content, /STRATEGY/i, "faltou o job no título");
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {}
  }
});
