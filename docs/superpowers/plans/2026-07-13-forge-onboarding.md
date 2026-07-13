# Forge Visual Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar um tutorial visual que ensine o fluxo completo do Forge, do primeiro dry-run à operação, recuperação, deploy e métricas.

**Architecture:** Um site estático em `docs/forge-onboarding/` separa conteúdo semântico (`index.html`), apresentação (`guide.css`), modelo puro e testável (`guide-data.js`) e bindings do navegador (`guide.js`). Testes `node:test` validam o contrato de conteúdo, o modelo de gates/comandos, acessibilidade básica e proteções contra exposição de dados antes do deploy isolado no Cloudflare Pages.

**Tech Stack:** HTML5, CSS, JavaScript ESM, `node:test`, servidor HTTP local do Node, Cloudflare Pages via Wrangler `4.108.0`.

**Status em 2026-07-13:** concluído. As tarefas abaixo preservam o roteiro e as evidências RED/GREEN; aceite final: 108/108 testes, QA responsivo sem overflow e deploy público em `https://forge-onboarding.pages.dev/`.

## Global Constraints

- Não adicionar dependências ao projeto nem alterar `package-lock.json`.
- Não tocar no engine, roster, pipelines ou apps publicados.
- Não incluir segredo, token, telefone, caminho pessoal ou dado privado.
- O tutorial apenas explica comandos; o navegador nunca executa comandos do Forge.
- Mobile-first com validação em 375, 768, 1024 e 1440 px.
- Respeitar `prefers-reduced-motion`, navegação por teclado e contraste WCAG AA.
- Aceite mínimo do deploy: URL `*.pages.dev` com HTTP 200 e conteúdo do Forge; domínio próprio é apenas best effort com credencial já existente.
- Preservar as mudanças preexistentes em `package-lock.json`, `.claude/` e `.codebase-memory/`.
- A implementação e o fechamento entram em um único commit, conforme a especificação aprovada.

## File Map

- Create `docs/forge-onboarding/index.html`: estrutura semântica, conteúdo editorial e pontos de montagem das interações.
- Create `docs/forge-onboarding/guide.css`: tokens, layout, responsividade, estados, motion e acessibilidade visual.
- Create `docs/forge-onboarding/guide-data.js`: catálogo de comandos, etapas, times, gates e funções puras de busca/simulação.
- Create `docs/forge-onboarding/guide.js`: renderização e eventos de navegação, busca, filtros, clipboard e simulador.
- Create `docs/forge-onboarding/package.json`: escopo ESM local sem alterar o package raiz.
- Create `docs/forge-onboarding/_headers`: headers de segurança e cache para Cloudflare Pages.
- Create `maestro/test/onboarding-guide.test.mjs`: contrato automatizado do tutorial.
- Modify `workbench/HANDOFF.md`, `workbench/QUEUE.md`, `workbench/CLAIMS.md`: fechamento da iteração, URL e claim liberado.

---

### Task 1: Modelo de conteúdo e contrato de segurança

**Files:**
- Create: `maestro/test/onboarding-guide.test.mjs`
- Create: `docs/forge-onboarding/guide-data.js`

**Interfaces:**
- Produces: `STAGES`, `TEAMS`, `COMMANDS`, `GATES`, `filterCommands(query, category)`, `resolveGate(gateId, decision)`.
- Consumes: comandos reais de `forge help`, `README.md` e `docs/MAESTRO.md`.

- [ ] **Step 1: Write the failing model test**

Create `maestro/test/onboarding-guide.test.mjs` with imports and assertions that require the missing module:

