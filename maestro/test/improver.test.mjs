import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listAgents, listSkills } from "../toolbox.mjs";
import { buildImproverPrompt, parseImproved, mergeToolbox, improvePrompt } from "../improver.mjs";
import { loadProfile } from "../engine.mjs";

function tmpHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "forge-tb-"));
  fs.mkdirSync(path.join(home, "agents"), { recursive: true });
  fs.writeFileSync(
    path.join(home, "agents", "agency-perf-editor.md"),
    "---\nname: agency-perf-editor\ndescription: Finder de performance percebida em telas interativas.\ntools: Read, Grep\n---\ncorpo\n",
    "utf8"
  );
  fs.mkdirSync(path.join(home, "skills", "frontend-fable"), { recursive: true });
  fs.writeFileSync(
    path.join(home, "skills", "frontend-fable", "SKILL.md"),
    "---\nname: frontend-fable\ndescription: Método Fable de reforma de frontend com barra de design alta.\n---\ncorpo\n",
    "utf8"
  );
  return home;
}

// ---------- catálogo ----------

test("toolbox: lista agentes e skills do disco (name + description do frontmatter)", () => {
  const dir = tmpHome();
  const agents = listAgents([path.join(dir, "agents")]);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].name, "agency-perf-editor");
  assert.match(agents[0].description, /performance/i);

  const skills = listSkills([path.join(dir, "skills")]);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, "frontend-fable");
  assert.match(skills[0].description, /Fable/);
});

test("toolbox: diretório inexistente devolve [] (não explode)", () => {
  assert.deepEqual(listAgents([path.join(os.tmpdir(), "nao-existe-123")]), []);
  assert.deepEqual(listSkills([path.join(os.tmpdir(), "nao-existe-123")]), []);
});

// ---------- meta-prompt ----------

test("meta-prompt: carrega prompt original delimitado, catálogo e o arquivo de saída", () => {
  const meta = buildImproverPrompt({
    original: "Job: L1/B3\nFaça a UI.",
    job: "L1/B3",
    player: { name: "Grok", cli: "grok", modelLabel: "Grok 4.5" },
    appId: "demo",
    outFile: "C:/tmp/out.json",
    agents: [{ name: "agency-mobile", description: "mobile" }],
    skills: [{ name: "frontend-fable", description: "frontend" }],
    supportsToolbox: false,
  });
  assert.match(meta, /<<<PROMPT_ORIGINAL>>>[\s\S]*Faça a UI[\s\S]*<<<FIM_PROMPT_ORIGINAL>>>/);
  assert.ok(meta.includes("C:/tmp/out.json"), "precisa dizer onde gravar o JSON");
  assert.ok(meta.includes("agency-mobile") && meta.includes("frontend-fable"), "catálogo no prompt");
  assert.match(meta, /NÃO (remova|invente)/i, "precisa proibir remover restrições");
});

// ---------- parse + merge ----------

test("parse: JSON válido devolve prompt/skills/agents; lixo devolve null", () => {
  const ok = parseImproved(JSON.stringify({ prompt: "x".repeat(60), skills: ["a"], agents: ["b"] }), "x".repeat(50));
  assert.equal(ok.prompt.length, 60);
  assert.deepEqual(ok.skills, ["a"]);
  assert.equal(parseImproved("não é json", "orig"), null);
  assert.equal(parseImproved(JSON.stringify({ skills: [] }), "orig"), null, "sem prompt → inválido");
});

test("parse: prompt truncado (muito menor que o original) é REJEITADO — não perde restrições", () => {
  const original = "R".repeat(1000);
  assert.equal(parseImproved(JSON.stringify({ prompt: "curto demais" }), original), null);
});

test("merge: anexa ferramentas só quando o executor suporta (claude/glm)", () => {
  const base = "PROMPT";
  const imp = { prompt: base, skills: ["frontend-fable"], agents: ["agency-mobile"] };
  const comTool = mergeToolbox(imp, true);
  assert.match(comTool, /FERRAMENTAS SUGERIDAS/);
  assert.match(comTool, /frontend-fable/);
  assert.match(comTool, /agency-mobile/);
  assert.equal(mergeToolbox(imp, false), base, "executor sem skills/subagentes não recebe a seção");
});

// ---------- fluxo (com executor fake — zero quota) ----------

test("improvePrompt: cli fake escreve o JSON e o prompt volta melhorado", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-imp-"));
  const original = "Job: L0/P0\nApp: demo\n" + "conteúdo original ".repeat(20);
  const res = await improvePrompt({
    root,
    job: "L0/P0",
    appId: "demo",
    runId: "run-1",
    player: { name: "Fake", cli: "fake", modelLabel: "Fake" },
    prompt: original,
    cfg: { enabled: true, cli: "fake", model: "default", effort: "high", timeoutMs: 60000 },
    log: () => {},
  });
  assert.equal(res.improved, true, "deveria ter melhorado");
  assert.ok(res.prompt.includes("conteúdo original"), "o prompt melhorado preserva o conteúdo");
  assert.ok(res.prompt.length >= original.length, "não pode encolher o prompt");
});

test("improvePrompt: falha do improver cai no prompt ORIGINAL (nunca bloqueia a pipeline)", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-imp2-"));
  const original = "prompt original intacto " + "x".repeat(200);
  const res = await improvePrompt({
    root,
    job: "L0/P0",
    appId: "demo",
    runId: "run-2",
    player: { name: "X", cli: "fake", modelLabel: "X" },
    prompt: original,
    cfg: { enabled: true, cli: "cli-que-nao-existe-xyz", model: "m", effort: "high", timeoutMs: 5000 },
    log: () => {},
  });
  assert.equal(res.improved, false);
  assert.equal(res.prompt, original);
});

test("improvePrompt: desligado no profile devolve o original sem spawnar nada", async () => {
  const res = await improvePrompt({
    root: os.tmpdir(),
    job: "L0/P0",
    appId: "demo",
    runId: "r",
    player: { name: "X", cli: "grok" },
    prompt: "original",
    cfg: { enabled: false },
    log: () => {},
  });
  assert.equal(res.improved, false);
  assert.equal(res.prompt, "original");
});

// ---------- default do profile ----------

test("profile: promptImprover default = codex · gpt-5.6-terra · high, ligado", () => {
  const prof = loadProfile(fs.mkdtempSync(path.join(os.tmpdir(), "forge-prof-")));
  assert.equal(prof.promptImprover.enabled, true);
  assert.equal(prof.promptImprover.cli, "codex");
  assert.equal(prof.promptImprover.model, "gpt-5.6-terra");
  assert.equal(prof.promptImprover.effort, "high");
});
