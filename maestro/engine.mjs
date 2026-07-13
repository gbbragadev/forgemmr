/**
 * Forge engine — state machine da pipeline "ideia → app no ar".
 *
 *   P0 → GATE(p0-go) → P1 → B1 → B2 → B3 → GATE(b3-visual) → [B4] → B5 → GATE(deploy) → P3 → done
 *
 * - Dispatch por team preset (roster.json v2), fallback + cooldown de rate-limit (L2 automático)
 * - Verify objetivo entre jobs (artefato / build exit 0), retry ≤3 com tail do erro
 * - Git: branch pipeline/<appId>, checkpoint commit por job PASS, rollback no esgotamento
 * - Estado durável em maestro/pipeline.json (sobrevive a restart; histórico em maestro/runs/)
 * - Gates humanos pausam a pipeline; decisão via POST /api/pipeline/decide (CLI forge)
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync, execSync } from "node:child_process";
import { buildSpawn, createStreamSanitizer, detectRateLimit, makeRedactor } from "./adapters.mjs";
import * as workbench from "./workbench.mjs";
import { loadBlueprint, interpolate } from "./blueprint-loader.mjs";
import { improvePrompt } from "./improver.mjs";
import { recordDecision, writeApproval } from "./decisions.mjs";

// porta do Maestro HQ (server.mjs) — usada nos prompts de gate visual (preview)
const HQ_PORT = Number(process.env.MAESTRO_PORT || 8799);

const JOB_TEMPLATES = {
  "L0/P0": "L0-P0-scorecard.md",
  FOUNDATION: "FOUNDATION.md",
  "DS-GEN": "DS-GEN.md",
  "L0/P1": "L0-P1-content-hooks.md",
  "L1/B1": "L1-B1-scaffold.md",
  "L1/B2": "L1-B2-personas.md",
  "L1/B3": "L1-B3-ui-polish.md",
  "L1/B4": "L1-B4-wire-api.md",
  "L1/B5": "L1-B5-ship-check.md",
  ITERATE: "FEEDBACK-ITERATE.md",
};

// rótulos curtos por job (fonte única — TUI importa; index.html espelha em literal)
export const JOB_SHORT = { "L0/P0": "P0", FOUNDATION: "Fundação", "DS-GEN": "Design", "L0/P1": "P1", "L1/B1": "B1", "L1/B2": "B2", "L1/B3": "B3", "L1/B4": "B4", "L1/B5": "B5", P3: "ship", ITERATE: "iterar" };

/**
 * Extrai o tipo de app declarado pelo P0 no scorecard (linha "Tipo: static|quiz|chat",
 * tolerante a markdown: bold/heading/bullet). null = scorecard não declarou.
 */