```js
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
  assert.match(resolveGate("p0-go", "go").command, /forge decide p0-go go/);
  assert.match(resolveGate("deploy", "kill").effect, /não publica/i);
  assert.throws(() => resolveGate("inexistente", "go"), /gate desconhecido/);
});
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `guide-data.js`.

- [ ] **Step 3: Implement the pure data model**

Create `guide-data.js` with these exact public shapes:

```js
export const STAGES = [
  { id: "idea", code: "IDEIA", title: "Comece pelo problema", output: "Brief estruturado", gate: null },
  { id: "p0", code: "L0/P0", title: "Prove que alguém paga", output: "Scorecard + Mercado", gate: "p0-go" },
  { id: "foundation", code: "FOUNDATION", title: "Feche a arquitetura", output: "system-design.md", gate: null },
  { id: "ds-gen", code: "DS-GEN", title: "Explore a direção visual", output: "3 propostas", gate: "b3-visual" },
  { id: "p1", code: "L0/P1", title: "Prepare aquisição e CTA", output: "15 hooks + CTA", gate: null },
  { id: "build", code: "L1/B1…B5", title: "Construa e verifique", output: "App + build/typecheck", gate: null },
  { id: "ship", code: "P3", title: "Publique com autorização", output: "URL + smoke", gate: "deploy" },
  { id: "measure", code: "P4", title: "Meça comportamento real", output: "Resultado P4", gate: null },
  { id: "decide", code: "P5", title: "Mate ou escale", output: "Decisão registrada", gate: null },
];

export const TEAMS = [
  { id: "dry-run", title: "Dry-run", quota: "zero", use: "aprender e validar a fábrica" },
  { id: "grok-solo", title: "Solo", quota: "baixa", use: "jobs diretos e rápidos" },
  { id: "grok-glm-front", title: "Produto + visual", quota: "média", use: "build com especialista de UI" },
  { id: "quality", title: "Quality", quota: "alta", use: "revisão adversarial e entrega crítica" },
];

export const COMMANDS = [
  { command: "npm run forge -- profile init", category: "start", intent: "Criar o perfil da fábrica", keywords: "configuração nicho stack idiomas" },
  { command: "npm run forge -- team", category: "start", intent: "Montar um time", keywords: "players modelos effort funções" },
  { command: "npm run forge -- new \"minha ideia\" --team dry-run --dry-run", category: "start", intent: "Rodar sem gastar quota", keywords: "pipeline teste seguro" },
  { command: "npm run forge -- onboard campanha --blueprint gameads", category: "start", intent: "Criar brief por blueprint", keywords: "intake discovery" },
  { command: "npm run forge -- attach meu-app", category: "observe", intent: "Acompanhar na TUI", keywords: "tempo real logs" },
  { command: "npm run forge -- status", category: "observe", intent: "Ver todas as pipelines", keywords: "snapshot estado" },
  { command: "npm run forge -- stats", category: "observe", intent: "Ler métricas e falhas reais", keywords: "PASS duração mortes" },
  { command: "npm run forge -- roster", category: "observe", intent: "Listar players e times", keywords: "provedores equipes" },
  { command: "npm run forge -- decide p0-go go --app meu-app", category: "decide", intent: "Responder a um gate", keywords: "go kill retry feedback" },
  { command: "npm run forge -- target meu-app cf-pages", category: "decide", intent: "Trocar o alvo de deploy", keywords: "vercel workers gh-pages" },
  { command: "npm run forge -- feedback meu-app \"melhore o onboarding\"", category: "iterate", intent: "Iterar um app publicado", keywords: "redeploy melhoria" },
  { command: "npm run forge -- stop meu-app", category: "recover", intent: "Pausar o job atual", keywords: "parar executor" },
  { command: "npm run forge -- resume meu-app", category: "recover", intent: "Retomar a pipeline", keywords: "continuar restart" },
  { command: "npm run forge -- restart", category: "recover", intent: "Recarregar o Maestro com segurança", keywords: "server código" },
  { command: "npm run forge -- kill meu-app", category: "recover", intent: "Encerrar um run sem saída", keywords: "matar bloquear" },
  { command: "npm run forge -- remove meu-app --force", category: "danger", intent: "Apagar app e estado", keywords: "destrutivo irreversível produção" },
];

export const GATES = {
  "p0-go": { go: { effect: "A ideia avança para fundação e conteúdo.", command: "npm run forge -- decide p0-go go --app meu-app" }, kill: { effect: "A ideia é encerrada antes de consumir build.", command: "npm run forge -- decide p0-go kill --app meu-app" } },
  "b3-visual": { go: { effect: "A direção visual aprovada segue para build.", command: "npm run forge -- decide b3-visual go --app meu-app" }, retry: { effect: "O executor recebe feedback e refaz a proposta.", command: "npm run forge -- decide b3-visual retry \"feedback visual\" --app meu-app" } },
  deploy: { go: { effect: "O target configurado recebe o build após as verificações.", command: "npm run forge -- decide deploy go --app meu-app" }, kill: { effect: "O app não publica; artefatos locais permanecem para revisão.", command: "npm run forge -- decide deploy kill --app meu-app" } },
};

