import { test } from "node:test";
import assert from "node:assert/strict";
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
