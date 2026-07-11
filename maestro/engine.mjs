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

const JOB_TEMPLATES = {
  "L0/P0": "L0-P0-scorecard.md",
  "L0/P1": "L0-P1-content-hooks.md",
  "L1/B1": "L1-B1-scaffold.md",
  "L1/B2": "L1-B2-personas.md",
  "L1/B3": "L1-B3-ui-polish.md",
  "L1/B4": "L1-B4-wire-api.md",
  "L1/B5": "L1-B5-ship-check.md",
  ITERATE: "FEEDBACK-ITERATE.md",
};

const JOBS_BY_CAPABILITY = {
  static: ["L0/P0", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B5", "P3"],
  quiz: ["L0/P0", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B5", "P3"],
  chat: ["L0/P0", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B4", "L1/B5", "P3"],
};

// gate criado DEPOIS do job passar; pipeline pausa até forge decide
const GATES_AFTER = {
  "L0/P0": (p) => ({
    id: "p0-go",
    prompt: `Scorecard pronto (docs/scorecard-${p.appId}.md). GO ou KILL?`,
    payload: `docs/scorecard-${p.appId}.md`,
    choices: ["go", "kill"],
  }),
  "L1/B3": (p) => ({
    id: "b3-visual",
    prompt: `UI polida. Preview: http://127.0.0.1:8787/preview/${p.appId}/ (ou npm run dev). Aprova o visual?`,
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
    prompt: `Feedback aplicado. Preview: http://127.0.0.1:8787/preview/${p.appId}/ (ou npm run dev). Aprova a iteração?`,
    payload: `preview:${p.appId}`,
    choices: ["go", "retry", "kill"],
  }),
};

const MAX_ATTEMPTS_PER_PLAYER = 3;
const COOLDOWN_MS = 60 * 60 * 1000;
const JOB_TIMEOUT_MS = { "L0/P0": 15 * 60 * 1000, "L0/P1": 15 * 60 * 1000, default: 30 * 60 * 1000 };
const JOB_MAX_TURNS = { "L0/P0": 25, "L0/P1": 25, "L1/B1": 50, "L1/B3": 50, "L1/B4": 40, default: 30 };

// ---------- ProjectProfile (o "vertical" configurável — .forge/profile.md) ----------
const PROFILE_DEFAULTS = {
  name: "Forge",
  namespace: "@forge",
  niche: "generic",
  ai: { provider: "zai", model: "", envKey: "ZAI_API_KEY" },
  i18n: { defaultLocale: "pt-BR", locales: ["pt-BR"], rule: "single" },
  ui: { theme: "", designSystem: "", tokenPrefix: "--af-" },
  deploy: { baseUrl: "example.com", staticHost: "cf-pages", serverHost: "vercel" },
  git: { targetBranch: "master", commitPrefix: "forge" },
  legal: { ipRules: [] },
  capabilities: ["static", "quiz", "chat"],
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
    narrative = raw.replace(fence, "").replace(/^>.*$/gm, "").trim();
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
  };
  prof.narrative = narrative;
  return prof;
}

export function createEngine({ root, emitLog, emitPipeline }) {
  const PIPELINE_PATH = path.join(root, "maestro", "pipeline.json");
  const RUNS_DIR = path.join(root, "maestro", "runs");
  const paths = { root };
  const profile = loadProfile(root);

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
    return execFileSync("git", args, { cwd: root, encoding: "utf8", ...opts }).trim();
  }

  function readRoster() {
    return JSON.parse(fs.readFileSync(path.join(root, "maestro", "roster.json"), "utf8"));
  }

  function slugify(s) {
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
    const template = JOB_TEMPLATES[job];
    const lines = [
      `Job: ${job}`,
      `App: ${p.appId}`,
      `Repo: ${root}`,
      `Ideia do app: ${p.idea}`,
      `Capability: ${p.capability}`,
      "",
      `Você é o executor "${player.name}" do job ${job} na pipeline autônoma Forge (Maestro / ${profile.name}).`,
      `Projeto (nicho): ${profile.niche}. Namespace: ${profile.namespace}.`,
      template
        ? `Siga EXATAMENTE o template docs/prompts/${template} — preencha os campos <<< >>> com: App id=${p.appId}, Capability=${p.capability}, IDEIA=${p.idea}.`
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
    // Ground-truth da fase FOUNDATION (Fase C grava este arquivo): jobs L1 seguem o design aprovado.
    const sysDesign = path.join(root, "docs", `system-design-${p.appId}.md`);
    if (job.startsWith("L1/") && fs.existsSync(sysDesign)) {
      lines.push("", "---", "DESIGN APROVADO (system design da FOUNDATION — siga à risca):", fs.readFileSync(sysDesign, "utf8"));
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
    if (job === "L0/P0") return `docs/scorecard-${pipeline.appId}.md existe com GO/NO-GO`;
    if (job === "L0/P1") return `docs/content-hooks-${pipeline.appId}.md existe`;
    return `npm run build -w ${profile.namespace}/${pipeline.appId} sai com exit 0`;
  }

  // ---------- verify ----------

  function verify(job) {
    const p = pipeline;
    if (job === "L0/P0") {
      const f = path.join(root, "docs", `scorecard-${p.appId}.md`);
      if (!fs.existsSync(f)) return { pass: false, detail: `faltou ${path.relative(root, f)}` };
      const txt = fs.readFileSync(f, "utf8");
      const go = /\bGO\b/.test(txt) && !/\bNO-?GO\b/.test(txt.split("\n").slice(0, 10).join("\n"));
      return { pass: true, detail: go ? "scorecard: GO" : "scorecard: revisar GO/NO-GO no gate" };
    }
    if (job === "L0/P1") {
      const f = path.join(root, "docs", `content-hooks-${p.appId}.md`);
      return fs.existsSync(f)
        ? { pass: true, detail: "hooks ok" }
        : { pass: false, detail: `faltou ${path.relative(root, f)}` };
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
          maxTurns: JOB_MAX_TURNS[job] || JOB_MAX_TURNS.default,
          model: player.model !== "default" ? player.model : undefined,
        });
      } catch (e) {
        resolve({ exitCode: 1, tail: String(e), spawnError: true });
        return;
      }

      const runDir = path.join(RUNS_DIR, pipeline.runId);
      fs.mkdirSync(runDir, { recursive: true });
      const rawPath = path.join(runDir, `${job.replace("/", "-")}-${Date.now()}.raw.log`);
      const rawFd = fs.openSync(rawPath, "w");

      fs.writeFileSync(path.join(root, "maestro", ".run-goal.txt"), prompt, "utf8");
      log(`▶ ${job} → ${player.name} (${player.cli}${player.env ? "/" + player.env : ""})`);
      log(`  raw → ${path.relative(root, rawPath)}`);

      let tail = "";
      const san = createStreamSanitizer((line) => log(`  ${line}`));

      let proc;
      try {
        proc = spawn(spec.cmd, spec.args, { cwd: root, env: spec.env, windowsHide: true });
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

      const timeoutMs = JOB_TIMEOUT_MS[job] || JOB_TIMEOUT_MS.default;
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
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PLAYER; attempt++) {
        const prompt = buildPrompt(job, player, attempt, feedback);
        feedback = null;
        const started = new Date().toISOString();
        const res = await runExecutor(player, prompt, job);

        if (detectRateLimit(res.tail)) {
          p.cooldowns[player.id] = new Date(Date.now() + COOLDOWN_MS).toISOString();
          log(`⏳ rate-limit em ${player.id} — cooldown 60min, tentando fallback (L2 automático)`);
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
          workbench.claimFree(paths);
          workbench.queueDone(paths, job, p.appId, player.id);
          return { pass: true, player, detail: v.detail };
        }
        log(`✗ ${job} verify FAIL (tentativa ${attempt}/${MAX_ATTEMPTS_PER_PLAYER}): ${v.detail}`);
      }

      // player saiu (rate-limit ou 3 falhas) → estado determinístico p/ o fallback recomeçar
      excluded.push(player.id);
      rollback(rateLimited ? `rate-limit de ${player.id} em ${job}` : `3 falhas de ${player.id} em ${job}`);
      workbench.claimFree(paths);
    }
  }

  // ---------- git ----------

  function ensureCleanTree() {
    const dirty = git(["status", "--porcelain"]);
    if (dirty) {
      throw new Error(
        "working tree suja — commit/stash antes de iniciar a pipeline:\n" +
          dirty +
          "\n(dica: arquivos de ideia vivem em ideas/ — pasta gitignored, não suja a árvore)"
      );
    }
  }

  function checkpoint(job) {
    try {
      git(["add", "-A"]);
      git(["commit", "--allow-empty", "-m", `${profile.git.commitPrefix}(${pipeline.appId}): ${job} PASS`]);
      const ref = git(["rev-parse", "HEAD"]);
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
      git(["reset", "--hard", ref]);
      git(["clean", "-fd", "--", `apps/${pipeline.appId}`]);
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
      git(["checkout", branch]);
      git(["merge", "--no-ff", p.git.branch, "-m", `${profile.git.commitPrefix}(${p.appId}): merge pipeline (ship)`]);
      git(["push", "origin", branch]);
      log("✓ merge + push master");
    } catch (e) {
      try {
        git(["checkout", p.git.branch]);
      } catch {}
      return { pass: false, detail: `merge/push falhou: ${String(e).slice(0, 400)}` };
    }
    try {
      const { deployApp } = await import("./deploy.mjs");
      const result = await deployApp(p, { root, log });
      if (!result.ok) return { pass: false, detail: result.error || "deploy falhou", manual: result.fallbackSteps };
      p.deploy.url = result.url;
      p.deploy.dns = result.dns || p.deploy.dns;
      return { pass: true, detail: `no ar: ${result.url}` };
    } catch (e) {
      return { pass: false, detail: `deploy.mjs indisponível/falhou: ${String(e).slice(0, 300)}` };
    }
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
          if (job !== "P3") checkpoint(job); // P3 já terminou em master via merge — sem commit extra
          pipeline.jobIndex++;
          pipeline.currentJob = pipeline.jobs[pipeline.jobIndex] || null;
          const gateFactory = GATES_AFTER[job];
          if (gateFactory) {
            const gate = { ...gateFactory(pipeline), afterJob: job, createdAt: new Date().toISOString(), decision: null };
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
        `DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de docs/content-hooks-${pipeline.appId}.md`
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
    // workbench atualizado após o último checkpoint — commita p/ deixar a árvore limpa
    try {
      git(["add", "workbench", "docs"]);
      git(["commit", "-m", `forge(${pipeline.appId}): workbench final (${status})`]);
    } catch {
      /* nada a commitar = ok */
    }
    // done real = branch já mergeada em master → deleta (-d falha se não mergeada).
    // killed/dry-run: branch fica p/ inspeção — apagar é decisão do humano.
    if (status === "done" && !pipeline.dryRun) {
      try {
        git(["branch", "-d", pipeline.git.branch]);
        log(`✓ branch ${pipeline.git.branch} removida (merged em master)`);
      } catch {
        log(`· branch ${pipeline.git.branch} mantida (não mergeada?)`);
      }
    }
  }

  // ---------- API pública ----------

  function start(params) {
    if (pipeline && ["running", "paused_gate", "blocked"].includes(pipeline.status)) {
      throw new Error(`já existe pipeline ativa (${pipeline.appId} · ${pipeline.status}) — forge stop ou decide antes`);
    }
    const idea = String(params.idea || "").trim();
    if (!idea) throw new Error("idea vazia");
    const roster = readRoster();
    const team = params.team || "grok-solo";
    if (!roster.teams?.[team]) {
      throw new Error(`team "${team}" não existe — disponíveis: ${Object.keys(roster.teams || {}).join(", ")}`);
    }
    const dryRun = !!params.dryRun || team === "dry-run";
    const capability = params.capability || "static";
    if (!JOBS_BY_CAPABILITY[capability]) throw new Error(`capability "${capability}" inválida (static|quiz|chat)`);
    const appId = slugify(params.appId || idea);
    if (!appId) throw new Error("não consegui derivar app-id da ideia — passe --app-id");

    ensureCleanTree();
    const baseRef = git(["rev-parse", "HEAD"]);
    const branch = `pipeline/${appId}`;
    const existing = git(["branch", "--list", branch]);
    if (existing) throw new Error(`branch ${branch} já existe — apague ou use outro --app-id`);
    git(["checkout", "-b", branch]);

    pipeline = {
      runId: new Date().toISOString().replace(/[:.]/g, "-"),
      appId,
      idea,
      mode: "auto",
      team,
      capability,
      dryRun,
      status: "running",
      jobs: JOBS_BY_CAPABILITY[capability],
      jobIndex: 0,
      currentJob: null,
      git: { branch, baseRef, checkpoints: [], lastCheckpoint: baseRef },
      gates: [],
      history: [],
      cooldowns: {},
      deploy: {
        target: params.target || (capability === "chat" ? profile.deploy.serverHost : profile.deploy.staticHost),
        subdomain: slugify(params.subdomain || appId),
        baseUrl: profile.deploy.baseUrl,
        url: null,
        dns: { status: "pending" },
      },
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    log(`🎼 forge new · app=${appId} · team=${team} · capability=${capability} · profile=${profile.name}${pipeline.dryRun ? " · DRY-RUN" : ""}`);
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
      throw new Error(`já existe pipeline ativa (${pipeline.appId} · ${pipeline.status}) — forge stop ou decide antes`);
    }
    const appId = slugify(params.appId || "");
    if (!appId || !fs.existsSync(path.join(root, "apps", appId))) {
      throw new Error(`app "${params.appId}" não existe em apps/ — forge feedback <app> "<texto>"`);
    }
    const feedbackText = String(params.feedbackText || "").trim();
    if (feedbackText.length < 8) throw new Error("feedback vazio ou curto demais");
    const roster = readRoster();
    const team = params.team || (roster.teams?.["grok-glm-front"] ? "grok-glm-front" : "grok-solo");
    if (!roster.teams?.[team]) {
      throw new Error(`team "${team}" não existe — disponíveis: ${Object.keys(roster.teams || {}).join(", ")}`);
    }
    const dryRun = !!params.dryRun || team === "dry-run";

    ensureCleanTree();
    const baseRef = git(["rev-parse", "HEAD"]);
    let n = 1;
    while (git(["branch", "--list", `pipeline/${appId}-fb${n}`])) n++;
    const branch = `pipeline/${appId}-fb${n}`;
    git(["checkout", "-b", branch]);

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

  function stop() {
    if (!pipeline || !["running", "paused_gate"].includes(pipeline.status)) {
      return { ok: false, error: "nenhuma pipeline rodando" };
    }
    if (child) {
      try {
        if (process.platform === "win32" && child.pid)
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
        else child.kill("SIGTERM");
      } catch {}
    }
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

  return { start, startFeedback, decide, stop, resume, snapshot };
}