export function filterCommands(query = "", category = "all") {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return COMMANDS.filter((item) => (category === "all" || item.category === category) && `${item.command} ${item.intent} ${item.keywords}`.toLocaleLowerCase("pt-BR").includes(needle));
}

export function resolveGate(gateId, decision) {
  const gate = GATES[gateId];
  if (!gate) throw new Error(`gate desconhecido: ${gateId}`);
  const outcome = gate[decision];
  if (!outcome) throw new Error(`decisão ${decision} não existe em ${gateId}`);
  return outcome;
}
```

- [ ] **Step 4: Run the model test and verify GREEN**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: 3 tests, 3 pass, 0 fail.

---

### Task 2: Página semântica e sistema visual responsivo

**Files:**
- Modify: `maestro/test/onboarding-guide.test.mjs`
- Create: `docs/forge-onboarding/index.html`
- Create: `docs/forge-onboarding/guide.css`
- Create: `docs/forge-onboarding/_headers`

**Interfaces:**
- Consumes: exports de `guide-data.js` por `guide.js`.
- Produces: elementos `#journey`, `#quickstart`, `#gate-lab`, `#teams`, `#command-atlas`, `#operator`, `#recovery`, `#ship-checklist`, `#command-results` e `#gate-output`.

- [ ] **Step 1: Extend the test with the page contract**

Append tests that read the static files and assert:

```js
test("página contém percurso completo, landmarks e regiões interativas acessíveis", () => {
  const html = fs.readFileSync(path.join(guideDir, "index.html"), "utf8");
  assert.match(html, /<html lang="pt-BR">/);
  for (const id of ["journey", "quickstart", "gate-lab", "teams", "command-atlas", "operator", "recovery", "ship-checklist"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="command-results"[^>]*aria-live="polite"/);
  assert.match(html, /id="gate-output"[^>]*aria-live="polite"/);
  assert.match(html, /remove meu-app --force/);
  assert.match(html, /destrutiv|irreversível/i);
});

test("CSS cobre tokens, foco, motion reduzido e quatro larguras", () => {
  const css = fs.readFileSync(path.join(guideDir, "guide.css"), "utf8");
  for (const token of ["--ink", "--paper", "--accent", "--verified", "--warning", "--danger"]) assert.match(css, new RegExp(token));
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  for (const width of [375, 768, 1024, 1440]) assert.match(css, new RegExp(`${width}px`));
});

test("headers publicados bloqueiam sniffing e framing", () => {
  const headers = fs.readFileSync(path.join(guideDir, "_headers"), "utf8");
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: the three new tests fail because `index.html`, `guide.css` and `_headers` do not exist.

- [ ] **Step 3: Build the semantic HTML**

Create `index.html` with one `<h1>`, sticky `<nav aria-label="Seções do tutorial">`, the eight required section IDs, real command examples, visible destructive warning, `<template>` elements for stage/team/command rendering, and:

```html
<div class="command-tools" role="search">
  <label for="command-search">O que você quer fazer?</label>
  <input id="command-search" type="search" placeholder="Ex.: métricas, pausar, deploy" autocomplete="off">
  <div id="command-filters" aria-label="Filtrar comandos por intenção"></div>
</div>
<div id="command-results" aria-live="polite"></div>

<fieldset class="gate-controls">
  <legend>Simule uma decisão humana</legend>
  <label for="gate-select">Gate</label>
  <select id="gate-select"><option value="p0-go">p0-go</option><option value="b3-visual">b3-visual</option><option value="deploy">deploy</option></select>
  <div id="gate-decisions"></div>
