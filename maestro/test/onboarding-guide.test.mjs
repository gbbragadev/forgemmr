import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, GATES, STAGES, TEAMS, filterCommands, resolveGate } from "../../docs/forge-onboarding/guide-data.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const guideDir = path.join(root, "docs", "forge-onboarding");

test("modelo cobre o ciclo, times, comandos e gates reais do Forge", () => {
  assert.deepEqual(STAGES.map((stage) => stage.id), ["idea", "p0", "foundation", "ds-gen", "p1", "build", "ship", "measure", "decide"]);
  assert.deepEqual(TEAMS.map((team) => team.id), ["dry-run", "grok-solo", "grok-glm-front", "quality"]);
  for (const command of ["profile init", "team", "new", "onboard", "attach", "status", "stats", "decide", "target", "feedback", "restart", "stop", "resume", "kill", "remove", "roster"]) {
    assert.ok(COMMANDS.some((item) => item.command.includes(command)), `comando ausente: ${command}`);
  }
  assert.deepEqual(Object.keys(GATES), ["p0-go", "b3-visual", "deploy"]);
});

test("busca combina texto e categoria sem perder o catálogo", () => {
  assert.ok(filterCommands("métricas", "all").some((item) => item.command.includes("stats")));
  assert.ok(filterCommands("", "recover").every((item) => item.category === "recover"));
  assert.equal(filterCommands("sem resultado", "all").length, 0);
});

test("simulador de gate devolve efeito e comando sem executar nada", () => {
  assert.match(resolveGate("p0-go", "go").command, /forge -- decide p0-go go/);
  assert.match(resolveGate("deploy", "kill").effect, /não publica/i);
  assert.throws(() => resolveGate("inexistente", "go"), /gate desconhecido/);
});

test("página ensina o Forge Nexus inteiro sem depender de terminal", () => {
  const html = fs.readFileSync(path.join(guideDir, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(guideDir, "guide.js"), "utf8");
  assert.match(html, /<html lang="pt-BR">/);
  for (const id of ["start", "journey", "memory", "gate-lab", "recovery", "privacy", "ship-checklist"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="gate-output"[^>]*aria-live="polite"/);
  assert.match(html, /destrutiv|irreversível/i);
  for (const phrase of ["Forge Nexus", "Memória", "Instalar memória", "Importar histórico", "Continuar sem memória", "127.0.0.1:8799"]) {
    assert.match(html + js, new RegExp(phrase, "i"));
  }
  assert.doesNotMatch(html + js, /AI_MEMORY_AUTH_TOKEN/);
  assert.doesNotMatch(js, /fetch\s*\(\s*["'`]http:\/\/127\.0\.0\.1/);
});

test("CSS cobre tokens, foco, motion reduzido e quatro larguras", () => {
  const css = fs.readFileSync(path.join(guideDir, "guide.css"), "utf8");
  for (const token of ["--ink", "--paper", "--accent", "--verified", "--warning", "--danger"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.page-grid\s*>\s*main\s*{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(css, /margin-inline:\s*calc\(50%\s*-\s*50vw\)/);
  assert.match(css, /@media \(max-width: 375px\)[\s\S]*?\.steps-list li\.step-featured\s*{[^}]*margin-inline:\s*0/s);
  for (const width of [375, 768, 1024, 1440]) assert.match(css, new RegExp(`${width}px`));
});

test("headers publicados bloqueiam sniffing e framing", () => {
  const headers = fs.readFileSync(path.join(guideDir, "_headers"), "utf8");
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
});

test("bindings conectam percurso, memória, gates, checklist e navegação", () => {
  const js = fs.readFileSync(path.join(guideDir, "guide.js"), "utf8");
  for (const name of ["renderJourney", "renderMemoryState", "renderGateDecisions", "setGateOutput", "setupMemoryLab", "setupScrollSpy", "setupChecklist"]) {
    assert.match(js, new RegExp(`function ${name}`));
  }
  assert.match(js, /resolveGate\(/);
});

test("assets evitam MIME ambíguo e request de favicon ausente", () => {
  const html = fs.readFileSync(path.join(guideDir, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(guideDir, "guide.js"), "utf8");
  assert.ok(fs.existsSync(path.join(guideDir, "guide-data.js")));
  assert.match(js, /\.\/guide-data\.js/);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
});

test("escopo local declara ESM sem alterar o package raiz", () => {
  const packageScope = JSON.parse(fs.readFileSync(path.join(guideDir, "package.json"), "utf8"));
  assert.deepEqual(packageScope, { private: true, type: "module" });
});
