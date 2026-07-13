import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSpawn } from "../adapters.mjs";

const ROOT = process.cwd();

test("grok: effort REAL vai como --effort (era etiqueta por omissão do flag)", () => {
  const spec = buildSpawn("grok", "goal x", { root: ROOT, effort: "high" });
  const i = spec.args.indexOf("--effort");
  assert.ok(i >= 0, "faltou --effort nos args do grok");
  assert.equal(spec.args[i + 1], "high");
});

test("grok: sem effort (ou effort inválido) não passa flag", () => {
  assert.ok(!buildSpawn("grok", "g", { root: ROOT }).args.includes("--effort"));
  assert.ok(!buildSpawn("grok", "g", { root: ROOT, effort: "High!" }).args.includes("--effort"));
});

test("codex: effort real via -c model_reasoning_effort (incl. max da família 5.6)", () => {
  const spec = buildSpawn("codex", "goal", { root: ROOT, model: "gpt-5.6-sol", effort: "max" });
  assert.ok(spec.args.includes("model_reasoning_effort=max"));
  assert.ok(spec.args.includes("gpt-5.6-sol"));
});

test("claude: model é repassado como --model (Fable 5 = claude-fable-5)", () => {
  const spec = buildSpawn("claude", "goal", { root: ROOT, model: "claude-fable-5" });
  const i = spec.args.indexOf("--model");
  assert.ok(i >= 0);
  assert.equal(spec.args[i + 1], "claude-fable-5");
});

test("codex: sandbox religável por env (FORGE_CODEX_SANDBOX) — default é sem sandbox (helper do Windows ausente)", () => {
  const semEnv = buildSpawn("codex", "goal", { root: ROOT });
  assert.ok(semEnv.args.includes("--dangerously-bypass-approvals-and-sandbox"));

  process.env.FORGE_CODEX_SANDBOX = "workspace-write";
  const comSandbox = buildSpawn("codex", "goal", { root: ROOT });
  assert.ok(!comSandbox.args.includes("--dangerously-bypass-approvals-and-sandbox"), "com a env, nada de bypass");
  assert.ok(comSandbox.args.includes("--sandbox") && comSandbox.args.includes("workspace-write"));
  assert.ok(comSandbox.args.includes("never"), "aprovação never (headless)");

  process.env.FORGE_CODEX_SANDBOX = "modo inválido; rm -rf /"; // injeção não passa pelo regex
  assert.ok(buildSpawn("codex", "g", { root: ROOT }).args.includes("--dangerously-bypass-approvals-and-sandbox"));
  delete process.env.FORGE_CODEX_SANDBOX;
});

test("prompt gigante vai por ARQUIVO (Windows: >32k chars em argv = spawn ENAMETOOLONG)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-arg-"));
  const huge = "Job: L0/P1\nApp: demo\n" + "conteúdo enorme da ideia. ".repeat(2000); // ~50k chars
  assert.ok(huge.length > 32767, "pré-condição: prompt maior que o limite do Windows");

  const spec = buildSpawn("grok", huge, { root });
  const argv = spec.args.join(" ");
  assert.ok(argv.length < 4000, `linha de comando deveria ficar curta (ficou ${argv.length})`);
  assert.ok(argv.includes("PROMPT_FILE:"), "o CLI precisa receber a referência ao arquivo");

  const file = (argv.match(/PROMPT_FILE: (\S+\.md)/) || [])[1];
  assert.ok(file && fs.existsSync(file), "o arquivo do prompt precisa existir em disco");
  assert.equal(fs.readFileSync(file, "utf8"), huge, "o arquivo carrega o prompt ORIGINAL inteiro");
});

test("prompt pequeno continua inline (sem arquivo)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-arg2-"));
  const spec = buildSpawn("grok", "prompt curto", { root });
  assert.ok(spec.args.includes("prompt curto"));
  assert.ok(!spec.args.join(" ").includes("PROMPT_FILE:"));
  assert.ok(!fs.existsSync(path.join(root, "maestro", ".prompts")), "não deveria criar arquivo à toa");
});

test("fake-exec recebe FORGE_PROMPT_FILE quando o prompt é externalizado (dry-run não quebra)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-arg3-"));
  const huge = "Job: L0/P0\nApp: demo\n" + "x".repeat(40000);
  const spec = buildSpawn("fake", huge, { root });
  assert.ok(spec.env.FORGE_PROMPT_FILE && fs.existsSync(spec.env.FORGE_PROMPT_FILE));
});