</fieldset>
<output id="gate-output" aria-live="polite">Escolha um gate e uma decisão para ver o efeito.</output>
```

Load `<script type="module" src="./guide.js"></script>` at the end of body. Every section must include the exact operator guidance from the design spec, not filler copy.

- [ ] **Step 4: Implement the CSS system**

Create `guide.css` around these tokens and behaviors:

```css
:root {
  --ink: #f4efe6; --ink-muted: #b9b1a6; --paper: #11110f; --panel: #1b1a17;
  --line: #34312c; --accent: #c46cff; --verified: #56d89b; --warning: #f0bd57; --danger: #ff6b6b;
  --mono: "IBM Plex Mono", Consolas, monospace; --sans: Inter, system-ui, sans-serif;
  --step: clamp(3.5rem, 8vw, 8rem); --content: 1180px;
}
* { box-sizing: border-box; }
html { color-scheme: dark; scroll-behavior: smooth; }
body { margin: 0; color: var(--ink); background: var(--paper); font-family: var(--sans); line-height: 1.6; }
:focus-visible { outline: 3px solid var(--warning); outline-offset: 4px; }
code, pre, .command { font-family: var(--mono); }
.shell { width: min(calc(100% - 2rem), var(--content)); margin-inline: auto; }
.danger-zone { border-inline-start: 4px solid var(--danger); background: color-mix(in srgb, var(--danger) 10%, var(--panel)); }
@media (max-width: 375px) { .shell { width: min(calc(100% - 1rem), var(--content)); } }
@media (min-width: 768px) { .journey-list { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .page-grid { grid-template-columns: 15rem minmax(0, 1fr); } }
@media (min-width: 1440px) { :root { --content: 1280px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
```

Complete the stylesheet with editorial stage layout, terminal blocks, responsive navigation, filter chips, gate lab, recovery tree, checklist, copy feedback and overflow-safe tables.

- [ ] **Step 5: Add Cloudflare headers**

Create `_headers`:

```text
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'

/guide.css
  Cache-Control: public, max-age=3600

/guide-data.js
  Cache-Control: public, max-age=3600

/guide.js
  Cache-Control: public, max-age=3600
```

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: 6 tests, 6 pass, 0 fail.

---

### Task 3: Interações do navegador e fallback de clipboard

**Files:**
- Modify: `maestro/test/onboarding-guide.test.mjs`
- Create: `docs/forge-onboarding/guide.js`

**Interfaces:**
- Consumes: `STAGES`, `TEAMS`, `COMMANDS`, `GATES`, `filterCommands`, `resolveGate`.
- Produces: renderização inicial, busca/filtro, simulação de gates, copiar comando, scroll spy e progresso do checklist.

- [ ] **Step 1: Add a static interaction contract test**

```js
test("bindings conectam busca, gates, clipboard e navegação", () => {
  const js = fs.readFileSync(path.join(guideDir, "guide.js"), "utf8");
  for (const name of ["renderJourney", "renderTeams", "renderCommands", "renderGateDecisions", "copyCommand", "setupScrollSpy", "setupChecklist"]) assert.match(js, new RegExp(`function ${name}`));
  assert.match(js, /navigator\.clipboard\.writeText/);
  assert.match(js, /document\.execCommand\("copy"\)/);
  assert.match(js, /filterCommands\(/);
  assert.match(js, /resolveGate\(/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: FAIL because `guide.js` does not exist.

- [ ] **Step 3: Implement browser bindings**

Create `guide.js` importing the model and defining the seven named functions. Use event delegation for command copy buttons and gate decisions. Clipboard behavior must be:

```js
async function copyCommand(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  button.dataset.copied = "true";
  button.textContent = "Copiado";
  window.setTimeout(() => { button.dataset.copied = "false"; button.textContent = "Copiar"; }, 1600);
}
```

`renderCommands()` must use `textContent`, never interpolate command strings into `innerHTML`. `setupScrollSpy()` uses `IntersectionObserver`; `setupChecklist()` stores only checked item IDs in `localStorage` under `forge-onboarding-checklist-v1`.

- [ ] **Step 4: Run targeted and full tests**

Run: `node --test maestro/test/onboarding-guide.test.mjs`
Expected: 7 tests, 7 pass, 0 fail.

Run: `npm test`
Expected: all existing 99 tests plus 7 onboarding tests pass, 0 fail.

---

### Task 4: HTTP smoke and visual QA

**Files:**
- Modify only if QA finds a defect: files under `docs/forge-onboarding/`.

**Interfaces:**
- Consumes: complete static site.
- Produces: verified local URL and screenshots at required widths.

- [ ] **Step 1: Start a local static server**

Run from the repository root and keep the returned process object in `$tutorialServer`:

```powershell
$tutorialServer = Start-Process -FilePath python -ArgumentList @('-m', 'http.server', '4173', '--bind', '127.0.0.1', '--directory', 'docs/forge-onboarding') -WindowStyle Hidden -PassThru
```

Expected: hidden Node process listening on `127.0.0.1:4173`.

- [ ] **Step 2: Run HTTP smoke**

Run: `Invoke-WebRequest http://127.0.0.1:4173/ -UseBasicParsing`
Expected: status 200, title `Forge — Guia de Operação`, body contains `Primeiros 15 minutos` and `Mapa de comandos`.

- [ ] **Step 3: Verify responsive screenshots and interactions**

Using the available browser tooling, inspect 375, 768, 1024 and 1440 px. Verify no horizontal page overflow, sticky navigation does not cover headings, every copy button reports `Copiado`, search for `métricas` returns `forge stats`, gate `deploy + kill` says the app is not published, and checklist survives reload.

- [ ] **Step 4: Stop only the server created in Step 1**

Run: `Stop-Process -Id $tutorialServer.Id`. Do not stop the Maestro on port 8799.

---

### Task 5: Close workbench, commit, push, deploy and notify

**Files:**
- Modify: `workbench/HANDOFF.md`
- Modify: `workbench/QUEUE.md`
- Modify: `workbench/CLAIMS.md`

**Interfaces:**
- Consumes: verified site and deploy URL.
- Produces: clean claim, one implementation commit, pushed branch, public Pages URL and WhatsApp delivery confirmation.

- [ ] **Step 1: Run final verification before closing**

Run: `npm test`
Expected: all tests pass, 0 fail.

Run: `git diff --check`
Expected: exit 0.

Run: `git status --short`
Expected: only tutorial/workbench changes plus preserved preexisting `package-lock.json`, `.claude/`, `.codebase-memory/`.

- [ ] **Step 2: Update workbench**

Move the tutorial item from Doing to Done, release the claim, and add to the top of `HANDOFF.md`: files, test count, deploy project, public URL, smoke result, commit and explicit note that existing apps were untouched.

- [ ] **Step 3: Commit implementation and closing**

Stage only:

```text
docs/forge-onboarding/
maestro/test/onboarding-guide.test.mjs
docs/superpowers/plans/2026-07-13-forge-onboarding.md
workbench/HANDOFF.md
workbench/QUEUE.md
workbench/CLAIMS.md
```

Commit: `feat(docs): publicar onboarding visual do Forge`.

- [ ] **Step 4: Push the authorized branch**

Run: `git push -u origin feat/gpt56-optimization`
Expected: remote branch advances to the implementation commit. Do not merge or push directly to `master`.

- [ ] **Step 5: Deploy isolated Cloudflare Pages project**

Run:

```powershell
npx.cmd --yes wrangler@4.108.0 pages deploy docs/forge-onboarding --project-name forge-onboarding --branch main
```

Expected: output includes a new HTTPS URL whose hostname ends in `.forge-onboarding.pages.dev`. If project creation is required, create only this Pages project; do not alter existing app projects.

- [ ] **Step 6: Smoke the public URL**

Run `Invoke-WebRequest` against the exact deployment URL and the stable `https://forge-onboarding.pages.dev`. Both must return 200 and contain the Forge guide title. If the stable alias is not ready, the immutable deployment URL is acceptable and must be used in the handoff.

- [ ] **Step 7: Send WhatsApp autoaviso**

Use the default destination `5545998296112` and the approved helper with `-Send`. Assign the verified values and send this exact message:

```powershell
$publicUrl = 'the exact URL that passed the public smoke'
$implementationCommit = git rev-parse --short HEAD
$message = @"
Forge onboarding publicado!

Tutorial visual: $publicUrl

Cobre primeiros 15 minutos, pipeline completa, times, gates, mapa de comandos, recovery, métricas e deploy.
Branch: feat/gpt56-optimization
Commit: $implementationCommit
Smoke público: HTTP 200.
"@
powershell -ExecutionPolicy Bypass -File "C:/Users/guibr/.agents/skills/enviarwpp/scripts/open_whatsapp_send.ps1" -Phone "5545998296112" -Message $message -Send
```

Expected: Evolution API confirms successful send to the default number.