export function parseCapabilityFromScorecard(txt) {
  const m = String(txt).match(/^[\s>*#-]*(?:tipo|capability)\**\s*:\s*\**\s*(static|quiz|chat)\b/im);
  return m ? m[1].toLowerCase() : null;
}

export const JOBS_BY_CAPABILITY = {
  static: ["L0/P0", "FOUNDATION", "DS-GEN", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B5", "P3"],
  quiz: ["L0/P0", "FOUNDATION", "DS-GEN", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B5", "P3"],
  chat: ["L0/P0", "FOUNDATION", "DS-GEN", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B4", "L1/B5", "P3"],
};

// gate criado DEPOIS do job passar; pipeline pausa até forge decide
const GATES_AFTER = {
  "L0/P0": (p) => ({
    id: "p0-go",
    prompt: `Scorecard pronto (${runDocRel(p.appId, "scorecard")}).${
      p.capabilityAuto ? ` Tipo proposto: ${p.detectedCapability || "static"} — GO aplica (retry com feedback corrige).` : ""
    } GO, retry ou KILL?`,
    payload: runDocRel(p.appId, "scorecard"),
    choices: ["go", "retry", "kill"],
  }),
  FOUNDATION: (p) => ({
    id: "foundation-review",
    prompt: `System design pronto (${runDocRel(p.appId, "system-design")}) — é o contrato de arquitetura que os builds vão seguir. Aprova, refaz ou mata?`,
    payload: runDocRel(p.appId, "system-design"),
    choices: ["go", "retry", "kill"],
  }),
  "DS-GEN": (p) => ({
    id: "ds-pick",
    prompt: `3 propostas de design system em http://127.0.0.1:${HQ_PORT}/proposals/${p.appId}/proposal-1.html (…-2, …-3). Escolha 1/2/3 (a UI segue a escolhida), refaz ou mata.`,
    payload: `proposals:${p.appId}`,
    choices: ["1", "2", "3", "retry", "kill"],
  }),
  "L1/B3": (p) => ({
    id: "b3-visual",
    prompt: `UI polida. Preview: http://127.0.0.1:${HQ_PORT}/preview/${p.appId}/ (ou npm run dev). Aprova o visual?`,
    payload: `preview:${p.appId}`,
    choices: ["go", "retry", "kill"],
  }),
  "L1/B5": (p) => ({
    id: "deploy",
    prompt: `Ship check OK. Autorizar push/merge + deploy ${p.deploy.target} → https://${p.deploy.subdomain}.${p.deploy.baseUrl || "example.com"} ?`,
    payload: `deploy:${p.deploy.target}:${p.deploy.subdomain}`,
    choices: ["go", "kill"],
  }),
  ITERATE: (p) => ({
    id: "iterate-visual",
    prompt: `Feedback aplicado. Preview: http://127.0.0.1:${HQ_PORT}/preview/${p.appId}/ (ou npm run dev). Aprova a iteração?`,
    payload: `preview:${p.appId}`,
    choices: ["go", "retry", "kill"],
  }),
};

/**
 * Converte uma string em slug: minúsculo, remove diacríticos, espaços → hífens, máx 3 partes.
 * @example slugify("Acme Lançamento 2024") → "acme-lancamento-2024"
 */
/** Docs gerados pelo run vivem no REPO DO APP (repo-por-app): apps/<appId>/docs/<kind>.md */
export function runDocRel(appId, kind) {
  return `apps/${appId}/docs/${kind}.md`;
}

/** Deriva o appId de um payload de start (fonte única — usada pela engine e pelo manager). */
export function deriveAppId(params) {
  return slugify(params.appId || params.slug || String(params.idea || ""));
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 3)
    .join("-");
}

/**
 * Resolve a lista de jobs + jobSpecs para uma pipeline. generic = defaults
 * internos (jobSpecs null → engine usa JOB_TEMPLATES/GATES_AFTER/switch).
 * Externo = jobs/jobSpecs do blueprint, com verify.path/gate interpolados p/ o appId.
 */
export function resolvePlan({ root, blueprint, capability, appId }) {
  const bp = loadBlueprint(blueprint, { root });
  if (!bp.external) {
    if (!JOBS_BY_CAPABILITY[capability]) throw new Error(`capability "${capability}" inválida (static|quiz|chat)`);
    return { blueprint: "generic", jobs: JOBS_BY_CAPABILITY[capability], jobSpecs: null };
  }
  // interpola paths dependentes do appId/slug uma vez, na resolução
  const ctx = { appId, slug: appId, port: HQ_PORT };
  const jobSpecs = {};
  for (const [job, spec] of Object.entries(bp.jobSpecs)) {
    jobSpecs[job] = {
      ...spec,
      inputs: (spec.inputs || []).map((i) => interpolate(i, ctx)),
      verify: { ...spec.verify, path: interpolate(spec.verify.path, ctx) },
      gate: spec.gate
        ? {
            ...spec.gate,
            prompt: interpolate(spec.gate.prompt, ctx),
            payload: interpolate(spec.gate.payload, ctx),
          }
        : null,
    };
  }
  return { blueprint: bp.name, jobs: bp.jobs.slice(), jobSpecs };
}

// limites do run: defaults em PROFILE_DEFAULTS.limits — override por profile (bloco forge-config "limits")

// ---------- ProjectProfile (o "vertical" configurável — .forge/profile.md) ----------
const PROFILE_DEFAULTS = {
  name: "Forge",
  namespace: "@forge",
  niche: "generic",
  ai: { provider: "zai", model: "", envKey: "ZAI_API_KEY" },
  i18n: { defaultLocale: "pt-BR", locales: ["pt-BR"], rule: "single" },
  ui: { theme: "", designSystem: "", tokenPrefix: "--af-" },
  deploy: { baseUrl: "example.com", staticHost: "cf-pages", serverHost: "vercel", ghPagesUrl: "https://gbbragadev.github.io/anime-forge" },
  git: { targetBranch: "master", commitPrefix: "forge" },
  legal: { ipRules: [] },
  capabilities: ["static", "quiz", "chat"],
  // todo prompt de job passa por um improver antes do executor (escolhe skills/subagentes também)
  promptImprover: {
    enabled: true,
    cli: "codex",
    model: "gpt-5.6-terra",
    effort: "high",
    maxTurns: 12,
    timeoutMs: 8 * 60 * 1000, // -p headless só imprime no fim: timeout curto matava o improver trabalhando
    // se o primário falhar (rate-limit/limite da conta/erro), tenta este antes de usar o prompt original
    fallback: { cli: "claude", model: "haiku", effort: "max", maxTurns: 12, timeoutMs: 8 * 60 * 1000 },
  },
  limits: {
    maxAttemptsPerPlayer: 3,
    cooldownMs: 60 * 60 * 1000,
    jobTimeoutMs: { "L0/P0": 15 * 60 * 1000, "L0/P1": 15 * 60 * 1000, default: 30 * 60 * 1000 },
    jobMaxTurns: { "L0/P0": 25, "L0/P1": 25, "L1/B1": 50, "L1/B3": 50, "L1/B4": 40, default: 30 },
    deployRetryDelaysMs: [30000, 60000, 120000, 300000],
    deployBuildTimeoutMs: 10 * 60 * 1000,
  },
};

/** Lê .forge/profile.md: bloco ```forge-config``` (JSON, knobs) + corpo markdown (narrativo). */
export function loadProfile(root) {
  const p = path.join(root, ".forge", "profile.md");
  let knobs = {};
  let narrative = "";
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, "utf8");
    // fence ancorado em início de linha + newline (ignora menções inline na doc)
    const fence = /^```forge-config[ \t]*\r?\n([\s\S]*?)\r?\n```/m;
    const m = raw.match(fence);
    if (m) {
      try {
        knobs = JSON.parse(m[1]);
      } catch (e) {
        throw new Error(".forge/profile.md: bloco forge-config não é JSON válido — " + e.message);
      }
    }
    narrative = raw
      .replace(fence, "")
      .replace(/^>.*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const d = PROFILE_DEFAULTS;
  const prof = {
    ...d,
    ...knobs,
    ai: { ...d.ai, ...(knobs.ai || {}) },
    i18n: { ...d.i18n, ...(knobs.i18n || {}) },
    ui: { ...d.ui, ...(knobs.ui || {}) },
    deploy: { ...d.deploy, ...(knobs.deploy || {}) },
    git: { ...d.git, ...(knobs.git || {}) },
    legal: { ...d.legal, ...(knobs.legal || {}) },
    promptImprover: { ...d.promptImprover, ...(knobs.promptImprover || {}) },
    limits: {
      ...d.limits,
      ...(knobs.limits || {}),
      jobTimeoutMs: { ...d.limits.jobTimeoutMs, ...(knobs.limits?.jobTimeoutMs || {}) },
      jobMaxTurns: { ...d.limits.jobMaxTurns, ...(knobs.limits?.jobMaxTurns || {}) },
    },
  };
  prof.narrative = narrative;
  return prof;
}

/**
 * Autora o conteúdo de .forge/profile.md a partir dos inputs do wizard (forge profile init).
 * Pura/testável: o resultado passa de volta por loadProfile() e os knobs batem (round-trip).
 */
export function buildProfileMd(data) {
  const {
    name = "Meu Projeto",
    namespace = "@forge",
    niche = "generic",
    baseUrl = "example.com",
    i18nRule = "single",
    locales = i18nRule === "bilingual" ? ["pt-BR", "en"] : ["pt-BR"],
    context = "",
    capabilities = ["static", "quiz", "chat"],
  } = data || {};
  // sanitiza knobs de 1 linha (o wizard já filtra, mas buildProfileMd é exportada — defesa p/ chamada
  // programática): sem \n nem ` que quebrariam o H1 ou o fence forge-config.
  const oneline = (v) => String(v).replace(/[\r\n`]+/g, " ").trim();
  const knobs = {
    name: oneline(name),
    namespace: oneline(namespace),
    niche: oneline(niche),
    i18n: { defaultLocale: "pt-BR", locales, rule: i18nRule },
    deploy: { baseUrl: oneline(baseUrl), staticHost: "cf-pages", serverHost: "vercel" },
    git: { targetBranch: "master", commitPrefix: "forge" },
    capabilities,
  };
  return [
    `# ${knobs.name} — ProjectProfile`,
    "> setado por `forge profile init` · edite à vontade; o bloco forge-config abaixo é lido pela engine.",
    "",
    "```forge-config",
    JSON.stringify(knobs, null, 2),
    "```",
    "",
    "## Contexto & temas",
    (context || "").trim() || "(descreva o projeto: temas principais, público, tom de voz)",
    "",
    "## Stack & decisões de arquitetura",
    "A fase FOUNDATION propõe arquitetura, stack e design patterns a partir da ideia + deste contexto.",
    "Fixe aqui decisões que quer impor a TODOS os apps (ex.: \"Next.js static export\", \"sem backend na v0\").",
    "",
    "## Guardrails & regras",
    "Regras que todo job deve seguir (acessibilidade, tom, regras de IP/marca). Viram fonte da verdade nos prompts.",
    "",
  ].join("\n");
}

// ---------- biblioteca de profiles (profiles/<slug>/profile.md; ativo = cópia em .forge/) ----------

/** Extrai name/niche do fence forge-config de um profile.md (sem aplicar defaults). */
function readProfileMeta(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const m = raw.match(/^```forge-config[ \t]*\r?\n([\s\S]*?)\r?\n```/m);
    const knobs = m ? JSON.parse(m[1]) : {};
    return { name: knobs.name || "(sem nome)", niche: knobs.niche || "generic" };
  } catch {
    return { name: "(profile inválido)", niche: "?" };
  }
}

/** Lista a biblioteca profiles/<slug>/profile.md; marca o ativo via .forge/active.txt. */
export function listProfiles(root) {
  const dir = path.join(root, "profiles");
  if (!fs.existsSync(dir)) return [];
  let active = "";
  try {
    active = fs.readFileSync(path.join(root, ".forge", "active.txt"), "utf8").trim();
  } catch {}
  const out = [];
  for (const slug of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, slug, "profile.md");
    if (!fs.existsSync(file)) continue;
    out.push({ slug, ...readProfileMeta(file), active: slug === active });
  }
  return out;
}

/** Ativa um profile da biblioteca: copia para .forge/profile.md + grava .forge/active.txt. */
export function activateProfile(root, slug) {
  const src = path.join(root, "profiles", slug, "profile.md");
  if (!fs.existsSync(src)) throw new Error(`profile "${slug}" não existe em profiles/ — forge profile init para criar`);
  const forgeDir = path.join(root, ".forge");
  fs.mkdirSync(forgeDir, { recursive: true });
  fs.copyFileSync(src, path.join(forgeDir, "profile.md"));
  fs.writeFileSync(path.join(forgeDir, "active.txt"), slug, "utf8");
  return slug;
}

/**
 * Seed/migração: se .forge/profile.md existe sem correspondente em profiles/ (por slugify(name)),
 * importa para a biblioteca. Sempre garante active.txt apontando pro slug. Devolve o slug ou null.
 */
export function importActiveProfile(root) {
  const activeFile = path.join(root, ".forge", "profile.md");
  if (!fs.existsSync(activeFile)) return null;
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const activeRaw = norm(fs.readFileSync(activeFile, "utf8"));
  // dedup por conteúdo: cópia ativa idêntica a um profile da biblioteca (slug manual) → só aponta
  const dir = path.join(root, "profiles");
  if (fs.existsSync(dir)) {
    for (const s of fs.readdirSync(dir).sort()) {
      const f = path.join(dir, s, "profile.md");
      if (fs.existsSync(f) && norm(fs.readFileSync(f, "utf8")) === activeRaw) {
        fs.writeFileSync(path.join(root, ".forge", "active.txt"), s, "utf8");
        return s;
      }
    }
  }
  const slug = slugify(readProfileMeta(activeFile).name) || "default";
  const libFile = path.join(root, "profiles", slug, "profile.md");
  if (!fs.existsSync(libFile)) {
    fs.mkdirSync(path.dirname(libFile), { recursive: true });
    fs.copyFileSync(activeFile, libFile);
  }
  fs.writeFileSync(path.join(root, ".forge", "active.txt"), slug, "utf8");
  return slug;
}

// Papéis do team builder → jobs que cada papel cobre no dispatch da pipeline.
export const TEAM_ROLES = [
  { id: "Estrategista", jobs: ["L0/P0", "FOUNDATION", "L0/P1", "L1/B2"], desc: "scorecard · fundação · hooks · personas" },
  { id: "Engenheiro", jobs: ["L1/B1", "L1/B4"], desc: "scaffold · API/wire" },
  { id: "Designer", jobs: ["L1/B3", "ITERATE", "DS-GEN"], desc: "UI polish · iteração · design system" },
  { id: "QA", jobs: ["L1/B5"], desc: "ship check" },
  // Papel Revisor não possui jobs de dispatch próprios — atua como OVERLAY via team.review:
  // a engine (maybeReview no advanceLoop) roda uma passada de revisão adversarial após B1/B4.
  { id: "Revisor", jobs: [], desc: "revisão adversarial pós-B1/B4 (conserta bug real; reverte se quebrar o build)" },
];

function teamSlug(s) {
  return (
    String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "time"
  );
}

/**
 * Compõe um team + players a partir de "músicos" (provider+model+effort+papéis).
 * Pura/testável: retorna a estrutura que a engine já consome (dispatch[job]→playerId + default + review).
 * @param {string} name
 * @param {Array<{provider,cli,env?,model,modelLabel,effort,roles:string[],face?,color?,name?}>} musicians
 */
export function composeTeam(name, musicians, emoji = "🎼") {
  const teamId = teamSlug(name);
  const roleJobs = Object.fromEntries(TEAM_ROLES.map((r) => [r.id, r.jobs]));
  const players = [];
  const dispatch = {};
  const fallbacks = {};
  let defaultId = null;
  let reviewPlayer = null;
  musicians.forEach((mu, i) => {
    const id = `${teamId}-${mu.provider}${i + 1}`;
    players.push({
      id,
      face: mu.face || "·",
      name: mu.name || mu.modelLabel || id,
      cli: mu.cli,
      ...(mu.env ? { env: mu.env } : {}),
      model: mu.model,
      modelLabel: mu.modelLabel,
      effort: mu.effort,
      roles: mu.roles,
      color: mu.color || "#8b8b9e",
      blurb: `${mu.modelLabel} · ${mu.roles.join("/")}`,
      generated: true,
    });
    for (const role of mu.roles) {
      for (const job of roleJobs[role] || []) {
        const prev = dispatch[job];
        // 2 músicos no mesmo job: o deslocado vira fallback (reachable no rate-limit, não some)
        if (prev && prev !== id) (fallbacks[id] = fallbacks[id] || []).push(prev);
        dispatch[job] = id;
      }
      if (role === "Engenheiro" && !defaultId) defaultId = id;
      if (role === "Revisor") reviewPlayer = id;
    }
  });
  for (const k of Object.keys(fallbacks)) fallbacks[k] = [...new Set(fallbacks[k])];
  if (!defaultId) defaultId = players[0] ? players[0].id : null;
  dispatch.default = defaultId;
  const team = { label: name, emoji, dispatch, fallbacks };
  if (reviewPlayer) team.review = { after: ["L1/B1", "L1/B4"], player: reviewPlayer };
  return { teamId, team, players };
}

export function createEngine({ root, emitLog, emitPipeline, appId: boundAppId }) {
  // com appId (via manager): estado por app em maestro/pipelines/<appId>.json; sem = legado single-file
  const PIPELINE_PATH = boundAppId
    ? path.join(root, "maestro", "pipelines", `${boundAppId}.json`)
    : path.join(root, "maestro", "pipeline.json");
  const RUNS_DIR = path.join(root, "maestro", "runs");
  const paths = { root };
  // reatribuído a cada start()/startFeedback() — trocar .forge/profile.md vale sem reiniciar o server
  let profile = loadProfile(root);

  /** @type {any} */
  let pipeline = null;
  let child = null;
  let looping = false;

  // ---------- util ----------

  const log = (line) => emitLog(line);

  function save() {
    if (!pipeline) return;
    fs.mkdirSync(path.dirname(PIPELINE_PATH), { recursive: true });
    fs.writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2), "utf8");
    emitPipeline(snapshot());
  }

  function snapshot() {
    if (!pipeline) return { status: "idle" };
    const { history, ...rest } = pipeline;
    return { ...rest, history: history.map(({ errorTail, ...h }) => h) };
  }

  function git(args, opts = {}) {
    // trava anti-walk-up: sem .git no cwd, o git subiria a árvore e operaria num repo PAI (ex.: HOME)
    if (!fs.existsSync(path.join(root, ".git"))) throw new Error(`${root} não é um repo git — comando ignorado`);
    return execFileSync("git", args, { cwd: root, encoding: "utf8", ...opts }).trim();
  }

  // ---------- git do APP (repo-por-app: todo git de run roda no repo do app, nunca na fábrica) ----------

  const appDir = (appId) => path.join(root, "apps", appId);

  function gitApp(appId, args, opts = {}) {
    // trava anti-walk-up: app sem .git faria o git operar no repo pai (a fábrica) — só init passa
    if (args[0] !== "init" && !fs.existsSync(path.join(appDir(appId), ".git"))) {
      throw new Error(`apps/${appId} não é um repo git — rode ensureAppRepo antes`);
    }
    return execFileSync("git", args, { cwd: appDir(appId), encoding: "utf8", ...opts }).trim();
  }

  /** Garante repo próprio do app (git init + commit inicial) e working tree limpo. */
  function ensureAppRepo(appId) {
    const dir = appDir(appId);
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    if (!fs.existsSync(path.join(dir, ".git"))) {
      gitApp(appId, ["init", "-b", profile.git.targetBranch]);
      const gi = path.join(dir, ".gitignore");
      if (!fs.existsSync(gi)) fs.writeFileSync(gi, "node_modules/\nout/\n.next/\ndist/\n.turbo/\n", "utf8");
      gitApp(appId, ["add", "-A"]);
      gitApp(appId, ["commit", "--allow-empty", "-m", `${profile.git.commitPrefix}(${appId}): init app repo`]);
      log(`✓ repo do app criado: apps/${appId}/.git`);
    } else {
      const dirty = gitApp(appId, ["status", "--porcelain"]);
      if (dirty) {
        throw new Error(`working tree sujo em apps/${appId} — commit/stash antes de iniciar a pipeline:\n` + dirty);
      }
    }
  }

  function readRoster() {
    return JSON.parse(fs.readFileSync(path.join(root, "maestro", "roster.json"), "utf8"));
  }

  /** team por nome, tolerante a caixa ("CxB" acha "cxb") — devolve a chave real do roster */
  function resolveTeam(roster, wanted) {
    if (roster.teams?.[wanted]) return wanted;
    const lc = String(wanted).toLowerCase();
    return Object.keys(roster.teams || {}).find((k) => k.toLowerCase() === lc) || wanted;
  }

  /** erro do guard por-app: deixa explícito que o limite é DESTE app, não global */
  function activeRunError() {
    const g = (pipeline.gates || []).find((x) => !x.decision);
    return new Error(
      `o app ${pipeline.appId} já tem run ativo (${pipeline.status}${g ? ` · gate ${g.id} pendente` : ""}) — ` +
        `decida ou pare ESTE app (forge decide ${g ? g.id : "<gate>"} <escolha> --app ${pipeline.appId} · forge stop ${pipeline.appId}); ` +
        `outros apps rodam em paralelo normalmente`
    );
  }

  // ---------- dispatch ----------

  function pickPlayer(job, excluded = []) {
    const roster = readRoster();
    const team = roster.teams?.[pipeline.team];
    if (!team) throw new Error(`team "${pipeline.team}" não existe no roster`);
    const primaryId =
      team.dispatch[job] ||
      (job === "ITERATE" ? team.dispatch["L1/B3"] : null) || // feedback é tipicamente visual → player de front
      team.dispatch.default;
    const chain = [primaryId, ...(team.fallbacks?.[primaryId] || [])];
    const now = Date.now();
    for (const id of chain) {
      if (excluded.includes(id)) continue;
      const cd = pipeline.cooldowns[id];
      if (cd && new Date(cd).getTime() > now) continue;
      const player = roster.players.find((p) => p.id === id);
      if (player) return player;
    }
    return null;
  }

  // ---------- prompt ----------

  function buildPrompt(job, player, attempt, extraFeedback) {
    const p = pipeline;
    const spec = p.jobSpecs && p.jobSpecs[job];
    const template = spec ? spec.templateRef : JOB_TEMPLATES[job];
    const lines = [
      `Job: ${job}`,
      `App: ${p.appId}`,
      `Repo: ${root}`,
      `Ideia do app: ${p.idea}`,
      `Capability: ${p.capabilityAuto ? "auto — VOCÊ decide no P0 e declara no scorecard em linha própria (Tipo: static|quiz|chat)" : p.capability}`,
      "",
      `Você é o executor "${player.name}" do job ${job} na pipeline autônoma Forge (Maestro / ${profile.name}).`,
      `Projeto (nicho): ${profile.niche}. Namespace: ${profile.namespace}.`,
      template
        ? `Siga EXATAMENTE o template ${spec ? template : `docs/prompts/${template}`} — preencha os campos <<< >>> com: App id=${p.appId}, Capability=${p.capability}, IDEIA=${p.idea}.`
        : "",
      job === "L1/B3"
        ? `Você é um coding agent com acesso aos arquivos: aplique você mesmo o brief denso de docs/prompts/L1-B3-TEMPLATE.md (não gere prompt para terceiros — VOCÊ é quem implementa a UI).`
        : "",
      "",
      "Regras da pipeline Forge:",
      profile.i18n.rule === "bilingual"
        ? `- Conteúdo user-facing SEMPRE em ${profile.i18n.locales.join(" + ")} (toggle de idioma ou i18n simples; desde o primeiro build).`
        : `- Conteúdo user-facing em ${profile.i18n.defaultLocale}.`,
      ...(profile.legal.ipRules || []).map((r) => `- ${r}`),
      "- Execute UMA iteração deste job apenas; não avance para outros jobs.",
      "- NÃO rode git commit/push — o orquestrador Forge cuida do git.",
      "- Atualize workbench/HANDOFF.md ao final com 2-3 linhas do que fez.",
      `- Critério de sucesso (verificado pelo orquestrador): ${verifyDescription(job)}.`,
      pipelineFooter(),
    ];
    // Contexto do projeto (profile) = fonte da verdade; templates podem citar exemplos de outro nicho.
    if (profile.narrative) {
      lines.push(
        "",
        "---",
        "CONTEXTO DO PROJETO (fonte da verdade — os templates docs/prompts/ podem usar exemplos de outro nicho; ADAPTE ao contexto abaixo):",
        profile.narrative
      );
    }
    // Ground-truth da FOUNDATION: todo job DEPOIS dela (P1 + builds) segue o design aprovado.
    const sysDesign = path.join(root, runDocRel(p.appId, "system-design"));
    if (job !== "L0/P0" && job !== "FOUNDATION" && job !== "DS-GEN" && fs.existsSync(sysDesign)) {
      lines.push("", "---", "DESIGN APROVADO (system design da FOUNDATION — siga à risca):", fs.readFileSync(sysDesign, "utf8"));
    }
    // Design system aprovado → todo build de UI segue os tokens. O design-system.md do app é o
    // artefato DURÁVEL (sobrevive a re-run que pula DS-GEN, quando dsChoice não existe); a proposta
    // escolhida (dsChoice) só refina o apontamento quando o HTML dela ainda está em disco.
    const dsMd = path.join(root, runDocRel(p.appId, "design-system"));
    if (job.startsWith("L1/") && fs.existsSync(dsMd)) {
      const prop = p.dsChoice ? path.join(root, "maestro", "proposals", p.appId, `proposal-${p.dsChoice}.html`) : null;
      const pick =
        prop && fs.existsSync(prop)
          ? ` O dono escolheu a PROPOSTA ${p.dsChoice} (maestro/proposals/${p.appId}/proposal-${p.dsChoice}.html) — siga essa direção.`
          : "";
      lines.push(
        "",
        "---",
        `DESIGN SYSTEM APROVADO (use os tokens à risca em TODO o UI — não invente outro visual):${pick}`,
        fs.readFileSync(dsMd, "utf8")
      );
    }
    if (p.mode === "feedback" && job === "ITERATE") {
      lines.push(
        "",
        "FEEDBACK GERAL DO DONO (fonte da verdade desta iteração — aplique com prioridade máxima):",
        `"""${p.feedbackText}"""`
      );
    }
    const prev = p.history.filter((h) => h.pass).slice(-1)[0];
    if (prev) lines.splice(6, 0, `Job anterior concluído: ${prev.job} por ${prev.playerId}.`);
    if (attempt > 1) {
      const lastFail = p.history.filter((h) => h.job === job && !h.pass).slice(-1)[0];
      lines.push(
        "",
        `TENTATIVA ${attempt} — a anterior FALHOU no verify. Corrija a causa raiz. Trecho do erro:`,
        "```",
        (lastFail?.errorTail || "sem detalhe").slice(-3000),
        "```"
      );
    }
    if (extraFeedback) lines.push("", `Feedback do usuário (gate): ${extraFeedback}`);
    // inputs declarados pelo jobSpec (artefatos anteriores desta campanha)
    if (spec && spec.inputs) {
      for (const rel of spec.inputs) {
        const f = path.join(root, rel);
        if (fs.existsSync(f)) {
          lines.push("", "---", `CONTEXTO (${rel} — fonte da verdade, siga à risca):`, fs.readFileSync(f, "utf8"));
        }
      }
    }
    return lines.filter((l) => l !== "").join("\n");
  }

  function pipelineFooter() {
    const aiKey = profile.ai.envKey || "PRODUCT_AI_KEY";
    return [
      "",
      "---",
      "Maestro HQ constraints:",
      `- Repo: ${root}`,
      "- Surgical / YAGNI. Gate: npm run build if code changes.",
      `- Do not commit secrets. Product AI = ${profile.ai.provider.toUpperCase()} (${aiKey}), not coding brain.`,
      `- Deploy: ${profile.deploy.baseUrl} · git target branch: ${profile.git.targetBranch}.`,
    ].join("\n");
  }

  function verifyDescription(job) {
    if (job === "L0/P0") return `${runDocRel(pipeline.appId, "scorecard")} existe com GO/NO-GO`;
    if (job === "FOUNDATION") return `${runDocRel(pipeline.appId, "system-design")} existe com Arquitetura/Dados/Decisões/Padrões/Riscos`;
    if (job === "DS-GEN") return `3 propostas em maestro/proposals/${pipeline.appId}/proposal-{1,2,3}.html + ${runDocRel(pipeline.appId, "design-system")}`;
    if (job === "L0/P1") return `${runDocRel(pipeline.appId, "content-hooks")} existe`;
    return `npm run build -w ${profile.namespace}/${pipeline.appId} sai com exit 0`;
  }

  // ---------- verify ----------

  function verify(job) {
    const p = pipeline;
    // caminho declarativo (blueprints externos): verify por arquivo + seções
    const spec = p.jobSpecs && p.jobSpecs[job];
    if (spec && spec.verify && spec.verify.type === "file") {
      const f = path.join(root, spec.verify.path);
      if (!fs.existsSync(f)) return { pass: false, detail: `faltou ${spec.verify.path}` };
      if (spec.verify.sections && spec.verify.sections.length) {
        const txt = fs.readFileSync(f, "utf8");
        const missing = spec.verify.sections.filter((s) => !new RegExp(`##\\s*${s}`, "i").test(txt));
        if (missing.length) return { pass: false, detail: `seções faltando: ${missing.join(", ")}` };
      }
      return { pass: true, detail: `${spec.verify.path} ok` };
    }
    if (job === "L0/P0") {
      const f = path.join(root, runDocRel(p.appId, "scorecard"));
      if (!fs.existsSync(f)) return { pass: false, detail: `faltou ${path.relative(root, f)}` };
      const txt = fs.readFileSync(f, "utf8");
      const go = /\bGO\b/.test(txt) && !/\bNO-?GO\b/.test(txt.split("\n").slice(0, 10).join("\n"));
      return { pass: true, detail: go ? "scorecard: GO" : "scorecard: revisar GO/NO-GO no gate" };
    }
    if (job === "L0/P1") {
      const f = path.join(root, runDocRel(p.appId, "content-hooks"));
      return fs.existsSync(f)
        ? { pass: true, detail: "hooks ok" }
        : { pass: false, detail: `faltou ${path.relative(root, f)}` };
    }
    if (job === "FOUNDATION") {
      const f = path.join(root, runDocRel(p.appId, "system-design"));
      if (!fs.existsSync(f)) return { pass: false, detail: `faltou ${path.relative(root, f)}` };
      const txt = fs.readFileSync(f, "utf8");
      const hasSections = /##\s*(Arquitetura|Architecture)/i.test(txt) && /##\s*(Decis|Decision)/i.test(txt);
      return hasSections
        ? { pass: true, detail: "system design com seções ok" }
        : { pass: false, detail: "system design sem as seções esperadas (Arquitetura/Decisões)" };
    }
    if (job === "DS-GEN") {
      const propDir = path.join(root, "maestro", "proposals", p.appId);
      const md = path.join(root, runDocRel(p.appId, "design-system"));
      const missing = [1, 2, 3].filter((n) => !fs.existsSync(path.join(propDir, `proposal-${n}.html`)));
      if (missing.length) return { pass: false, detail: `faltam propostas: ${missing.map((n) => `proposal-${n}.html`).join(", ")}` };
      if (!fs.existsSync(md)) return { pass: false, detail: `faltou ${path.relative(root, md)}` };
      return { pass: true, detail: "3 propostas de DS + design-system.md ok" };
    }
    if (p.dryRun) return { pass: true, detail: "dry-run: verify de build pulado" };
    // appId nasce do slugify(), mas revalida aqui: é interpolado em shell (npm.cmd exige shell no Windows)
    if (!/^[a-z0-9-]+$/.test(p.appId)) return { pass: false, detail: `appId inválido: ${p.appId}` };
    // namespace vem do profile (config) e é interpolado em shell — valida formato @scope
    if (!/^@?[a-z0-9._-]+$/.test(profile.namespace))
      return { pass: false, detail: `namespace inválido no profile: ${profile.namespace}` };
    try {
      execSync(`npm run build -w ${profile.namespace}/${p.appId}`, {
        cwd: root,
        stdio: "pipe",
        timeout: 10 * 60 * 1000,
        encoding: "utf8",
      });
      return { pass: true, detail: "build exit 0" };
    } catch (e) {
      const tail = `${e.stdout || ""}\n${e.stderr || ""}`.slice(-4000);
      return { pass: false, detail: "build falhou", errorTail: tail };
    }
  }

  // ---------- job runner ----------

  function runExecutor(player, prompt, job) {
    return new Promise((resolve) => {
      let spec;
      try {
        spec = buildSpawn(player.env || player.cli, prompt, {
          root,
          maxTurns: profile.limits.jobMaxTurns[job] || profile.limits.jobMaxTurns.default,
          model: player.model !== "default" ? player.model : undefined,
          effort: player.effort,
        });
      } catch (e) {
        resolve({ exitCode: 1, tail: String(e), spawnError: true });
        return;
      }

      // Inject fake-exec env para dry-run com jobSpecs declarativos (gameads etc.)
      if (pipeline.dryRun) {
        const vs = pipeline.jobSpecs && pipeline.jobSpecs[job] && pipeline.jobSpecs[job].verify;
        if (vs && vs.type === "file") {
          spec.env = { ...spec.env, FORGE_FAKE_OUTFILE: vs.path, FORGE_FAKE_SECTIONS: (vs.sections || []).join("|") };
        }
      }

      const runDir = path.join(RUNS_DIR, pipeline.runId);
      fs.mkdirSync(runDir, { recursive: true });
      const rawPath = path.join(runDir, `${job.replace("/", "-")}-${Date.now()}.raw.log`);
      const rawFd = fs.openSync(rawPath, "w");

      fs.writeFileSync(path.join(root, "maestro", ".run-goal.txt"), prompt, "utf8");
      const mlabel = player.modelLabel ? ` · ${player.modelLabel}${player.effort ? " " + String(player.effort).toUpperCase() : ""}` : "";
      log(`▶ ${job} → ${player.name}${mlabel} (${player.cli}${player.env ? "/" + player.env : ""})`);
      log(`  raw → ${path.relative(root, rawPath)}`);

      let tail = "";
      const san = createStreamSanitizer((line) => log(`  ${line}`));

      let proc;
      try {
        // stdin "ignore": codex exec lê stdin quando o pipe fica aberto ("Reading additional input
        // from stdin...") e trava esperando EOF até o timeout — nenhum executor headless usa stdin
        proc = spawn(spec.cmd, spec.args, { cwd: root, env: spec.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        try {
          fs.closeSync(rawFd);
        } catch {}
        resolve({ exitCode: 1, tail: String(e), spawnError: true });
        return;
      }
      child = proc;

      const redact = makeRedactor();
      const onChunk = (buf) => {
        const clean = redact(buf); // nunca gravar segredos em raw log/tail
        try {
          fs.writeSync(rawFd, clean);
        } catch {}
        tail = (tail + clean).slice(-8000);
        san.push(clean);
      };
      proc.stdout?.on("data", onChunk);
      proc.stderr?.on("data", onChunk);
      proc.on("error", (err) => log(`✗ process error: ${err.message}`));

      const timeoutMs = profile.limits.jobTimeoutMs[job] || profile.limits.jobTimeoutMs.default;
      const killProc = (why) => {
        log(`■ ${why} — encerrando executor`);
        try {
          if (process.platform === "win32" && proc.pid)
            spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { shell: true });
          else proc.kill("SIGTERM");
        } catch {}
      };
      // grok -p sai sozinho ao terminar; o hard timeout é o único anti-hang necessário
      const hardTimer = setTimeout(() => killProc(`timeout ${Math.round(timeoutMs / 60000)}min`), timeoutMs);

      const heartbeat = setInterval(() => {
        const sec = Math.round((Date.now() - startAt) / 1000);
        log(`… ${job} rodando (${sec}s)`);
      }, 20 * 1000);
      const startAt = Date.now();

      proc.on("close", (code) => {
        clearTimeout(hardTimer);
        clearInterval(heartbeat);
        san.flush();
        try {
          fs.closeSync(rawFd);
        } catch {}
        child = null;
        resolve({ exitCode: code ?? 1, tail });
      });
    });
  }

  async function runJob(job) {
    const p = pipeline;
    p.currentJob = job;
    save();

    if (job === "P3") return runShip();

    const excluded = [];
    let feedback = p.pendingFeedback || null;
    p.pendingFeedback = null;

    for (;;) {
      const player = pickPlayer(job, excluded);
      if (!player) {
        p.currentPlayer = null;
        return { pass: false, exhausted: true, detail: "todos os players do preset esgotados" };
      }
      p.currentPlayer = player.id;
      save();
      workbench.claimSet(paths, player.id, job.startsWith("L0") ? "L0" : "L1", job, p.appId);
      workbench.queueStart(paths, job, p.appId);

      let rateLimited = false;
      const maxAttempts = profile.limits.maxAttemptsPerPlayer;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const rawPrompt = buildPrompt(job, player, attempt, feedback);
        feedback = null;
        // prompt-improver: reescreve o prompt e escolhe skills/subagentes (falha → prompt original)
        const imp = await improvePrompt({
          root,
          job,
          appId: p.appId,
          runId: p.runId,
          player,
          prompt: rawPrompt,
          // dry-run / executor fake → improver fake também (zero quota, fluxo E2E idêntico)
          cfg:
            p.dryRun || player.cli === "fake"
              ? { ...profile.promptImprover, cli: "fake", model: "default" }
              : profile.promptImprover,
          log,
        });
        const prompt = imp.prompt;
        if (!pipeline || pipeline.status !== "running") return { pass: false, detail: "pipeline parada" };
        const started = new Date().toISOString();
        const res = await runExecutor(player, prompt, job);

        if (detectRateLimit(res.tail)) {
          p.cooldowns[player.id] = new Date(Date.now() + profile.limits.cooldownMs).toISOString();
          log(`⏳ rate-limit em ${player.id} — cooldown ${Math.round(profile.limits.cooldownMs / 60000)}min, tentando fallback (L2 automático)`);
          workbench.handoffUpdate(paths, p, `L2: rate-limit em ${player.id}, redispatch automático`);
          rateLimited = true;
          save();
          break; // próximo player, sem contar attempt
        }

        const v = verify(job);
        p.history.push({
          job,
          playerId: player.id,
          attempt,
          startedAt: started,
          endedAt: new Date().toISOString(),
          exitCode: res.exitCode,
          pass: v.pass,
          detail: v.detail,
          errorTail: v.errorTail || (res.exitCode !== 0 ? res.tail.slice(-3000) : undefined),
        });
        save();

        if (v.pass) {
          p.currentPlayer = null;
          workbench.claimFree(paths, p.appId);
          workbench.queueDone(paths, job, p.appId, player.id);
          return { pass: true, player, detail: v.detail };
        }
        log(`✗ ${job} verify FAIL (tentativa ${attempt}/${maxAttempts}): ${v.detail}`);
      }

      // player saiu (rate-limit ou N falhas) → estado determinístico p/ o fallback recomeçar
      excluded.push(player.id);
      rollback(rateLimited ? `rate-limit de ${player.id} em ${job}` : `3 falhas de ${player.id} em ${job}`);
      workbench.claimFree(paths, p.appId);
    }
  }

  // ---------- git ----------

  function checkpoint(job) {
    try {
      gitApp(pipeline.appId, ["add", "-A"]);
      gitApp(pipeline.appId, ["commit", "--allow-empty", "-m", `${profile.git.commitPrefix}(${pipeline.appId}): ${job} PASS`]);
      const ref = gitApp(pipeline.appId, ["rev-parse", "HEAD"]);
      pipeline.git.checkpoints.push({ ref, job, at: new Date().toISOString() });
      pipeline.git.lastCheckpoint = ref;
      log(`✓ checkpoint ${ref.slice(0, 7)} · ${job}`);
    } catch (e) {
      log(`✗ checkpoint falhou: ${String(e).slice(0, 200)}`);
    }
    save();
  }

  function rollback(why) {
    const ref = pipeline.git.lastCheckpoint || pipeline.git.baseRef;
    if (!ref) return;
    try {
      gitApp(pipeline.appId, ["reset", "--hard", ref]);
      gitApp(pipeline.appId, ["clean", "-fd"]);
      log(`↶ rollback → ${ref.slice(0, 7)} (${why})`);
    } catch (e) {
      log(`✗ rollback falhou: ${String(e).slice(0, 200)}`);
    }
  }

  // ---------- ship (P3) ----------

  async function runShip() {
    const p = pipeline;
    const base = p.deploy.baseUrl || profile.deploy.baseUrl;
    const branch = profile.git.targetBranch;
    log(`🚀 P3 ship — merge ${branch} + deploy ${p.deploy.target} → ${p.deploy.subdomain}.${base}`);
    if (p.dryRun) {
      p.deploy.url = `https://${p.deploy.subdomain}.${base} (dry-run, não publicado)`;
      return { pass: true, detail: "dry-run: ship simulado" };
    }
    try {
      gitApp(p.appId, ["checkout", branch]);
      gitApp(p.appId, ["merge", "--no-ff", p.git.branch, "-m", `${profile.git.commitPrefix}(${p.appId}): merge pipeline (ship)`]);
      // push só se o app tiver remote (dar remote é opt-in do dono — fábrica e apps nascem local-only)
      if (gitApp(p.appId, ["remote"])) {
        gitApp(p.appId, ["push", "origin", branch]);
        log(`✓ merge + push ${branch}`);
      } else {
        log(`✓ merge ${branch} (app sem remote — push pulado)`);
      }
    } catch (e) {
      try {
        gitApp(p.appId, ["checkout", p.git.branch]);
      } catch {}
      return { pass: false, detail: `merge/push falhou: ${String(e).slice(0, 400)}` };
    }
    try {
      const { deployApp } = await import("./deploy.mjs");
      const result = await deployApp(p, { root, log, limits: profile.limits, profileDeploy: profile.deploy });
      if (!result.ok) return { pass: false, detail: result.error || "deploy falhou", manual: result.fallbackSteps };
      p.deploy.url = result.url;
      p.deploy.dns = result.dns || p.deploy.dns;
      return { pass: true, detail: `no ar: ${result.url}` };
    } catch (e) {
      return { pass: false, detail: `deploy.mjs indisponível/falhou: ${String(e).slice(0, 300)}` };
    }
  }

  // ---------- review overlay (papel Revisor: team.review após B1/B4) ----------

  function buildReviewPrompt(job, player) {
    const p = pipeline;
    const lines = [
      `Job: REVIEW de ${job}`,
      `App: ${p.appId}`,
      `Repo: ${root}`,
      `Ideia do app: ${p.idea}`,
      "",
      `Você é o REVISOR "${player.name}" na pipeline autônoma Forge. Outro agente acabou de implementar o job ${job}.`,
      `Revise ADVERSARIALMENTE o que foi feito (o app tem repo próprio — veja o diff recente: \`git -C apps/${p.appId} show HEAD\` ou \`git -C apps/${p.appId} diff HEAD~1\`).`,
      "Procure problemas REAIS: bugs, casos de borda quebrados, segurança, regras do projeto violadas, promessa que a UI faz e o código não cumpre.",
      "CONSERTE só o que for problema real, de causa raiz e cirúrgico — NÃO reescreva, NÃO expanda escopo, NÃO troque de abordagem.",
      "Se não achar problema real, NÃO mude NADA e responda apenas 'sem achados'.",
      "NÃO rode git commit/push (o orquestrador cuida). O build NÃO pode quebrar.",
      pipelineFooter(),
    ];
    if (profile.narrative) lines.push("", "---", "CONTEXTO DO PROJETO:", profile.narrative);
    const sysDesign = path.join(root, runDocRel(p.appId, "system-design"));
    if (fs.existsSync(sysDesign)) lines.push("", "---", "DESIGN APROVADO (o build deve seguir isto):", fs.readFileSync(sysDesign, "utf8"));
    return lines.join("\n");
  }

  /**
   * Overlay de revisão: se o team tem Revisor (team.review) e o job está em review.after,
   * roda UMA passada de revisão adversarial pelo player revisor. Advisory-safe: se o revisor
   * quebrar o verify, desfaz as mudanças dele e mantém a versão do job. Sem Revisor no team =
   * no-op (team.review undefined → zero impacto nos times grok-solo/grok-glm-front/etc).
   * Só dispara no caminho genérico (after = ["L1/B1","L1/B4"]); blueprints externos não casam.
   */
  async function maybeReview(job) {
    let rev, player;
    try {
      const roster = readRoster();
      rev = roster.teams?.[pipeline.team]?.review;
      if (!rev || !Array.isArray(rev.after) || !rev.after.includes(job)) return;
      player = roster.players.find((pl) => pl.id === rev.player);
    } catch {
      return;
    }
    if (!player) {
      log(`· review: player "${rev.player}" não existe no roster — pulando`);
      return;
    }
    log(`🔎 review de ${job} → ${player.name}${player.modelLabel ? " · " + player.modelLabel : ""}`);
    pipeline.currentPlayer = player.id;
    save();
    const res = await runExecutor(player, buildReviewPrompt(job, player), `review-${job}`);
    if (!pipeline || pipeline.status !== "running") return; // stop/kill durante a review
    pipeline.currentPlayer = null;
    if (detectRateLimit(res.tail)) {
      log(`⏳ review: rate-limit em ${player.id} — pulando revisão (advisory, não bloqueia)`);
      save();
      return;
    }
    let changed = false;
    try {
      changed = !!gitApp(pipeline.appId, ["status", "--porcelain"]);
    } catch {}
    if (!changed) {
      log(`✓ review de ${job}: sem achados (nada alterado)`);
      save();
      return;
    }
    const v = verify(job);
    if (v.pass) {
      checkpoint(`review-${job}`);
      log(`✓ review de ${job} aplicado (${v.detail})`);
    } else {
      rollback(`review de ${job} quebrou o verify`);
      log(`↶ review de ${job} revertido — build falhou, mantém a versão do job`);
    }
    save();
  }

  // ---------- loop ----------

  async function advanceLoop() {
    if (looping) return;
    looping = true;
    try {
      while (pipeline && pipeline.status === "running") {
        if (pipeline.jobIndex >= pipeline.jobs.length) {
          finish("done");
          break;
        }
        const job = pipeline.jobs[pipeline.jobIndex];
        const result = await runJob(job);

        if (!pipeline || pipeline.status === "killed") break; // stop/kill no meio

        if (result.pass) {
          // capability auto: o P0 acabou de declarar o tipo no scorecard — propõe p/ o gate (GO aplica)
          if (job === "L0/P0" && pipeline.capabilityAuto) {
            let parsed = null;
            try {
              parsed = parseCapabilityFromScorecard(fs.readFileSync(path.join(root, runDocRel(pipeline.appId, "scorecard")), "utf8"));
            } catch {}
            pipeline.detectedCapability = parsed || "static";
            log(parsed
              ? `· P0 propôs tipo: ${parsed} — GO no gate aplica jobs/deploy`
              : "⚠ scorecard não declarou \"Tipo:\" — assumindo static (retry com feedback se discordar)");
          }
          if (job !== "P3") checkpoint(job); // P3 já terminou em master via merge — sem commit extra
          if (job !== "P3") await maybeReview(job); // overlay do papel Revisor (no-op se o team não tem review)
          if (!pipeline || pipeline.status !== "running") break; // review pode ter sido parada/morta
          pipeline.jobIndex++;
          pipeline.currentJob = pipeline.jobs[pipeline.jobIndex] || null;
          const specGate = pipeline.jobSpecs && pipeline.jobSpecs[job] && pipeline.jobSpecs[job].gate;
          const gateFactory = GATES_AFTER[job];
          const base = specGate ? { ...specGate } : gateFactory ? gateFactory(pipeline) : null;
          if (base) {
            const gate = { ...base, afterJob: job, createdAt: new Date().toISOString(), decision: null };
            pipeline.gates.push(gate);
            pipeline.status = "paused_gate";
            log(`⏸ GATE ${gate.id}: ${gate.prompt}`);
            workbench.handoffUpdate(paths, pipeline);
            save();
            break;
          }
          workbench.handoffUpdate(paths, pipeline);
          save();
        } else {
          pipeline.status = "blocked";
          const gate = {
            id: `blocked-${job.replace("/", "-")}`,
            afterJob: job,
            prompt: `${job} bloqueado: ${result.detail}. retry (zera tentativas) ou kill?`,
            payload: result.manual ? result.manual.join(" · ") : null,
            choices: ["retry", "kill"],
            createdAt: new Date().toISOString(),
            decision: null,
          };
          pipeline.gates.push(gate);
          log(`🛑 BLOCKED em ${job}: ${result.detail}`);
          workbench.handoffUpdate(paths, pipeline, `BLOCKED: ${result.detail}`);
          save();
          break;
        }
      }
    } catch (e) {
      if (pipeline) {
        pipeline.status = "error";
        pipeline.error = String(e && e.stack ? e.stack : e).slice(0, 2000);
        log(`✗ engine error: ${String(e).slice(0, 300)}`);
        save();
      }
    } finally {
      looping = false;
    }
  }

  function finish(status) {
    pipeline.status = status;
    pipeline.endedAt = new Date().toISOString();
    pipeline.currentJob = null;
    if (status === "done") {
      log(`🎉 pipeline done — ${pipeline.deploy.url || "sem URL (ver HANDOFF)"}`);
      workbench.handoffUpdate(
        paths,
        pipeline,
        `DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de ${runDocRel(pipeline.appId, "content-hooks")}`
      );
      try {
        const p = path.join(root, "workbench", "QUEUE.md");
        const md = fs.readFileSync(p, "utf8");
        if (!md.includes(`L0/P4 Measure ${pipeline.appId}`)) {
          fs.writeFileSync(
            p,
            md.replace(/(^## Backlog\s*$)/m, `$1\n\n- [ ] **L0/P4** Measure ${pipeline.appId} (5–7d) — **humano** · ${pipeline.deploy.url || ""}`),
            "utf8"
          );
        }
      } catch {}
    } else {
      workbench.handoffUpdate(paths, pipeline, `pipeline encerrada: ${status}`);
    }
    save();
    try {
      fs.mkdirSync(RUNS_DIR, { recursive: true });
      fs.copyFileSync(PIPELINE_PATH, path.join(RUNS_DIR, `pipeline-${pipeline.runId}.json`));
    } catch {}
    // workbench atualizado após o run — commita NA FÁBRICA p/ deixá-la tidy (única escrita git
    // da fábrica no ciclo; execFileSync é sync → serializado mesmo com N pipelines)
    try {
      git(["add", "workbench"]);
      git(["commit", "-m", `forge(${pipeline.appId}): workbench final (${status})`]);
    } catch {
      /* nada a commitar = ok */
    }
    // done real = branch já mergeada no targetBranch DO APP → deleta (-d falha se não mergeada).
    // killed/dry-run: branch fica p/ inspeção — apagar é decisão do humano.
    if (status === "done" && !pipeline.dryRun) {
      try {
        gitApp(pipeline.appId, ["branch", "-d", pipeline.git.branch]);
        log(`✓ branch ${pipeline.git.branch} removida (merged no repo do app)`);
      } catch {
        log(`· branch ${pipeline.git.branch} mantida (não mergeada?)`);
      }
    }
  }

  // ---------- API pública ----------

  function start(params) {
    if (pipeline && ["running", "paused_gate", "blocked"].includes(pipeline.status)) {
      throw activeRunError();
    }
    profile = loadProfile(root);
    const idea = String(params.idea || "").trim();
    if (!idea) throw new Error("idea vazia");
    const roster = readRoster();
    const team = resolveTeam(roster, params.team || "grok-solo");
    if (!roster.teams?.[team]) {
      throw new Error(`team "${team}" não existe — disponíveis: ${Object.keys(roster.teams || {}).join(", ")}`);
    }
    const dryRun = !!params.dryRun || team === "dry-run";
    const blueprint = params.blueprint || "generic";
    // tipo do app: sem --capability o P0 decide (declara "Tipo:" no scorecard; GO do p0-go aplica)
    const capabilityAuto = blueprint === "generic" && (!params.capability || params.capability === "auto");
    const capability = capabilityAuto ? "static" : params.capability || "static";
    const appId = deriveAppId(params);
    if (!appId) throw new Error("não consegui derivar app-id — passe --app-id ou --slug");
    if (boundAppId && appId !== boundAppId) throw new Error(`engine é do app "${boundAppId}" — start de "${appId}" vai pelo manager`);

    const plan = resolvePlan({ root, blueprint, capability, appId });

    // repo-por-app: cria/valida o repo do app e roda a branch do run DENTRO dele (fábrica intocada)
    ensureAppRepo(appId);
    // parte sempre do targetBranch: um run morto antes pode ter deixado o repo numa branch de pipeline
    try {
      gitApp(appId, ["checkout", profile.git.targetBranch]);
    } catch {}
    const baseRef = gitApp(appId, ["rev-parse", "HEAD"]);
    // branch livre: re-run do mesmo app (após kill) vira pipeline/<app>-2, -3… em vez de travar
    let branch = `pipeline/${appId}`;
    for (let n = 2; gitApp(appId, ["branch", "--list", branch]); n++) branch = `pipeline/${appId}-${n}`;
    gitApp(appId, ["checkout", "-b", branch]);

    // DS gerado por projeto: pula DS-GEN se este app já tem design system (só generic)
    let jobs = plan.jobs;
    if (plan.jobSpecs === null && fs.existsSync(path.join(root, runDocRel(appId, "design-system")))) {
      jobs = jobs.filter((j) => j !== "DS-GEN");
      log(`· DS-GEN pulado — ${runDocRel(appId, "design-system")} já existe`);
    }

    pipeline = {
      runId: new Date().toISOString().replace(/[:.]/g, "-"),
      appId,
      idea,
      mode: "auto",
      team,
      capability,
      dryRun,
      status: "running",
      profileName: profile.name,
      capabilityAuto,
      jobs,
      jobIndex: 0,
      currentJob: null,
      blueprint,
      slug: appId,
      projectDir: plan.jobSpecs ? path.join(root, ".forge", "projects", appId) : null,
      jobSpecs: plan.jobSpecs,
      git: { branch, baseRef, checkpoints: [], lastCheckpoint: baseRef },
      gates: [],
      history: [],
      cooldowns: {},
      deploy: {
        target: params.target || (capability === "chat" ? profile.deploy.serverHost : profile.deploy.staticHost),
        autoTarget: !params.target, // sem --target o alvo segue o tipo (recalculado quando o P0 define)
        subdomain: slugify(params.subdomain || appId),
        baseUrl: profile.deploy.baseUrl,
        url: null,
        dns: { status: "pending" },
      },
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    log(`🎼 forge new · app=${appId} · team=${team} · capability=${capabilityAuto ? "auto (P0 decide)" : capability} · profile=${profile.name}${pipeline.dryRun ? " · DRY-RUN" : ""}`);
    workbench.handoffUpdate(paths, pipeline);
    save();
    advanceLoop();
    return snapshot();
  }

  /** static (output: "export") → cf-pages · senão app server → vercel */
  function detectCapability(appId) {
    for (const f of ["next.config.ts", "next.config.mjs", "next.config.js"]) {
      try {
        const cfg = fs.readFileSync(path.join(root, "apps", appId, f), "utf8");
        return /output:\s*["']export["']/.test(cfg) ? "static" : "chat";
      } catch {}
    }
    return "static";
  }

  /** reusa o deploy da última pipeline arquivada deste app (se houver) */
  function lastDeployFor(appId) {
    try {
      const files = fs
        .readdirSync(RUNS_DIR)
        .filter((f) => f.startsWith("pipeline-") && f.endsWith(".json"))
        .sort()
        .reverse();
      for (const f of files) {
        const p = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf8"));
        if (p.appId === appId && p.deploy) return p.deploy;
      }
    } catch {}
    return null;
  }

  /** Loop de melhoria: feedback geral do dono → ITERATE → gate visual → B5 → gate deploy → redeploy */
  function startFeedback(params) {
    if (pipeline && ["running", "paused_gate", "blocked"].includes(pipeline.status)) {
      throw activeRunError();
    }
    profile = loadProfile(root);
    const appId = slugify(params.appId || "");
    if (!appId || !fs.existsSync(path.join(root, "apps", appId))) {
      throw new Error(`app "${params.appId}" não existe em apps/ — forge feedback <app> "<texto>"`);
    }
    const feedbackText = String(params.feedbackText || "").trim();
    if (feedbackText.length < 8) throw new Error("feedback vazio ou curto demais");
    const roster = readRoster();
    const team = resolveTeam(roster, params.team || (roster.teams?.["grok-glm-front"] ? "grok-glm-front" : "grok-solo"));
    if (!roster.teams?.[team]) {
      throw new Error(`team "${team}" não existe — disponíveis: ${Object.keys(roster.teams || {}).join(", ")}`);
    }
    const dryRun = !!params.dryRun || team === "dry-run";

    ensureAppRepo(appId);
    const baseRef = gitApp(appId, ["rev-parse", "HEAD"]);
    let n = 1;
    while (gitApp(appId, ["branch", "--list", `pipeline/${appId}-fb${n}`])) n++;
    const branch = `pipeline/${appId}-fb${n}`;
    gitApp(appId, ["checkout", "-b", branch]);

    const capability = detectCapability(appId);
    const prevDeploy = lastDeployFor(appId);
    pipeline = {
      runId: new Date().toISOString().replace(/[:.]/g, "-"),
      appId,
      idea: `feedback fb${n}: ${feedbackText.slice(0, 120)}`,
      mode: "feedback",
      feedbackText,
      iterationNum: n,
      team,
      capability,
      dryRun,
      status: "running",
      profileName: profile.name,
      jobs: ["ITERATE", "L1/B5", "P3"],
      jobIndex: 0,
      currentJob: null,
      git: { branch, baseRef, checkpoints: [], lastCheckpoint: baseRef },
      gates: [],
      history: [],
      cooldowns: {},
      deploy: {
        target: params.target || prevDeploy?.target || (capability === "chat" ? profile.deploy.serverHost : profile.deploy.staticHost),
        subdomain: slugify(params.subdomain || prevDeploy?.subdomain || appId),
        baseUrl: prevDeploy?.baseUrl || profile.deploy.baseUrl,
        url: null,
        dns: { status: "pending" },
      },
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    log(`🔁 forge feedback · app=${appId} · fb${n} · team=${team}${dryRun ? " · DRY-RUN" : ""}`);
    log(`   "${feedbackText.slice(0, 140)}"`);
    workbench.handoffUpdate(paths, pipeline);
    save();
    advanceLoop();
    return snapshot();
  }

  function decide(gateId, choice, feedback) {
    if (!pipeline) throw new Error("nenhuma pipeline ativa");
    const gate = pipeline.gates.find((g) => g.id === gateId && !g.decision);
    if (!gate) throw new Error(`gate "${gateId}" não está pendente`);
    if (!gate.choices.includes(choice)) throw new Error(`escolha "${choice}" inválida — opções: ${gate.choices.join("|")}`);

    gate.decision = choice;
    gate.decidedAt = new Date().toISOString();
    if (feedback) gate.feedback = feedback;
    log(`✔ gate ${gateId} → ${choice}${feedback ? ` (${feedback.slice(0, 80)})` : ""}`);

    // capability auto: GO no p0-go aplica o tipo proposto pelo P0 (jobs da sequência + alvo de deploy)
    if (gate.id === "p0-go" && choice === "go" && pipeline.capabilityAuto) {
      const cap = pipeline.detectedCapability || "static";
      pipeline.capability = cap;
      pipeline.capabilityAuto = false;
      let jobs = JOBS_BY_CAPABILITY[cap].slice();
      if (fs.existsSync(path.join(root, runDocRel(pipeline.appId, "design-system")))) jobs = jobs.filter((j) => j !== "DS-GEN");
      pipeline.jobs = jobs; // P0 é o job 0 em toda sequência (divergem só depois) — trocar o array com jobIndex=1 é seguro
      pipeline.currentJob = jobs[pipeline.jobIndex] || null;
      if (pipeline.deploy?.autoTarget) {
        pipeline.deploy.target = cap === "chat" ? profile.deploy.serverHost : profile.deploy.staticHost;
      }
      log(`✔ tipo aplicado: ${cap} — ${jobs.length} jobs · deploy ${pipeline.deploy.target}`);
    }

    // ds-pick: escolha 1/2/3 fixa a proposta de design system que os builds de UI vão seguir
    if (gate.id === "ds-pick" && ["1", "2", "3"].includes(choice)) {
      pipeline.dsChoice = choice;
      log(`✔ design system: proposta ${choice} escolhida`);
    }

    // pick declarativo (concept-review etc.) → guarda no pipeline como dsChoice faz
    if (gate.storePick && !["go", "retry", "kill"].includes(choice)) {
      pipeline[gate.storePick] = choice;
      log(`✔ ${gate.storePick} = ${choice}`);
    }
    // decisão versionada (projetos com projectDir: gameads)
    if (pipeline.projectDir) {
      recordDecision({ projectDir: pipeline.projectDir, gateId, choice, feedback });
      if (gateId === "experience-plan-review" && choice === "go") {
        writeApproval({ projectDir: pipeline.projectDir, payload: {
          blueprint: pipeline.blueprint, slug: pipeline.slug,
          approvedConcept: pipeline.conceptChoice || null,
          planPath: `docs/${pipeline.slug}/experience-plan.md`,
        }});
        log(`✅ approval.json gravado — experience-plan aprovado`);
      }
    }

    if (choice === "kill") {
      finish("killed");
      return snapshot();
    }
    if (choice === "retry") {
      // volta pro job que originou o gate (b3-visual→B3, iterate-visual→ITERATE, blocked-*→o próprio)
      if (gate.afterJob && pipeline.jobs.includes(gate.afterJob)) {
        pipeline.jobIndex = pipeline.jobs.indexOf(gate.afterJob);
      }
      if (gate.id.startsWith("blocked-")) {
        pipeline.history = pipeline.history.map((h) => (h.job === gate.afterJob ? { ...h, superseded: true } : h));
      }
      pipeline.pendingFeedback = feedback || null;
    }
    pipeline.status = "running";
    save();
    advanceLoop();
    return snapshot();
  }

  /** mata o executor em andamento (o child do CLI), se houver */
  function killChild() {
    if (!child) return;
    try {
      if (process.platform === "win32" && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
      else child.kill("SIGTERM");
    } catch {}
  }

  /** kill direto: mata o executor e encerra o run — funciona SEM gate pendente (running/blocked/paused) */
  function kill() {
    if (!pipeline) return { ok: false, error: "nenhuma pipeline para matar" };
    if (["done", "killed"].includes(pipeline.status)) {
      return { ok: false, error: `${pipeline.appId} já está ${pipeline.status} — nada a matar` };
    }
    killChild();
    log("✗ kill manual — encerrando run");
    finish("killed");
    return { ok: true, status: "killed" };
  }

  function stop() {
    if (pipeline && pipeline.status === "blocked") {
      const g = (pipeline.gates || []).find((x) => !x.decision);
      return {
        ok: false,
        error: `${pipeline.appId} já está parado (blocked${g ? ` · gate ${g.id}` : ""}) — decida: forge decide ${g ? g.id : "<gate>"} <retry|kill> --app ${pipeline.appId}`,
      };
    }
    if (!pipeline || !["running", "paused_gate"].includes(pipeline.status)) {
      return { ok: false, error: "nenhuma pipeline rodando" };
    }
    killChild();
    pipeline.status = "blocked";
    pipeline.gates.push({
      id: "stopped",
      afterJob: pipeline.currentJob,
      prompt: "pipeline parada manualmente — retry (recomeça o job atual) ou kill?",
      choices: ["retry", "kill"],
      createdAt: new Date().toISOString(),
      decision: null,
    });
    log("■ pipeline stop (manual)");
    save();
    return { ok: true };
  }

  function resume() {
    if (!pipeline) {
      if (!fs.existsSync(PIPELINE_PATH)) throw new Error("sem maestro/pipeline.json para retomar");
      pipeline = JSON.parse(fs.readFileSync(PIPELINE_PATH, "utf8"));
      log(`↻ pipeline recarregada do disco: ${pipeline.appId} (${pipeline.status})`);
    }
    const gate = pipeline.gates.find((g) => !g.decision);
    if (gate) return snapshot(); // gate pendente: decisão via decide()
    if (["done", "killed", "error"].includes(pipeline.status)) throw new Error(`pipeline ${pipeline.status} — nada a retomar`);
    pipeline.status = "running";
    save();
    advanceLoop();
    return snapshot();
  }

  // restaura do disco no boot do server (não retoma sozinho — user decide)
  if (fs.existsSync(PIPELINE_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PIPELINE_PATH, "utf8"));
      if (!["done", "killed"].includes(saved.status)) {
        pipeline = saved;
        if (pipeline.status === "running") {
          pipeline.status = "blocked";
          pipeline.gates.push({
            id: "server-restart",
            afterJob: pipeline.currentJob,
            prompt: "server reiniciou no meio do job — retry (recomeça job atual) ou kill?",
            choices: ["retry", "kill"],
            createdAt: new Date().toISOString(),
            decision: null,
          });
        }
      }
    } catch {}
  }

  return { start, startFeedback, decide, stop, kill, resume, snapshot };
}

/**
 * Manager multi-pipeline: um engine POR APP (Map<appId, engine>). Cada engine encapsula
 * naturalmente o estado do seu run (pipeline/child/loop/profile) — N apps rodam concorrentes,
 * cada um dirigindo o próprio repo (repo-por-app). Estado em maestro/pipelines/<appId>.json.
 */
export function createEngineManager({ root, emitLog, emitPipeline }) {
  const PIPES_DIR = path.join(root, "maestro", "pipelines");
  const engines = new Map(); // appId → engine

  // migração: maestro/pipeline.json legado (single-pipeline) vira maestro/pipelines/<appId>.json
  const legacy = path.join(root, "maestro", "pipeline.json");
  if (fs.existsSync(legacy)) {
    try {
      const saved = JSON.parse(fs.readFileSync(legacy, "utf8"));
      if (saved.appId) {
        fs.mkdirSync(PIPES_DIR, { recursive: true });
        const dest = path.join(PIPES_DIR, `${saved.appId}.json`);
        if (!fs.existsSync(dest)) fs.renameSync(legacy, dest);
        else fs.rmSync(legacy);
      }
    } catch {}
  }

  function snapshotAll() {
    const out = {};
    for (const [id, e] of engines) out[id] = e.snapshot();
    return out;
  }

  function engineFor(appId) {
    if (!engines.has(appId)) {
      engines.set(
        appId,
        createEngine({
          root,
          appId,
          emitLog: (line) => emitLog(`[${appId}] ${line}`),
          emitPipeline: () => emitPipeline(snapshotAll()),
        })
      );
    }
    return engines.get(appId);
  }

  // boot: recarrega todo estado persistido (cada engine se restaura do próprio .json)
  if (fs.existsSync(PIPES_DIR)) {
    for (const f of fs.readdirSync(PIPES_DIR)) {
      if (f.endsWith(".json")) engineFor(f.slice(0, -5));
    }
  }

  const ACTIVE = ["running", "paused_gate", "blocked"];
  const activeEntries = () => [...engines.entries()].filter(([, e]) => ACTIVE.includes(e.snapshot().status));

  /** resolve o alvo: appId explícito, ou fallback quando há exatamente 1 pipeline ativa (compat CLI) */
  function target(appId) {
    if (appId) {
      if (!engines.has(appId)) throw new Error(`pipeline "${appId}" não existe — ativas: ${activeEntries().map(([id]) => id).join(", ") || "nenhuma"}`);
      return engines.get(appId);
    }
    const act = activeEntries();
    if (act.length === 1) return act[0][1];
    if (act.length === 0) throw new Error("nenhuma pipeline ativa");
    throw new Error(`há ${act.length} pipelines ativas (${act.map(([id]) => id).join(", ")}) — informe o appId`);
  }

  return {
    start(params) {
      const appId = deriveAppId(params);
      if (!appId) throw new Error("não consegui derivar app-id — passe appId/slug ou uma ideia com texto");
      return engineFor(appId).start(params);
    },
    startFeedback(params) {
      const appId = slugify(params.appId || "");
      if (!appId) throw new Error("forge feedback <app> — appId obrigatório");
      return engineFor(appId).startFeedback(params);
    },
    decide(appId, gateId, choice, feedback) {
      return target(appId).decide(gateId, choice, feedback);
    },
    stop(appId) {
      return target(appId).stop();
    },
    kill(appId) {
      return target(appId).kill();
    },
    resume(appId) {
      return target(appId).resume();
    },
    snapshot() {
      return snapshotAll();
    },
    snapshotFor(appId) {
      return engines.has(appId) ? engines.get(appId).snapshot() : { status: "idle" };
    },
    /**
     * Apaga TUDO de um app: repo (apps/<app>, com .git), estado do run, propostas do DS-GEN
     * e rastros no workbench. Run ativo só sai com force (mata o executor antes).
     */
    removeApp(appId, opts = {}) {
      // regex fecha path traversal: appId vira caminho de fs (rm -rf) logo abaixo
      if (!/^[a-z0-9-]+$/.test(String(appId || ""))) throw new Error(`appId inválido: ${appId}`);
      const e = engines.get(appId);
      if (e) {
        const st = e.snapshot().status;
        if (ACTIVE.includes(st)) {
          if (!opts.force) {
            throw new Error(`app ${appId} tem run ativo (${st}) — decida/pare antes (forge decide … --app ${appId}) ou use --force`);
          }
          try {
            e.stop(); // mata o executor em andamento
          } catch {}
        }
        engines.delete(appId);
      }
      const removed = [];
      for (const t of [
        path.join(root, "apps", appId),
        path.join(root, "maestro", "pipelines", `${appId}.json`),
        path.join(root, "maestro", "proposals", appId),
      ]) {
        if (fs.existsSync(t)) {
          fs.rmSync(t, { recursive: true, force: true });
          removed.push(path.relative(root, t));
        }
      }
      workbench.purgeApp({ root }, appId);
      emitLog(`🗑 removido: ${appId}${removed.length ? " — " + removed.join(" · ") : " (nada em disco)"}`);
      emitPipeline(snapshotAll());
      return { ok: true, removed };
    },
  };
}
