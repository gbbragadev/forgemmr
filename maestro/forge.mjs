#!/usr/bin/env node
/**
 * forge — CLI do Maestro Autopilot (estilo harness: TUI full-screen, cliente REST+SSE).
 *
 *   forge new "<ideia>" [--team grok-glm-front] [--app-id x] [--capability static|quiz|chat]
 *                       [--subdomain x] [--target cf-pages|cf-workers|gh-pages] [--dry-run]
 *   forge attach | status | decide <gate> <go|kill|retry> [feedback…] | stop | resume | roster
 *
 * Teclas na TUI: [g] go · [k] kill (2x) · [r] retry · [f] retry + feedback · [q] detach
 * O server (maestro/server.mjs :8799) é iniciado automaticamente se não estiver de pé.
 */

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import readline from "node:readline";
import { buildProfileMd, composeTeam, TEAM_ROLES, slugify, listProfiles, activateProfile, importActiveProfile, JOB_SHORT } from "./engine.mjs";
import { loadBlueprint } from "./blueprint-loader.mjs";
import { recordDecision } from "./decisions.mjs";
import { aggregateRuns, formatStats, loadRuns } from "./stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.MAESTRO_PORT || 8799);
const API = `http://127.0.0.1:${PORT}`;

/** encerra o server pela porta — usado pelo `forge restart` quando o server no ar é antigo (sem /shutdown) */
function killServerByPort(port) {
  // execFileSync (sem shell) + pid validado: nada aqui é interpolado em linha de comando
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
      const pids = [
        ...new Set(
          out
            .split(/\r?\n/)
            .filter((l) => l.includes("LISTENING") && l.includes(`:${port} `))
            .map((l) => l.trim().split(/\s+/).pop())
            .filter((p) => /^\d+$/.test(p))
        ),
      ];
      for (const pid of pids) execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
      return pids.length > 0;
    }
    execFileSync("pkill", ["-f", "maestro/server.mjs"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ---------- ANSI ----------
const ESC = "\x1b[";
const reset = `${ESC}0m`;
const bold = (s) => `${ESC}1m${s}${reset}`;
const dim = (s) => `${ESC}2m${s}${reset}`;
const fg = (hex, s) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return s;
  const n = parseInt(m[1], 16);
  return `${ESC}38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m${s}${reset}`;
};
const PURPLE = "#c44dff";
const GREEN = "#34d399";
const YELLOW = "#fbbf24";
const RED = "#f87171";
const CYAN = "#22d3ee";
const GREY = "#8b8b9e";

const visibleLen = (s) => {
  // largura aproximada: remove ANSI, emoji conta 2
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  let w = 0;
  for (const ch of plain) w += /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ch) ? 2 : 1;
  return w;
};
const padTo = (s, w) => s + " ".repeat(Math.max(0, w - visibleLen(s)));
const truncTo = (s, w) => {
  if (visibleLen(s) <= w) return s;
  let out = "";
  for (const ch of s) {
    if (visibleLen(out + ch) > w - 1) break;
    out += ch;
  }
  return out + "…";
};

// ---------- HTTP ----------
function apiToken() {
  try {
    return fs.readFileSync(path.join(__dirname, ".token"), "utf8").trim();
  } catch {
    return "";
  }
}

async function api(pathname, body) {
  const res = await fetch(API + pathname, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-Maestro-Token": apiToken() }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && json.error) throw new Error(json.error);
  if (json.ok === false) throw new Error(json.error || "erro desconhecido");
  return json;
}

async function ensureServer() {
  try {
    await fetch(API + "/api/status");
    return;
  } catch {
    console.log(dim("· server não está de pé — iniciando maestro/server.mjs …"));
    const proc = spawn(process.execPath, [path.join(__dirname, "server.mjs")], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    proc.unref();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        await fetch(API + "/api/status");
        console.log(dim(`· server ok em ${API}`));
        return;
      } catch {}
    }
    throw new Error(`não consegui subir o server em ${API} — rode npm run maestro e tente de novo`);
  }
}

async function executeControlAction(actionId, input, appId = null) {
  const snapshot = await api("/api/control/snapshot");
  return api("/api/control/actions/execute", {
    actionId,
    appId,
    input: Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
    stateVersion: snapshot.version,
    idempotencyKey: `forge-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  });
}

function printOperatorResult(operation) {
  const result = operation.result || {};
  const decision = result.proposal?.decision || {};
  console.log(bold(`\nForge Operator · ${result.applied ? "aplicado" : "proposta"}`));
  if (decision.intent) console.log(`  intenção     ${decision.intent}`);
  if (decision.profileDecision) console.log(`  profile      ${decision.profileDecision.action}${decision.profileDecision.profile ? ` → ${decision.profileDecision.profile}` : ""}`);
  if (decision.blueprintDecision) console.log(`  blueprint    ${decision.blueprintDecision.action}${decision.blueprintDecision.source ? ` ← ${decision.blueprintDecision.source}` : ""}`);
  if (Number.isFinite(decision.confidence)) console.log(`  confiança    ${Math.round(decision.confidence * 100)}%`);
  if (result.proposalFile) console.log(`  proposta     ${path.relative(ROOT, result.proposalFile)}`);
  if (result.pipeline?.appId) console.log(`  pipeline     ${result.pipeline.appId}`);
  if (result.run?.pid) console.log(`  executor     pid ${result.run.pid}`);
  if (result.next) console.log(fg(YELLOW, `  próximo      ${result.next}`));
  console.log("");
}

// ---------- args ----------
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      rest.push(a);
      continue;
    }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    // flag booleana = sem valor à frente (fim dos args ou outra flag) — antes, --force virava undefined
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return { flags, rest };
}

// ---------- TUI ----------
// JOB_SHORT: fonte única no engine (a cópia local divergia — faltavam FOUNDATION/DS-GEN)
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

let keysEnabled = false;
function enableKeys() {
  if (keysEnabled) return;
  keysEnabled = true;
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
}

/** desfaz enableKeys() p/ o processo SAIR após um wizard que COMPLETA (vs attachTUI, que fica vivo).
 *  sem isso, stdin fica em raw mode e o terminal trava esperando input. */
function releaseStdin() {
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  } catch {}
  keysEnabled = false;
  process.stdin.pause();
}

function elapsed(fromIso, toIso) {
  if (!fromIso) return "—";
  const ms = (toIso ? new Date(toIso) : new Date()) - new Date(fromIso);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m${String(ss).padStart(2, "0")}s`;
}

function statusBadge(status) {
  if (status === "running") return fg(GREEN, "● running");
  if (status === "paused_gate") return fg(YELLOW, "⏸ aguardando decisão");
  if (status === "blocked") return fg(RED, "🛑 blocked");
  if (status === "done") return fg(CYAN, "✓ done");
  if (status === "killed") return fg(RED, "✗ killed");
  if (status === "error") return fg(RED, "✗ error");
  return dim(status || "idle");
}

export function latestFailureTail(history = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.pass === false && entry.errorTail) {
      return { job: entry.job, lines: entry.errorTail.split(/\r?\n/).filter((line) => line.trim()).slice(-3) };
    }
  }
  return null;
}

export function tuiLogRows(logs = [], history = [], capacity = 0) {
  if (capacity <= 0) return [];
  const failure = latestFailureTail(history);
  if (!failure) return logs.slice(-capacity);
  const lines = failure.lines.slice(-Math.max(0, capacity - 1));
  const logCapacity = capacity - lines.length - 1;
  return [...(logCapacity > 0 ? logs.slice(-logCapacity) : []), `✗ ${JOB_SHORT[failure.job] || failure.job}`, ...lines.map((line) => `  ${line}`)];
}

async function attachTUI(appArg) {
  await ensureServer();
  const state = {
    pipelines: {}, // mapa { appId: snapshot } (multi-pipeline)
    app: null, // qual pipeline este TUI acompanha
    roster: null,
    logs: [],
    tick: 0,
    flash: null,
    input: null, // {buffer} quando digitando feedback
    pendingKill: 0,
    detach: false,
  };
  try {
    state.pipelines = (await api("/api/pipeline")) || {};
  } catch {}
  try {
    state.roster = await api("/api/roster");
  } catch {}

  // escolhe qual pipeline acompanhar: arg explícito > única ativa > única existente > lista e sai
  const ACTIVE_ST = ["running", "paused_gate", "blocked"];
  {
    const ids = Object.keys(state.pipelines).filter((id) => state.pipelines[id]?.appId);
    const act = ids.filter((id) => ACTIVE_ST.includes(state.pipelines[id].status));
    state.app = appArg || (act.length === 1 ? act[0] : ids.length === 1 ? ids[0] : null);
    if (!state.app && ids.length > 1) {
      console.log(bold("pipelines no server:"));
      for (const id of ids) console.log(`  ${id.padEnd(24)} ${statusBadge(state.pipelines[id].status)}`);
      console.log(dim("\nuso: forge attach <app>"));
      return;
    }
  }
  const cur = () => (state.app && state.pipelines[state.app]) || null;

  // SSE
  (async () => {
    for (;;) {
      try {
        const res = await fetch(API + "/api/events");
        let buf = "";
        for await (const chunk of res.body) {
          buf += Buffer.from(chunk).toString("utf8");
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === "run_event") {
                if (!state.app || !ev.appId || ev.appId === state.app) {
                  state.logs.push(ev.line);
                  if (state.logs.length > 300) state.logs.shift();
                }
              } else if (ev.type === "log") {
                // logs de run vêm etiquetados "[stamp] [appId] …" — filtra os de OUTROS apps
                const tag = ev.line.match(/^\[[^\]]+\] \[([a-z0-9-]+)\]/);
                if (!tag || !state.app || tag[1] === state.app) {
                  state.logs.push(ev.line);
                  if (state.logs.length > 300) state.logs.shift();
                }
              } else if (ev.type === "pipeline") {
                state.pipelines = ev.pipeline || {};
                if (!state.app) {
                  const ids = Object.keys(state.pipelines);
                  if (ids.length === 1) state.app = ids[0];
                }
              }
            } catch {}
          }
        }
      } catch {}
      if (state.detach) return;
      await new Promise((r) => setTimeout(r, 1000)); // server caiu — retry
    }
  })();

  // tela
  process.stdout.write(`${ESC}?1049h${ESC}?25l`); // alt screen + hide cursor
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);

  const gate = () => (cur()?.gates || []).find((g) => !g.decision);

  /** kill que funciona SEM gate: mata o executor e encerra o run (tecla [k] com a pipeline rodando) */
  async function killRun() {
    const p = cur();
    if (!p || ["done", "killed"].includes(p.status)) {
      state.flash = "nada para matar (sem run ativo)";
      return;
    }
    try {
      const r = await api("/api/pipeline/kill", { appId: state.app || undefined });
      state.flash = r.ok ? `✗ ${state.app || "run"} morto` : `✗ ${r.error}`;
    } catch (e) {
      state.flash = `✗ ${String(e.message || e).slice(0, 80)}`;
    }
  }

  async function decideKey(choice, feedback) {
    const g = gate();
    if (!g) {
      state.flash = `sem gate pendente — nada a decidir (use [k] 2x para matar o run)`;
      return;
    }
    if (!g.choices.includes(choice)) {
      state.flash = `gate ${g.id} não aceita "${choice}" (opções: ${g.choices.join("/")})`;
      return;
    }
    try {
      await api("/api/pipeline/decide", { appId: state.app || undefined, gateId: g.id, choice, feedback });
      state.flash = `✔ ${g.id} → ${choice}`;
    } catch (e) {
      state.flash = `✗ ${String(e.message || e).slice(0, 80)}`;
    }
  }

  enableKeys();
  process.stdin.on("keypress", async (str, key) => {
    if (state.input) {
      if (key.name === "return") {
        const fb = state.input.buffer;
        state.input = null;
        await decideKey("retry", fb || undefined);
      } else if (key.name === "escape") state.input = null;
      else if (key.name === "backspace") state.input.buffer = state.input.buffer.slice(0, -1);
      else if (str && !key.ctrl) state.input.buffer += str;
      return;
    }
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      state.detach = true;
      clearInterval(timer);
      restore();
      const st = cur()?.status;
      if (st === "running") console.log("· detach — a pipeline continua no server. `forge attach` para voltar.");
      process.exit(0);
    }
    if (key.name === "g") await decideKey("go");
    if (key.name === "r") await decideKey("retry");
    if (["1", "2", "3"].includes(str) && gate()?.choices.includes(str)) await decideKey(str);
    if (key.name === "f" && gate()?.choices.includes("retry")) state.input = { buffer: "" };
    if (key.name === "k") {
      if (Date.now() - state.pendingKill < 3000) {
        state.pendingKill = 0;
        const g = gate();
        // com gate que aceita kill → decide o gate; sem gate (run rodando) → kill direto
        if (g && g.choices.includes("kill")) await decideKey("kill");
        else await killRun();
      } else {
        state.pendingKill = Date.now();
        state.flash = "k de novo em 3s para confirmar KILL";
      }
    }
  });

  function render() {
    state.tick++;
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 110));
    const rows = Math.max(18, process.stdout.rows || 30);
    const W = cols - 2;
    const p = cur();
    const out = [];
    const hr = (label) =>
      fg(PURPLE, `├─ ${label} ` + "─".repeat(Math.max(0, W - visibleLen(label) - 4)) + "┤");
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");

    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🎼 MAESTRO · FORGE")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 22)) + "┐"));

    if (!p || p.status === "idle" || !p.appId) {
      out.push(row(dim("sem pipeline ativa — forge new \"<ideia>\" --team grok-solo")));
    } else {
      out.push(
        row(
          `${bold(p.appId)} ${dim("·")} team ${fg(CYAN, p.team)}${p.profileName ? ` ${dim("·")} profile ${fg(CYAN, p.profileName)}` : ""} ${dim("·")} ${statusBadge(p.status)}${p.dryRun ? dim(" · DRY-RUN") : ""}`
        )
      );
      out.push(
        row(
          `ideia: ${dim(truncTo(p.idea || "", W - 30))}  ${dim("·")}  ⏱ ${elapsed(p.startedAt, p.endedAt)}`
        )
      );

      // pipeline progress
      out.push(hr("pipeline"));
      const parts = p.jobs.map((j, i) => {
        const short = JOB_SHORT[j] || j;
        if (i < p.jobIndex) return fg(GREEN, `${short} ✓`);
        if (i === p.jobIndex && p.status === "running")
          return bold(fg(CYAN, `${short} ${SPIN[state.tick % SPIN.length]}`));
        if (i === p.jobIndex && (p.status === "paused_gate" || p.status === "blocked"))
          return fg(YELLOW, `${short} ⏸`);
        return dim(`${short} ·`);
      });
      out.push(row(parts.join(dim("  "))));

      // players
      out.push(hr("players"));
      const roster = state.roster;
      const team = roster?.teams?.[p.team];
      if (roster && team) {
        const ids = [...new Set([...Object.values(team.dispatch || {}), ...Object.values(team.fallbacks || {}).flat()])];
        for (const id of ids) {
          const pl = roster.players.find((x) => x.id === id);
          if (!pl) continue;
          const done = [...new Set(p.history.filter((h) => h.pass && h.playerId === id).map((h) => JOB_SHORT[h.job] || h.job))];
          const active = p.currentPlayer === id && p.status === "running";
          const cd = p.cooldowns?.[id] && new Date(p.cooldowns[id]) > new Date();
          const stateTxt = active
            ? bold(fg(CYAN, `▶ ${JOB_SHORT[p.currentJob] || p.currentJob || ""}`))
            : cd
              ? fg(RED, "⏳ cooldown")
              : dim("idle");
          const mtag = pl.modelLabel ? dim(pl.modelLabel + (pl.effort ? " · " + String(pl.effort).toUpperCase() : "")) : "";
          out.push(row(`${pl.face || "·"} ${fg(pl.color, padTo(pl.name, 15))} ${padTo(mtag, 22)} ${padTo(stateTxt, 13)} ${done.length ? fg(GREEN, "✓ " + done.join(" ")) : ""}`));
        }
      } else {
        out.push(row(dim("roster indisponível")));
      }

      // gate
      const g = gate();
      if (g) {
        out.push(hr("gate"));
        out.push(row(bold(fg(YELLOW, `⏸ ${g.id}`)) + "  " + truncTo(g.prompt || "", W - 16)));
        out.push(row(fg(CYAN, `🔍 revise no navegador: ${API}`) + dim("  · doc/preview renderizado + botões")));
        if (state.input) {
          out.push(row(fg(CYAN, `feedback: ${state.input.buffer}▌`) + dim("  (Enter envia · Esc cancela)")));
        } else {
          const opts = [];
          for (const n of ["1", "2", "3"]) if (g.choices.includes(n)) opts.push(`${bold("[" + n + "]")} escolher ${n}`);
          if (g.choices.includes("go")) opts.push(`${bold("[g]")} go`);
          if (g.choices.includes("retry")) opts.push(`${bold("[r]")} retry`, `${bold("[f]")} retry+feedback`);
          if (g.choices.includes("kill")) opts.push(`${bold("[k]")} kill (2x)`);
          out.push(row(opts.join(dim("  ·  "))));
        }
      }
      if (p.deploy?.url) out.push(row(`🌐 ${fg(CYAN, p.deploy.url)}`));
    }

    // log — preenche o que sobrar
    out.push(hr("log"));
    const used = out.length;
    const footerRows = 1;
    const logRows = Math.max(0, rows - used - footerRows - 1);
    for (const line of tuiLogRows(state.logs, p?.history, logRows)) out.push(row(line.startsWith("✗ ") ? fg(RED, line) : dim(line)));

    const foot = state.flash
      ? fg(YELLOW, ` ${state.flash} `)
      : dim(" q detach · gates: g/k/r/f · " + API + " ");
    out.push(fg(PURPLE, "└" + "─".repeat(Math.max(0, W)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out.slice(0, rows - 1)) frame += line + `${ESC}K\n`;
    frame += foot + `${ESC}K${ESC}J`;
    process.stdout.write(frame);
  }

  const timer = setInterval(() => {
    if (state.flash && state.tick % 30 === 0) state.flash = null;
    render();
  }, 150);
  render();
}

// ---------- setup wizard (forge sem args — onboarding unificado: profile → ideia → nome → time → tipo) ----------

// dados de profile compartilhados (passo inline do onboarding + forge profile init)
const PROFILE_I18N_OPTS = [
  ["single", "só pt-BR", ["pt-BR"]],
  ["bilingual", "pt-BR + inglês (toggle no app)", ["pt-BR", "en"]],
];
const PROFILE_FIELDS = [
  { key: "name", title: "Nome do projeto", ex: "Anime Forge · Fitplan · FinTrack", min: 2, max: 60 },
  { key: "niche", title: "Nicho / vertical", ex: "anime · fitness · finanças pessoais", min: 2, max: 40 },
  { key: "namespace", title: "Namespace dos apps (npm workspaces)", ex: "@forge  → apps viram @forge/<app>", min: 2, max: 40 },
  { key: "baseUrl", title: "Domínio de deploy", ex: "gbbragadev.com  → <app>.gbbragadev.com", min: 3, max: 60 },
];

/** Grava um profile novo na biblioteca (profiles/<slug>/profile.md) e o ativa. */
function saveProfileToLibrary(data) {
  const slug = slugify(data.name) || "default";
  const dir = path.join(ROOT, "profiles", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "profile.md"), buildProfileMd(data), "utf8");
  activateProfile(ROOT, slug);
  return slug;
}

async function wizard() {
  await ensureServer();
  let roster = null;
  try {
    roster = await api("/api/roster");
  } catch {}
  const teams = Object.entries(roster?.teams || {});
  if (!teams.length) throw new Error("roster sem teams — confira maestro/roster.json");
  // tipo do app (static|quiz|chat) NÃO é passo do wizard: o P0 decide pela ideia e o gate p0-go confirma

  importActiveProfile(ROOT); // migra .forge/profile.md órfão pra biblioteca (idempotente)
  let profiles = listProfiles(ROOT);

  const freshTm = () => ({
    teamName: "", musicians: [], provIdx: 0, modelIdx: 0, effortIdx: 0,
    roleSel: TEAM_ROLES.map(() => false), roleCursor: 0, moreIdx: 0,
  });
  const st = {
    phase: "profile",
    profIdx: Math.max(0, profiles.findIndex((p) => p.active)),
    pf: { step: 0, name: "", niche: "", namespace: "@forge", baseUrl: "gbbragadev.com", context: "", i18nIdx: 0 },
    idea: "",
    ideaFile: null, // caminho digitado no passo ideia que apontou pra um arquivo
    ideaText: null, // conteúdo lido do arquivo (vira a ideia completa do run)
    appName: "",
    nameEdited: false,
    teamIdx: 0,
    tm: freshTm(),
    dry: false,
    err: "",
  };
  const activeProfile = () => profiles.find((p) => p.active) || null;
  const curProv = () => PROVIDERS[st.tm.provIdx];

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  const stepNames = ["profile", "ideia", "nome", "time", "confirmar"];
  const stepOf = {
    profile: 0, "pf-field": 0, "pf-context": 0, "pf-i18n": 0,
    idea: 1, name: 2,
    team: 3, "tm-name": 3, "tm-provider": 3, "tm-model": 3, "tm-effort": 3, "tm-roles": 3, "tm-more": 3, "tm-confirm": 3,
    confirm: 4,
  };

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    const ap = activeProfile();
    const title = `🎼 MAESTRO · NOVO APP · Profile: ${ap ? ap.name : "(nenhum)"}`;
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, title)) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(title) - 5)) + "┐"));
    const cur = stepOf[st.phase] ?? 0;
    out.push(row(stepNames.map((n, i) => (i === cur ? bold(fg(CYAN, `● ${n}`)) : i < cur ? fg(GREEN, `✓ ${n}`) : dim(`○ ${n}`))).join(dim(" ─ "))));
    out.push(blank());

    if (st.phase === "profile") {
      out.push(row(bold("Qual profile (vertical) rege este app?")));
      out.push(blank());
      profiles.forEach((pr, i) => {
        const sel = i === st.profIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(pr.name) : pr.name}  ${dim(`nicho: ${pr.niche} · ${pr.slug}`)}${pr.active ? fg(GREEN, "  ● ativo") : ""}`));
      });
      const selNew = st.profIdx === profiles.length;
      out.push(row(`${selNew ? bold(fg(CYAN, "▸ ")) : "  "}${selNew ? bold("➕ criar novo profile") : "➕ criar novo profile"}`));
      if (!profiles.length) {
        out.push(blank());
        out.push(row(dim("  biblioteca vazia (profiles/) — crie o primeiro profile")));
      }
    } else if (st.phase === "pf-field") {
      const f = PROFILE_FIELDS[st.pf.step];
      out.push(row(bold(`Novo profile · ${f.title}?`)));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.pf[f.key]}▌`)));
      out.push(blank());
      out.push(row(dim(`  ex.: ${f.ex}`)));
    } else if (st.phase === "pf-context") {
      out.push(row(bold("Novo profile · contexto & temas")));
      out.push(blank());
      out.push(row(dim("  descreva o projeto: temas, público, tom — vira fonte da verdade nos prompts")));
      out.push(blank());
      const words = st.pf.context.split(" ");
      let line = "  ";
      const lines = [];
      for (const w of words) {
        if (visibleLen(line + w) > W - 6) { lines.push(line); line = "  "; }
        line += w + " ";
      }
      lines.push(line + "▌");
      for (const l of lines.slice(-6)) out.push(row(fg(CYAN, l)));
      out.push(blank());
      out.push(row(dim(`  ${st.pf.context.length}/800 · Enter = continuar`)));
    } else if (st.phase === "pf-i18n") {
      out.push(row(bold("Novo profile · idiomas do conteúdo user-facing?")));
      out.push(blank());
      PROFILE_I18N_OPTS.forEach(([id, label], i) => {
        const sel = i === st.pf.i18nIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(id) : id}  ${dim(label)}`));
      });
    } else if (st.phase === "idea") {
      out.push(row(bold("Qual é a ideia do app?")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.idea}▌`)));
      out.push(blank());
      out.push(row(dim("  ex.: quiz de openings de anime · gerador de photocard · fanfic interativa")));
      out.push(blank());
      out.push(row(dim("  ideia grande? cole um caminho .md/.txt (ex.: ideas/minha-ideia.md) — eu leio o arquivo")));
      const t = st.idea.trim();
      if (/\.(md|txt)$/i.test(t)) {
        const cand = path.isAbsolute(t) ? t : path.join(ROOT, t);
        out.push(row(fs.existsSync(cand)
          ? fg(GREEN, "  ↳ arquivo encontrado — Enter usa o conteúdo como ideia")
          : fg(YELLOW, "  ↳ arquivo não encontrado (caminho relativo à raiz do forge)")));
      }
    } else if (st.phase === "name") {
      out.push(row(bold("Nome do app? (default veio da ideia — edite à vontade)")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.appName}▌`)));
      out.push(blank());
      out.push(row(dim(`  vira: apps/${slugify(st.appName) || "?"} · branch pipeline/${slugify(st.appName) || "?"}`)));
    } else if (st.phase === "team") {
      out.push(row(bold("Quem toca? (preset do roster ou monte um time)")));
      out.push(blank());
      teams.forEach(([id, t], i) => {
        const sel = i === st.teamIdx;
        const disp = Object.entries(t.dispatch || {}).map(([k, v]) => `${k}→${v}`).join("  ");
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${t.emoji || "·"} ${sel ? bold(id) : id}  ${dim(t.label || "")}`));
        if (sel) out.push(row(dim(`      ${disp}`)));
      });
      const selNew = st.teamIdx === teams.length;
      out.push(row(`${selNew ? bold(fg(CYAN, "▸ ")) : "  "}${selNew ? bold("➕ montar time custom") : "➕ montar time custom"}`));
    } else if (st.phase === "tm-name") {
      out.push(row(bold("Time custom · nome?")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.tm.teamName}▌`)));
      out.push(blank());
      out.push(row(dim("  ex.: Sol solo · Grok+GLM · Opus backend + Sonnet front")));
    } else if (st.phase === "tm-provider") {
      out.push(row(bold(`Músico ${st.tm.musicians.length + 1} · provedor?`)));
      out.push(blank());
      PROVIDERS.forEach((p, i) => {
        const sel = i === st.tm.provIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${p.face} ${sel ? bold(p.id) : p.id}  ${dim(`${p.cli}${p.env ? "/" + p.env : ""} · effort ${p.real ? "real" : "etiqueta"}`)}`));
      });
    } else if (st.phase === "tm-model") {
      const p = curProv();
      out.push(row(bold(`${p.face} ${p.id} · modelo?`)));
      out.push(blank());
      p.models.forEach((m, i) => {
        const sel = i === st.tm.modelIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(m.label) : m.label}  ${dim(m.id)}`));
      });
    } else if (st.phase === "tm-effort") {
      const p = curProv();
      out.push(row(bold(`${p.face} ${p.models[st.tm.modelIdx].label} · effort?`)));
      out.push(blank());
      effortsOf(p, st.tm.modelIdx).forEach((e, i) => {
        const sel = i === st.tm.effortIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(e.toUpperCase()) : e.toUpperCase()}`));
      });
      out.push(blank());
      out.push(row(dim(p.real ? "  effort REAL neste provedor (muda o raciocínio)" : "  etiqueta: este CLI não expõe effort — informativo")));
    } else if (st.phase === "tm-roles") {
      out.push(row(bold(`${curProv().models[st.tm.modelIdx].label} · funções? (espaço marca · a = todas)`)));
      out.push(blank());
      TEAM_ROLES.forEach((r, i) => {
        const on = st.tm.roleSel[i];
        const cursor = i === st.tm.roleCursor;
        out.push(row(`${cursor ? bold(fg(CYAN, "▸ ")) : "  "}${on ? fg(GREEN, "[x]") : "[ ]"} ${cursor ? bold(r.id) : r.id}  ${dim(r.desc)}`));
      });
    } else if (st.phase === "tm-more") {
      out.push(row(bold("Time montado até aqui:")));
      out.push(blank());
      st.tm.musicians.forEach((m) => out.push(row(`  ${m.face} ${fg(CYAN, m.modelLabel)} ${m.effort.toUpperCase()} ${dim("→ " + m.roles.join(" · "))}`)));
      out.push(blank());
      [["+ adicionar outro músico"], ["finalizar e gravar"]].forEach(([label], i) => {
        const sel = i === st.tm.moreIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(label) : label}`));
      });
    } else if (st.phase === "tm-confirm") {
      const { team, players } = composeTeam(st.tm.teamName.trim() || "time", st.tm.musicians);
      const covered = new Set(Object.keys(team.dispatch).filter((k) => k !== "default"));
      const coreRoles = ["Estrategista", "Engenheiro", "Designer", "QA"];
      const missing = coreRoles.filter((r) => !st.tm.musicians.some((m) => m.roles.includes(r)));
      out.push(row(bold(`Gravar time "${st.tm.teamName.trim()}" (${players.length} músico(s))`)));
      out.push(blank());
      st.tm.musicians.forEach((m) => out.push(row(`  ${m.face} ${fg(CYAN, m.modelLabel)} ${m.effort.toUpperCase()} ${dim("→ " + m.roles.join("/"))}`)));
      out.push(blank());
      out.push(row(dim(`  cobre ${covered.size} jobs · default = ${team.dispatch.default || "—"}`)));
      if (missing.length) out.push(row(fg(YELLOW, `  ⚠ sem papel: ${missing.join(", ")} → cai no default nesses jobs`)));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = gravar e usar este time ▶"))));
    } else {
      const [teamId, team] = teams[st.teamIdx];
      out.push(row(bold("Partitura pronta:")));
      out.push(blank());
      out.push(row(`  profile ${fg(CYAN, ap ? ap.name : "?")} ${dim(ap ? `(nicho: ${ap.niche})` : "")}`));
      out.push(row(`  ideia   ${fg(CYAN, truncTo(st.ideaFile ? `📄 ${st.ideaFile} (${st.ideaText.length} chars)` : st.idea, W - 14))}`));
      out.push(row(`  app     ${fg(CYAN, slugify(st.appName))}`));
      out.push(row(`  time    ${team.emoji || "·"} ${fg(CYAN, teamId)} ${dim(team.label || "")}`));
      out.push(row(`  tipo    ${dim("auto — o P0 decide (static|quiz|chat) e você confirma no gate")}`));
      out.push(row(`  dry-run ${st.dry ? fg(YELLOW, "SIM (não gasta limite)") : dim("não")}   ${dim("← tecla [d] alterna")}`));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = começar o arco ▶"))));
    }

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    const typing = ["pf-field", "pf-context", "idea", "name", "tm-name"].includes(st.phase);
    const hints =
      st.phase === "confirm"
        ? "Enter inicia · d dry-run · ← volta · Esc sai"
        : st.phase === "tm-roles"
          ? "↑↓ move · espaço marca · a todas · Enter confirma · ← volta · Esc sai"
          : typing
            ? "Enter continua · ← volta · Esc sai"
            : "↑↓ escolhe · Enter continua · ← volta · Esc sai";
    out.push(fg(PURPLE, "└─ ") + dim(hints) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(hints) - 5)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const payload = await new Promise((resolve) => {
    const bootAt = Date.now();
    const commitMusician = () => {
      const p = curProv();
      st.tm.musicians.push({
        provider: p.id, cli: p.cli, env: p.env, model: p.models[st.tm.modelIdx].id,
        modelLabel: p.models[st.tm.modelIdx].label, effort: effortsOf(p, st.tm.modelIdx)[st.tm.effortIdx],
        roles: TEAM_ROLES.filter((_, i) => st.tm.roleSel[i]).map((r) => r.id),
        face: p.face, color: p.color,
      });
      st.tm.provIdx = 0; st.tm.modelIdx = 0; st.tm.effortIdx = 0;
      st.tm.roleSel = TEAM_ROLES.map(() => false); st.tm.roleCursor = 0;
    };
    const onKey = (str, key) => {
      // terminais Windows soltam ESC fantasma ao entrar em raw mode — engole o boot
      if (Date.now() - bootAt < 350) return;
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);

      if (st.phase === "profile") {
        const n = profiles.length + 1;
        if (key.name === "up") st.profIdx = (st.profIdx + n - 1) % n;
        else if (key.name === "down") st.profIdx = (st.profIdx + 1) % n;
        else if (key.name === "return") {
          if (st.profIdx === profiles.length) {
            st.pf = { step: 0, name: "", niche: "", namespace: "@forge", baseUrl: "gbbragadev.com", context: "", i18nIdx: 0 };
            st.phase = "pf-field";
          } else {
            activateProfile(ROOT, profiles[st.profIdx].slug);
            profiles = listProfiles(ROOT);
            st.phase = "idea";
          }
        }
      } else if (st.phase === "pf-field") {
        const f = PROFILE_FIELDS[st.pf.step];
        if (key.name === "return") {
          if (String(st.pf[f.key]).trim().length >= f.min) {
            if (st.pf.step < PROFILE_FIELDS.length - 1) st.pf.step++;
            else st.phase = "pf-context";
          } else st.err = `mínimo ${f.min} caracteres`;
        } else if (key.name === "backspace") st.pf[f.key] = st.pf[f.key].slice(0, -1);
        else if (key.name === "left") {
          if (st.pf.step > 0) st.pf.step--;
          else st.phase = "profile";
        } else if (str && !key.ctrl && str >= " " && st.pf[f.key].length < f.max) st.pf[f.key] += str;
      } else if (st.phase === "pf-context") {
        if (key.name === "return") st.phase = "pf-i18n";
        else if (key.name === "backspace") st.pf.context = st.pf.context.slice(0, -1);
        else if (key.name === "left" && !st.pf.context) st.phase = "pf-field";
        else if (str && !key.ctrl && str >= " " && st.pf.context.length < 800) st.pf.context += str;
      } else if (st.phase === "pf-i18n") {
        const n = PROFILE_I18N_OPTS.length;
        if (key.name === "up") st.pf.i18nIdx = (st.pf.i18nIdx + n - 1) % n;
        else if (key.name === "down") st.pf.i18nIdx = (st.pf.i18nIdx + 1) % n;
        else if (key.name === "left") st.phase = "pf-context";
        else if (key.name === "return") {
          const [rule, , locales] = PROFILE_I18N_OPTS[st.pf.i18nIdx];
          saveProfileToLibrary({
            name: st.pf.name.trim(), niche: st.pf.niche.trim(), namespace: st.pf.namespace.trim(),
            baseUrl: st.pf.baseUrl.trim(), i18nRule: rule, locales, context: st.pf.context.trim(),
          });
          profiles = listProfiles(ROOT);
          st.profIdx = Math.max(0, profiles.findIndex((p) => p.active));
          st.phase = "idea";
        }
      } else if (st.phase === "idea") {
        if (key.name === "return") {
          const t = st.idea.trim();
          const cand = /\.(md|txt)$/i.test(t) ? (path.isAbsolute(t) ? t : path.join(ROOT, t)) : null;
          if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
            // caminho de arquivo → lê o prompt dele (equivalente inline do forge new --idea-file)
            const txt = fs.readFileSync(cand, "utf8").trim();
            if (!txt) st.err = "arquivo de ideia vazio";
            else {
              st.ideaFile = t;
              st.ideaText = txt;
              // nome default vem do NOME do arquivo (slugify do conteúdo em prosa gerava lixo tipo "o-anima-deck")
              if (!st.nameEdited) st.appName = slugify(path.basename(cand).replace(/\.[^.]+$/, ""));
              st.phase = "name";
            }
          } else if (t.length >= 6) {
            st.ideaFile = null;
            st.ideaText = null;
            if (!st.nameEdited) st.appName = slugify(t);
            st.phase = "name";
          } else st.err = "escreve a ideia (mínimo 6 caracteres) ou cole um caminho .md/.txt";
        } else if (key.name === "backspace") st.idea = st.idea.slice(0, -1);
        else if (key.name === "left" && !st.idea) st.phase = "profile";
        else if (str && !key.ctrl && str >= " " && st.idea.length < 600) st.idea += str;
      } else if (st.phase === "name") {
        if (key.name === "return") {
          if (slugify(st.appName)) st.phase = "team";
          else st.err = "nome vazio — o app precisa de um slug";
        } else if (key.name === "backspace") { st.appName = st.appName.slice(0, -1); st.nameEdited = true; }
        else if (key.name === "left") st.phase = "idea";
        else if (str && !key.ctrl && str >= " " && st.appName.length < 60) { st.appName += str; st.nameEdited = true; }
      } else if (st.phase === "team") {
        const n = teams.length + 1;
        if (key.name === "up") st.teamIdx = (st.teamIdx + n - 1) % n;
        else if (key.name === "down") st.teamIdx = (st.teamIdx + 1) % n;
        else if (key.name === "return") {
          if (st.teamIdx === teams.length) { st.tm = freshTm(); st.phase = "tm-name"; }
          else st.phase = "confirm";
        } else if (key.name === "left") st.phase = "name";
      } else if (st.phase === "tm-name") {
        if (key.name === "return") {
          if (st.tm.teamName.trim().length >= 2) st.phase = "tm-provider";
          else st.err = "mínimo 2 caracteres";
        } else if (key.name === "backspace") st.tm.teamName = st.tm.teamName.slice(0, -1);
        else if (key.name === "left") st.phase = "team";
        else if (str && !key.ctrl && str >= " " && st.tm.teamName.length < 40) st.tm.teamName += str;
      } else if (st.phase === "tm-provider") {
        const n = PROVIDERS.length;
        if (key.name === "up") st.tm.provIdx = (st.tm.provIdx + n - 1) % n;
        else if (key.name === "down") st.tm.provIdx = (st.tm.provIdx + 1) % n;
        else if (key.name === "return") { st.tm.modelIdx = 0; st.tm.effortIdx = 0; st.phase = "tm-model"; }
        else if (key.name === "left") st.phase = st.tm.musicians.length ? "tm-more" : "tm-name";
      } else if (st.phase === "tm-model") {
        const n = curProv().models.length;
        if (key.name === "up") st.tm.modelIdx = (st.tm.modelIdx + n - 1) % n;
        else if (key.name === "down") st.tm.modelIdx = (st.tm.modelIdx + 1) % n;
        else if (key.name === "return") { st.tm.effortIdx = 0; st.phase = "tm-effort"; }
        else if (key.name === "left") st.phase = "tm-provider";
      } else if (st.phase === "tm-effort") {
        const n = effortsOf(curProv(), st.tm.modelIdx).length;
        if (key.name === "up") st.tm.effortIdx = (st.tm.effortIdx + n - 1) % n;
        else if (key.name === "down") st.tm.effortIdx = (st.tm.effortIdx + 1) % n;
        else if (key.name === "return") st.phase = "tm-roles";
        else if (key.name === "left") st.phase = "tm-model";
      } else if (st.phase === "tm-roles") {
        const n = TEAM_ROLES.length;
        if (key.name === "up") st.tm.roleCursor = (st.tm.roleCursor + n - 1) % n;
        else if (key.name === "down") st.tm.roleCursor = (st.tm.roleCursor + 1) % n;
        else if (str === " ") st.tm.roleSel[st.tm.roleCursor] = !st.tm.roleSel[st.tm.roleCursor];
        else if (str === "a") st.tm.roleSel = TEAM_ROLES.map(() => true);
        else if (key.name === "return") {
          if (st.tm.roleSel.some(Boolean)) { commitMusician(); st.tm.moreIdx = 0; st.phase = "tm-more"; }
          else st.err = "marque ao menos 1 função (espaço) ou 'a' pra todas";
        } else if (key.name === "left") st.phase = "tm-effort";
      } else if (st.phase === "tm-more") {
        if (key.name === "up" || key.name === "down") st.tm.moreIdx = st.tm.moreIdx ? 0 : 1;
        else if (key.name === "return") st.phase = st.tm.moreIdx === 0 ? "tm-provider" : "tm-confirm";
        else if (key.name === "left") st.phase = "tm-provider";
      } else if (st.phase === "tm-confirm") {
        if (key.name === "return") {
          const { teamId, team, players } = composeTeam(st.tm.teamName.trim() || "time", st.tm.musicians, st.tm.musicians[0]?.face || "🎼");
          writeTeamToRoster(teamId, team, players);
          teams.push([teamId, team]);
          st.teamIdx = teams.length - 1;
          st.phase = "confirm";
        } else if (key.name === "left") { st.tm.moreIdx = 1; st.phase = "tm-more"; }
      } else {
        if (key.name === "return")
          return finish({ idea: (st.ideaText || st.idea).trim(), team: teams[st.teamIdx][0], dryRun: st.dry, appId: slugify(st.appName) });
        if (key.name === "left") st.phase = "team";
        if (str === "d") st.dry = !st.dry;
      }
      render();
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(v);
    };
    process.stdin.on("keypress", onKey);
    render();
  });

  restore();
  if (!payload) {
    console.log(dim("setup cancelado"));
    process.exit(0);
  }
  const r = await api("/api/pipeline/start", { ...payload, controlMode: "full_auto" });
  console.log(fg(GREEN, `✓ pipeline iniciada: ${r.pipeline.appId} · team ${r.pipeline.team} · profile ${r.pipeline.profileName || "?"}`));
  await attachTUI(r.pipeline.appId);
}

// ---------- feedback wizard (forge feedback sem args — app → feedback → time) ----------
async function feedbackWizard() {
  await ensureServer();
  let roster = null;
  let pipes = {};
  try {
    roster = await api("/api/roster");
  } catch {}
  try {
    pipes = (await api("/api/pipeline")) || {};
  } catch {}
  const teams = Object.entries(roster?.teams || {});
  if (!teams.length) throw new Error("roster sem teams — confira maestro/roster.json");

  // apps disponíveis = diretórios em apps/ (o feedback itera sobre app existente)
  const appsDir = path.join(ROOT, "apps");
  const apps = (fs.existsSync(appsDir) ? fs.readdirSync(appsDir) : [])
    .filter((d) => fs.statSync(path.join(appsDir, d)).isDirectory())
    .map((id) => ({ id, status: pipes[id]?.status || "—", url: pipes[id]?.deploy?.url || null }));
  if (!apps.length) throw new Error("nenhum app em apps/ — rode `forge` para criar o primeiro");

  const ACTIVE_ST = ["running", "paused_gate", "blocked"];
  const st = { phase: "app", appIdx: 0, text: "", teamIdx: 0, dry: false, err: "" };

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  const stepNames = ["app", "feedback", "time", "confirmar"];
  const stepOf = { app: 0, text: 1, team: 2, confirm: 3 };

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🔁 FORGE · FEEDBACK (iterar app pronto)")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 42)) + "┐"));
    out.push(row(stepNames.map((n, i) => (i === stepOf[st.phase] ? bold(fg(CYAN, `● ${n}`)) : i < stepOf[st.phase] ? fg(GREEN, `✓ ${n}`) : dim(`○ ${n}`))).join(dim(" ─ "))));
    out.push(blank());

    if (st.phase === "app") {
      out.push(row(bold("Qual app quer melhorar?")));
      out.push(blank());
      apps.forEach((a, i) => {
        const sel = i === st.appIdx;
        const busy = ACTIVE_ST.includes(a.status);
        const tag = busy ? fg(YELLOW, `  ⚠ run ativo (${a.status})`) : a.url ? fg(GREEN, "  🌐 no ar") : "";
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(a.id) : a.id}${tag}`));
      });
      out.push(blank());
      out.push(row(dim("  o feedback aplica ITERATE → gate visual → ship-check → redeploy")));
    } else if (st.phase === "text") {
      out.push(row(bold(`O que melhorar em ${apps[st.appIdx].id}?`)));
      out.push(blank());
      const words = st.text.split(" ");
      let line = "  ";
      const lines = [];
      for (const w of words) {
        if (visibleLen(line + w) > W - 6) { lines.push(line); line = "  "; }
        line += w + " ";
      }
      lines.push(line + "▌");
      for (const l of lines.slice(-8)) out.push(row(fg(CYAN, l)));
      out.push(blank());
      out.push(row(dim(`  ${st.text.length}/800 · ex.: melhorar design dos personagens, facilitar criar/compartilhar cartas`)));
    } else if (st.phase === "team") {
      out.push(row(bold("Quem toca esta iteração?")));
      out.push(blank());
      teams.forEach(([id, t], i) => {
        const sel = i === st.teamIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${t.emoji || "·"} ${sel ? bold(id) : id}  ${dim(t.label || "")}`));
        if (sel) out.push(row(dim(`      ${Object.entries(t.dispatch || {}).map(([k, v]) => `${k}→${v}`).join("  ")}`)));
      });
    } else {
      const a = apps[st.appIdx];
      const [teamId, team] = teams[st.teamIdx];
      out.push(row(bold("Iteração pronta:")));
      out.push(blank());
      out.push(row(`  app       ${fg(CYAN, a.id)}${a.url ? dim("  " + a.url) : ""}`));
      out.push(row(`  feedback  ${fg(CYAN, truncTo(st.text, W - 16))}`));
      out.push(row(`  time      ${team.emoji || "·"} ${fg(CYAN, teamId)} ${dim(team.label || "")}`));
      out.push(row(`  dry-run   ${st.dry ? fg(YELLOW, "SIM (não gasta limite)") : dim("não")}   ${dim("← tecla [d] alterna")}`));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = iterar ▶"))));
    }

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    const hints = st.phase === "text" ? "Enter continua · ← volta · Esc sai" : st.phase === "confirm" ? "Enter inicia · d dry-run · ← volta · Esc sai" : "↑↓ escolhe · Enter continua · ← volta · Esc sai";
    out.push(fg(PURPLE, "└─ ") + dim(hints) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(hints) - 5)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const payload = await new Promise((resolve) => {
    const bootAt = Date.now();
    const onKey = (str, key) => {
      if (Date.now() - bootAt < 350) return;
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);

      if (st.phase === "app") {
        const n = apps.length;
        if (key.name === "up") st.appIdx = (st.appIdx + n - 1) % n;
        else if (key.name === "down") st.appIdx = (st.appIdx + 1) % n;
        else if (key.name === "return") {
          const a = apps[st.appIdx];
          if (ACTIVE_ST.includes(a.status)) st.err = `${a.id} tem run ativo (${a.status}) — decida/pare esse run antes de iterar`;
          else st.phase = "text";
        }
      } else if (st.phase === "text") {
        if (key.name === "return") {
          if (st.text.trim().length >= 8) st.phase = "team";
          else st.err = "descreva o que melhorar (mínimo 8 caracteres)";
        } else if (key.name === "backspace") st.text = st.text.slice(0, -1);
        else if (key.name === "left" && !st.text) st.phase = "app";
        else if (str && !key.ctrl && str >= " " && st.text.length < 800) st.text += str;
      } else if (st.phase === "team") {
        const n = teams.length;
        if (key.name === "up") st.teamIdx = (st.teamIdx + n - 1) % n;
        else if (key.name === "down") st.teamIdx = (st.teamIdx + 1) % n;
        else if (key.name === "return") st.phase = "confirm";
        else if (key.name === "left") st.phase = "text";
      } else {
        if (key.name === "return")
          return finish({ appId: apps[st.appIdx].id, feedbackText: st.text.trim(), team: teams[st.teamIdx][0], dryRun: st.dry });
        if (key.name === "left") st.phase = "team";
        if (str === "d") st.dry = !st.dry;
      }
      render();
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(v);
    };
    process.stdin.on("keypress", onKey);
    render();
  });

  restore();
  if (!payload) {
    console.log(dim("feedback cancelado"));
    process.exit(0);
  }
  const r = await api("/api/pipeline/feedback", { ...payload, controlMode: "full_auto" });
  console.log(fg(GREEN, `🔁 iteração iniciada: ${r.pipeline.appId} (fb${r.pipeline.iterationNum}) · team ${r.pipeline.team}`));
  await attachTUI(r.pipeline.appId);
}

// ---------- profile init wizard (forge profile init — autora .forge/profile.md) ----------
async function profileWizard() {
  const profilePath = path.join(ROOT, ".forge", "profile.md");
  let existingName = null;
  try {
    const m = fs.readFileSync(profilePath, "utf8").match(/"name"\s*:\s*"([^"]+)"/);
    existingName = m ? m[1] : "(sem nome)";
  } catch {}

  const i18nOpts = PROFILE_I18N_OPTS;
  const fields = PROFILE_FIELDS;
  const CONTEXT_STEP = fields.length; // textarea
  const I18N_STEP = fields.length + 1;
  const CONFIRM_STEP = fields.length + 2;
  const stepNames = ["nome", "nicho", "namespace", "domínio", "contexto", "idiomas", "gravar"];

  const st = { step: 0, name: "", niche: "", namespace: "@forge", baseUrl: "gbbragadev.com", context: "", i18nIdx: 0, err: "" };

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🎼 FORGE · PROFILE INIT")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 27)) + "┐"));
    out.push(row(stepNames.map((n, i) => (i === st.step ? bold(fg(CYAN, `● ${n}`)) : i < st.step ? fg(GREEN, `✓ ${n}`) : dim(`○ ${n}`))).join(dim(" ─ "))));
    out.push(blank());

    if (st.step < CONTEXT_STEP) {
      const f = fields[st.step];
      out.push(row(bold(f.title + "?")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st[f.key]}▌`)));
      out.push(blank());
      out.push(row(dim(`  ex.: ${f.ex}`)));
    } else if (st.step === CONTEXT_STEP) {
      out.push(row(bold("Contexto & temas principais")));
      out.push(blank());
      out.push(row(dim("  descreva o projeto: temas, público, tom — vira fonte da verdade nos prompts")));
      out.push(blank());
      // textarea: quebra em linhas de ~W-4
      const words = st.context.split(" ");
      let line = "  ";
      const lines = [];
      for (const w of words) {
        if (visibleLen(line + w) > W - 6) { lines.push(line); line = "  "; }
        line += w + " ";
      }
      lines.push(line + "▌");
      for (const l of lines.slice(-6)) out.push(row(fg(CYAN, l)));
      out.push(blank());
      out.push(row(dim(`  ${st.context.length}/800 · Enter = continuar · Shift+Enter não precisa`)));
    } else if (st.step === I18N_STEP) {
      out.push(row(bold("Idiomas do conteúdo user-facing?")));
      out.push(blank());
      i18nOpts.forEach(([id, label], i) => {
        const sel = i === st.i18nIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(id) : id}  ${dim(label)}`));
      });
    } else {
      out.push(row(bold("Profile pronto:")));
      out.push(blank());
      out.push(row(`  nome       ${fg(CYAN, st.name)}`));
      out.push(row(`  nicho      ${fg(CYAN, st.niche)}`));
      out.push(row(`  namespace  ${fg(CYAN, st.namespace)}`));
      out.push(row(`  domínio    ${fg(CYAN, st.baseUrl)}`));
      out.push(row(`  idiomas    ${fg(CYAN, i18nOpts[st.i18nIdx][2].join(" + "))}`));
      out.push(row(`  contexto   ${dim(truncTo(st.context || "(vazio — edite depois)", W - 16))}`));
      out.push(blank());
      out.push(row(dim(`  grava em profiles/<slug>/profile.md e ativa (.forge/profile.md)`)));
      if (existingName) out.push(row(fg(YELLOW, `  ⚠ substitui o profile atual: "${existingName}"`)));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = gravar profile ▶"))));
    }

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    const hints = st.step === I18N_STEP ? "↑↓ escolhe · Enter continua · ← volta · Esc sai" : "Enter continua · ← volta · Esc sai";
    out.push(fg(PURPLE, "└─ ") + dim(hints) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(hints) - 5)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const data = await new Promise((resolve) => {
    const bootAt = Date.now();
    const onKey = (str, key) => {
      if (Date.now() - bootAt < 350) return; // engole ESC fantasma do raw mode (Windows)
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);

      if (st.step < CONTEXT_STEP) {
        const f = fields[st.step];
        if (key.name === "return") {
          if (String(st[f.key]).trim().length >= f.min) st.step++;
          else st.err = `mínimo ${f.min} caracteres`;
        } else if (key.name === "backspace") st[f.key] = st[f.key].slice(0, -1);
        else if (key.name === "left") st.step = Math.max(0, st.step - 1);
        else if (str && !key.ctrl && str >= " " && st[f.key].length < f.max) st[f.key] += str;
      } else if (st.step === CONTEXT_STEP) {
        if (key.name === "return") st.step++;
        else if (key.name === "backspace") st.context = st.context.slice(0, -1);
        else if (key.name === "left" && !st.context) st.step--;
        else if (str && !key.ctrl && str >= " " && st.context.length < 800) st.context += str;
      } else if (st.step === I18N_STEP) {
        if (key.name === "up") st.i18nIdx = (st.i18nIdx + i18nOpts.length - 1) % i18nOpts.length;
        else if (key.name === "down") st.i18nIdx = (st.i18nIdx + 1) % i18nOpts.length;
        else if (key.name === "return") st.step++;
        else if (key.name === "left") st.step--;
      } else {
        if (key.name === "return") {
          const [rule, , locales] = i18nOpts[st.i18nIdx];
          return finish({
            name: st.name.trim(),
            niche: st.niche.trim(),
            namespace: st.namespace.trim(),
            baseUrl: st.baseUrl.trim(),
            i18nRule: rule,
            locales,
            context: st.context.trim(),
          });
        }
        if (key.name === "left") st.step--;
      }
      render();
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(v);
    };
    process.stdin.on("keypress", onKey);
    render();
  });

  restore();
  if (!data) {
    console.log(dim("profile init cancelado"));
    process.exit(0);
  }
  const slug = saveProfileToLibrary(data);
  console.log(fg(GREEN, `✓ profile gravado: profiles/${slug}/profile.md`) + dim(`  (ativado → .forge/profile.md · nicho: ${data.niche})`));
  console.log(dim("  edite as seções Stack/Guardrails à vontade — a engine lê o bloco forge-config + o narrativo."));
  console.log(dim("  próximo: forge new \"<sua ideia>\"  → P0 → FOUNDATION (system design) → build → ship"));
  releaseStdin();
}

// ---------- team builder wizard (forge team — Provedor→Modelo→Effort→Funções) ----------
// Catálogo de provedores (subscription only). `real` = o effort muda o comportamento de fato
// (grok --effort · codex -c model_reasoning_effort); senão é etiqueta (claude/glm/gemini, -p sem flag).
// efforts = lista COMPLETA disponível, default primeiro; um modelo pode sobrescrever com `efforts` próprio.
const PROVIDERS = [
  { id: "grok", cli: "grok", face: "⚡", color: "#22d3ee", real: true, efforts: ["high", "medium", "low"],
    models: [{ id: "default", label: "Grok 4.5" }] },
  { id: "codex", cli: "codex", face: "⚙️", color: "#38bdf8", real: true, efforts: ["medium", "high", "xhigh", "max", "low"],
    models: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    ] },
  { id: "claude", cli: "claude", face: "🎨", color: "#f59e0b", real: false, efforts: ["high", "medium", "low"],
    models: [
      { id: "claude-fable-5", label: "Claude Fable 5", efforts: ["xhigh", "high", "medium", "low"] },
      { id: "opus", label: "Claude Opus", efforts: ["high", "xhigh", "medium", "low"] },
      { id: "sonnet", label: "Claude Sonnet", efforts: ["high", "medium", "low"] },
    ] },
  { id: "glm", cli: "claude", env: "glm", face: "🖌️", color: "#00b8a9", real: false, efforts: ["max", "high", "medium", "low"],
    models: [{ id: "opus", label: "GLM 5.2" }] },
  { id: "gemini", cli: "gemini", face: "✨", color: "#a78bfa", real: false, efforts: ["medium"],
    models: [{ id: "default", label: "Gemini (agy)" }] },
];

/** efforts disponíveis para o modelo escolhido (override do modelo > lista do provedor) */
const effortsOf = (prov, modelIdx) => prov.models[modelIdx]?.efforts || prov.efforts;

function writeTeamToRoster(teamId, team, newPlayers) {
  const rosterPath = path.join(__dirname, "roster.json");
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  for (const p of newPlayers) byId.set(p.id, p); // dedup/replace por id
  roster.players = [...byId.values()];
  roster.teams = roster.teams || {};
  roster.teams[teamId] = team;
  fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2), "utf8");
}

async function teamWizard() {
  const st = {
    phase: "name", // name → provider → model → effort → roles → more → confirm
    teamName: "",
    musicians: [],
    provIdx: 0, modelIdx: 0, effortIdx: 0,
    roleSel: TEAM_ROLES.map(() => false), roleCursor: 0,
    moreIdx: 0,
    err: "",
  };
  const phaseOrder = ["nome", "provedor", "modelo", "effort", "funções", "+músico", "gravar"];
  const phaseIdx = { name: 0, provider: 1, model: 2, effort: 3, roles: 4, more: 5, confirm: 6 };

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  const curProv = () => PROVIDERS[st.provIdx];

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🎼 FORGE · MONTAR TIME")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 26)) + "┐"));
    const cur = phaseIdx[st.phase];
    out.push(row(phaseOrder.map((n, i) => (i === cur ? bold(fg(CYAN, `● ${n}`)) : dim(`○ ${n}`))).join(dim(" "))));
    if (st.musicians.length) out.push(row(dim(`  músicos: ${st.musicians.map((m) => `${m.modelLabel}(${m.roles.map((r) => r[0]).join("")})`).join(" · ")}`)));
    out.push(blank());

    if (st.phase === "name") {
      out.push(row(bold("Nome do time?")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.teamName}▌`)));
      out.push(blank());
      out.push(row(dim("  ex.: Sol solo · Grok+GLM · Opus backend + Sonnet front")));
    } else if (st.phase === "provider") {
      out.push(row(bold(`Músico ${st.musicians.length + 1} · provedor?`)));
      out.push(blank());
      PROVIDERS.forEach((p, i) => {
        const sel = i === st.provIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${p.face} ${sel ? bold(p.id) : p.id}  ${dim(`${p.cli}${p.env ? "/" + p.env : ""} · effort ${p.real ? "real" : "etiqueta"}`)}`));
      });
    } else if (st.phase === "model") {
      const p = curProv();
      out.push(row(bold(`${p.face} ${p.id} · modelo?`)));
      out.push(blank());
      p.models.forEach((m, i) => {
        const sel = i === st.modelIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(m.label) : m.label}  ${dim(m.id)}`));
      });
    } else if (st.phase === "effort") {
      const p = curProv();
      out.push(row(bold(`${p.face} ${p.models[st.modelIdx].label} · effort?`)));
      out.push(blank());
      effortsOf(p, st.modelIdx).forEach((e, i) => {
        const sel = i === st.effortIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(e.toUpperCase()) : e.toUpperCase()}`));
      });
      out.push(blank());
      out.push(row(dim(p.real ? "  effort REAL neste provedor (muda o raciocínio)" : "  etiqueta: este CLI não expõe effort — informativo")));
    } else if (st.phase === "roles") {
      out.push(row(bold(`${curProv().models[st.modelIdx].label} · funções? (espaço marca · a = todas)`)));
      out.push(blank());
      TEAM_ROLES.forEach((r, i) => {
        const on = st.roleSel[i];
        const cursor = i === st.roleCursor;
        out.push(row(`${cursor ? bold(fg(CYAN, "▸ ")) : "  "}${on ? fg(GREEN, "[x]") : "[ ]"} ${cursor ? bold(r.id) : r.id}  ${dim(r.desc)}`));
      });
    } else if (st.phase === "more") {
      out.push(row(bold("Time montado até aqui:")));
      out.push(blank());
      st.musicians.forEach((m) => out.push(row(`  ${m.face} ${fg(CYAN, m.modelLabel)} ${m.effort.toUpperCase()} ${dim("→ " + m.roles.join(" · "))}`)));
      out.push(blank());
      [["+ adicionar outro músico", ""], ["finalizar e gravar", ""]].forEach(([label], i) => {
        const sel = i === st.moreIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(label) : label}`));
      });
    } else {
      const { team, players } = composeTeam(st.teamName.trim() || "time", st.musicians);
      const covered = new Set(Object.keys(team.dispatch).filter((k) => k !== "default"));
      const coreRoles = ["Estrategista", "Engenheiro", "Designer", "QA"];
      const missing = coreRoles.filter((r) => !st.musicians.some((m) => m.roles.includes(r)));
      out.push(row(bold(`Gravar time "${st.teamName.trim()}" (${players.length} músico(s))`)));
      out.push(blank());
      st.musicians.forEach((m) => out.push(row(`  ${m.face} ${fg(CYAN, m.modelLabel)} ${m.effort.toUpperCase()} ${dim("→ " + m.roles.join("/"))}`)));
      out.push(blank());
      out.push(row(dim(`  cobre ${covered.size} jobs · default = ${team.dispatch.default || "—"}`)));
      if (missing.length) out.push(row(fg(YELLOW, `  ⚠ sem papel: ${missing.join(", ")} → cai no default nesses jobs`)));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = gravar no roster.json ▶"))));
    }

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    const hints =
      st.phase === "name" ? "Enter continua · Esc sai"
      : st.phase === "roles" ? "↑↓ move · espaço marca · a todas · Enter confirma · ← volta · Esc sai"
      : st.phase === "confirm" ? "Enter grava · ← volta · Esc sai"
      : "↑↓ escolhe · Enter continua · ← volta · Esc sai";
    out.push(fg(PURPLE, "└─ ") + dim(hints) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(hints) - 5)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const result = await new Promise((resolve) => {
    const bootAt = Date.now();
    const commitMusician = () => {
      const p = curProv();
      st.musicians.push({
        provider: p.id, cli: p.cli, env: p.env, model: p.models[st.modelIdx].id,
        modelLabel: p.models[st.modelIdx].label, effort: effortsOf(p, st.modelIdx)[st.effortIdx],
        roles: TEAM_ROLES.filter((_, i) => st.roleSel[i]).map((r) => r.id),
        face: p.face, color: p.color,
      });
      st.provIdx = 0; st.modelIdx = 0; st.effortIdx = 0;
      st.roleSel = TEAM_ROLES.map(() => false); st.roleCursor = 0;
    };
    const onKey = (str, key) => {
      if (Date.now() - bootAt < 350) return;
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);

      if (st.phase === "name") {
        if (key.name === "return") { if (st.teamName.trim().length >= 2) st.phase = "provider"; else st.err = "mínimo 2 caracteres"; }
        else if (key.name === "backspace") st.teamName = st.teamName.slice(0, -1);
        else if (str && !key.ctrl && str >= " " && st.teamName.length < 40) st.teamName += str;
      } else if (st.phase === "provider") {
        const n = PROVIDERS.length;
        if (key.name === "up") st.provIdx = (st.provIdx + n - 1) % n;
        else if (key.name === "down") st.provIdx = (st.provIdx + 1) % n;
        else if (key.name === "return") { st.modelIdx = 0; st.effortIdx = 0; st.phase = "model"; }
        else if (key.name === "left") st.phase = st.musicians.length ? "more" : "name";
      } else if (st.phase === "model") {
        const n = curProv().models.length;
        if (key.name === "up") st.modelIdx = (st.modelIdx + n - 1) % n;
        else if (key.name === "down") st.modelIdx = (st.modelIdx + 1) % n;
        else if (key.name === "return") { st.effortIdx = 0; st.phase = "effort"; }
        else if (key.name === "left") st.phase = "provider";
      } else if (st.phase === "effort") {
        const n = effortsOf(curProv(), st.modelIdx).length;
        if (key.name === "up") st.effortIdx = (st.effortIdx + n - 1) % n;
        else if (key.name === "down") st.effortIdx = (st.effortIdx + 1) % n;
        else if (key.name === "return") st.phase = "roles";
        else if (key.name === "left") st.phase = "model";
      } else if (st.phase === "roles") {
        const n = TEAM_ROLES.length;
        if (key.name === "up") st.roleCursor = (st.roleCursor + n - 1) % n;
        else if (key.name === "down") st.roleCursor = (st.roleCursor + 1) % n;
        else if (str === " ") st.roleSel[st.roleCursor] = !st.roleSel[st.roleCursor];
        else if (str === "a") st.roleSel = TEAM_ROLES.map(() => true);
        else if (key.name === "return") {
          if (st.roleSel.some(Boolean)) { commitMusician(); st.moreIdx = 0; st.phase = "more"; }
          else st.err = "marque ao menos 1 função (espaço) ou 'a' pra todas";
        } else if (key.name === "left") st.phase = "effort";
      } else if (st.phase === "more") {
        if (key.name === "up" || key.name === "down") st.moreIdx = st.moreIdx ? 0 : 1;
        else if (key.name === "return") st.phase = st.moreIdx === 0 ? "provider" : "confirm";
        else if (key.name === "left") st.phase = "provider";
      } else {
        if (key.name === "return") return finish({ teamName: st.teamName.trim(), musicians: st.musicians });
        if (key.name === "left") { st.moreIdx = 1; st.phase = "more"; }
      }
      render();
    };
    const finish = (v) => { process.stdin.removeListener("keypress", onKey); resolve(v); };
    process.stdin.on("keypress", onKey);
    render();
  });

  restore();
  if (!result || !result.musicians.length) {
    console.log(dim("montagem de time cancelada"));
    process.exit(0);
  }
  const { teamId, team, players } = composeTeam(result.teamName, result.musicians, result.musicians[0].face || "🎼");
  writeTeamToRoster(teamId, team, players);
  console.log(fg(GREEN, `✓ time "${teamId}" gravado no roster.json`) + dim(`  (${players.length} músico(s))`));
  console.log(dim(`  usar: forge new "<ideia>" --team ${teamId}   ·   ver: forge roster`));
  releaseStdin();
}

// ---------- blueprint scaffolding ----------
export function scaffoldProject({ root, blueprint, slug, name, idea }) {
  const dir = path.join(root, ".forge", "projects", slug);
  fs.mkdirSync(path.join(dir, "decisions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", slug), { recursive: true });
  const project = { blueprint, slug, name: name || slug, idea: idea || "", createdAt: new Date().toISOString(), status: "intake-pending" };
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(project, null, 2), "utf8");
  return dir;
}

// ---------- onboarding wizard (forge onboard — INTAKE + DISCOVERY → brief) ----------
export function writeBriefArtifacts({ root, slug, intake, brief }) {
  const pdir = path.join(root, ".forge", "projects", slug);
  const ddir = path.join(root, "docs", slug);
  fs.mkdirSync(pdir, { recursive: true });
  fs.mkdirSync(ddir, { recursive: true });
  fs.writeFileSync(path.join(pdir, "intake.json"), JSON.stringify(intake, null, 2), "utf8");
  fs.writeFileSync(path.join(pdir, "brief.json"), JSON.stringify(brief, null, 2), "utf8");
  const kv = (o) => Object.entries(o).map(([k, v]) => `- **${k}:** ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
  const md = [
    `# Brief — ${intake.brand || slug}`, "",
    "## Intake", kv(intake), "",
    "## Discovery", kv(brief), "",
  ].join("\n");
  const briefMd = path.join(ddir, "brief.md");
  fs.writeFileSync(briefMd, md, "utf8");
  return { briefMd };
}

async function onboardWizard(slug) {
  const projectDir = path.join(ROOT, ".forge", "projects", slug);
  let project;
  try {
    project = JSON.parse(fs.readFileSync(path.join(projectDir, "project.json"), "utf8"));
  } catch {
    throw new Error(`projeto não encontrado: .forge/projects/${slug}`);
  }

  const intakeQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "blueprints", "gameads", "questions", "intake.json"), "utf8")).questions;
  const discoveryQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "blueprints", "gameads", "questions", "discovery.json"), "utf8")).questions;
  const allQuestions = [...intakeQuestions, ...discoveryQuestions];

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  const st = { qIdx: 0, answers: {}, err: "" };

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🎬 GAMEADS ONBOARD")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 27)) + "┐"));
    out.push(row(`${st.qIdx + 1}/${allQuestions.length} · ${slug}`));
    out.push(blank());

    const q = allQuestions[st.qIdx];
    out.push(row(bold(q.label)));
    out.push(blank());
    const ans = st.answers[q.key] || "";
    out.push(row(fg(CYAN, `  ${ans}▌`)));
    out.push(blank());
    if (q.default) out.push(row(dim(`  padrão: ${q.default}`)));
    if (!q.required) out.push(row(dim("  (opcional)")));

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    out.push(fg(PURPLE, "└─ ") + dim("Enter continua · ← volta · Esc sai") + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen("Enter continua · ← volta · Esc sai") - 3)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const answers = await new Promise((resolve) => {
    const bootAt = Date.now();
    const onKey = (str, key) => {
      if (Date.now() - bootAt < 350) return;
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);

      const q = allQuestions[st.qIdx];
      if (key.name === "return") {
        let val = st.answers[q.key] || "";
        if (q.type === "list" && val) val = val.split(",").map(s => s.trim());
        if (q.type === "number" && val) val = parseInt(val, 10);

        if (q.required && !val) {
          st.err = "resposta obrigatória";
        } else {
          if (!val && q.default) val = q.default;
          st.answers[q.key] = val;
          st.qIdx++;
          if (st.qIdx >= allQuestions.length) {
            return finish(st.answers);
          }
        }
      } else if (key.name === "backspace") {
        st.answers[q.key] = (st.answers[q.key] || "").slice(0, -1);
      } else if (key.name === "left") {
        st.qIdx = Math.max(0, st.qIdx - 1);
      } else if (str && !key.ctrl && str >= " ") {
        st.answers[q.key] = (st.answers[q.key] || "") + str;
      }
      render();
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(v);
    };
    process.stdin.on("keypress", onKey);
    render();
  });

  restore();
  if (!answers) {
    console.log(dim("onboarding cancelado"));
    process.exit(0);
  }

  // separar intake e brief
  const intake = {};
  const brief = {};
  intakeQuestions.forEach(q => { if (q.key in answers) intake[q.key] = answers[q.key]; });
  discoveryQuestions.forEach(q => { if (q.key in answers) brief[q.key] = answers[q.key]; });

  const { briefMd } = writeBriefArtifacts({ root: ROOT, slug, intake, brief });
  console.log(fg(GREEN, `✓ brief gravado: ${path.relative(ROOT, briefMd)}`));

  // aprovar o brief
  const approved = await new Promise((resolve) => {
    const onKey = (str, key) => {
      if (key.name === "escape" || (key.ctrl && key.name === "c")) return finish(null);
      if (str === "g") return finish(true);
      if (str === "k") return finish(false);
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", onKey);
      resolve(v);
    };
    enableKeys();
    process.stdin.on("keypress", onKey);
    process.stdout.write(fg(CYAN, "Aprovar o brief? [g]o / [k]ill: "));
  });

  releaseStdin();
  if (approved === true) {
    recordDecision({ projectDir, gateId: "brief-review", choice: "go" });
    project.status = "brief-approved";
    fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project, null, 2), "utf8");
    console.log(fg(GREEN, `✓ brief aprovado`));
  } else if (approved === false) {
    project.status = "brief-rejected";
    fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project, null, 2), "utf8");
    console.log(fg(YELLOW, `⊘ brief rejeitado`));
  } else {
    console.log(dim("aprovação cancelada"));
  }
}

// ---------- comandos ----------
/** aceita 1 snapshot OU o mapa multi-pipeline { appId: snapshot } */
function printStatus(snap) {
  const list = snap?.appId ? [snap] : Object.values(snap || {}).filter((x) => x && x.appId);
  if (!list.length) {
    console.log(dim("sem pipeline ativa"));
    return;
  }
  for (const p of list) printOne(p);
}

function printOne(p) {
  console.log(`${bold(p.appId)} · team ${p.team}${p.profileName ? ` · profile ${p.profileName}` : ""} · ${statusBadge(p.status)}${p.dryRun ? " · DRY-RUN" : ""}`);
  console.log(`  fase: ${p.currentJob || "—"} (${p.jobIndex}/${p.jobs.length}) · ⏱ ${elapsed(p.startedAt, p.endedAt)}`);
  const g = (p.gates || []).find((x) => !x.decision);
  if (g) console.log(fg(YELLOW, `  ⏸ gate ${g.id}: ${g.prompt}`) + `\n    → forge decide ${g.id} <${g.choices.join("|")}> --app ${p.appId}`);
  if (p.deploy?.url) console.log(`  🌐 ${p.deploy.url}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { flags, rest } = parseArgs(args);

  if (!cmd) return wizard(); // sem args = tela de setup (ideia → time → tipo → RUN)

  if (cmd === "help" || cmd === "--help") {
    console.log(`
${bold(fg(PURPLE, "🎼 forge"))} — Maestro Autopilot (starter genérico · profile-driven)

  ${bold("forge")}           tela de setup interativa (ideia → time → tipo → RUN)
  ${bold("forge ingest")} <texto|arquivo|pasta|URL> [--team X] [--control-mode M] [--review-only] [--apply]
            tria profile/blueprint, grava a decisão e inicia ideias seguras ou explicitamente aprovadas
  ${bold("forge evolve")} <texto|arquivo|pasta|URL> [--executor codex|grok|claude|gemini] [--apply]
            propõe mudança no próprio Forge; sem --apply nunca executa o coding agent
  ${bold("forge simulate")} <app> [--team X] [--dry-run]
            roda cinco personas no app concluído e permite no máximo uma melhoria automática segura
  ${bold("forge ship")} <app> [--target cf-workers|cf-pages|gh-pages] [--subdomain X]
            reviver kill/done só no P3 (gate deploy → Cloudflare em gbbragadev.com)
  ${bold("forge profile init")}   wizard que autora .forge/profile.md (nicho, stack, contexto, idiomas)
  ${bold("forge profile show")}   imprime o profile atual
  ${bold("forge team")}          monta um time na TUI (Provedor→Modelo→Effort→Funções) e grava no roster
  ${bold("forge new")} "<ideia>" [--team X] [--app-id X] [--capability static|quiz|chat]
            [--subdomain X] [--target cf-pages|cf-workers|gh-pages] [--control-mode M] [--dry-run]
            (sem --capability o P0 decide o tipo pela ideia; o gate p0-go confirma)
  ${bold("forge new --idea-file")} ideia.md   ideia GRANDE/estruturada (markdown multi-linha —
            vai inteira pro prompt de todos os jobs; mais contexto = app melhor)
  ${bold("forge new --blueprint gameads")} "<campanha>" [--slug X]   scaffold de projeto por blueprint
  ${bold("forge onboard")} <slug>       wizard INTAKE + DISCOVERY → brief + gate brief-review
  ${bold("forge feedback")}   TUI de iteração (escolhe app → feedback → time) · sem args
  ${bold("forge feedback")} <app> "<feedback geral>" [--team X] [--dry-run]
            loop de melhoria: aplica seu feedback no app pronto e redeploya
  ${bold("forge remove")} <app> [--force]   apaga o app: repo, estado do run, propostas e workbench
  ${bold("forge attach")} [app]   TUI ao vivo (N pipelines: sem arg lista; com arg acompanha uma)
  ${bold("forge status")}    snapshot rápido de TODAS as pipelines
  ${bold("forge stats")}     PASS por player/job, duração por job/app e mortes nos runs persistidos
  ${bold("forge decide")} <gate> <go|kill|retry> [feedback…] [--app X]
  ${bold("forge target")} <app> <cf-pages|cf-workers|gh-pages>   troca o alvo de deploy do run (sem recomeçar)
  ${bold("forge restart")} [--force]  reinicia o server (carrega código novo do maestro; recusa se houver job vivo)
  ${bold("forge kill")} [app]     mata o run agora (executor + pipeline) — funciona sem gate
  ${bold("forge stop")} [app]     pausa a pipeline (job atual é morto)
  ${bold("forge resume")} [app]   retoma após stop/restart do server
  ${bold("forge roster")}    players e team presets

Teams: grok-solo (default) · grok-glm-front · quality · dry-run
Modos: full_auto (default; gates locais + B3 direto) · autopilot_to_gate (legado) · guided · manual
`);
    return;
  }

  if (cmd === "ingest") {
    const source = rest.join(" ").trim();
    if (!source) throw new Error("uso: forge ingest <texto|arquivo|pasta|URL> [--team X] [--review-only] [--apply]");
    await ensureServer();
    const operation = await executeControlAction("operator.ingest", {
      source,
      team: flags.team || "grok-solo",
      capability: flags.capability,
      target: flags.target,
      controlMode: flags.controlMode || "full_auto",
      reviewOnly: Boolean(flags.reviewOnly),
      dryRun: Boolean(flags.dryRun),
      approved: Boolean(flags.apply || flags.approved),
    });
    printOperatorResult(operation);
    return;
  }

  if (cmd === "evolve") {
    const source = rest.join(" ").trim();
    if (!source) throw new Error("uso: forge evolve <texto|arquivo|pasta|URL> [--executor codex] [--apply]");
    await ensureServer();
    const operation = await executeControlAction("operator.evolve", {
      source,
      executor: flags.executor || "codex",
      maxTurns: flags.maxTurns ? Number(flags.maxTurns) : undefined,
      reviewOnly: Boolean(flags.reviewOnly),
      dryRun: Boolean(flags.dryRun),
      approved: Boolean(flags.apply || flags.approved),
    });
    printOperatorResult(operation);
    return;
  }

  if (cmd === "simulate") {
    const appId = rest[0];
    if (!appId) throw new Error("uso: forge simulate <app> [--team X] [--dry-run]");
    await ensureServer();
    const operation = await executeControlAction("pipeline.simulate", {
      team: flags.team,
      dryRun: Boolean(flags.dryRun),
      controlMode: flags.controlMode || "full_auto",
    }, appId);
    console.log(fg(GREEN, `✓ simulação iniciada para ${appId}`));
    if (operation.result?.runId) console.log(dim(`  run ${operation.result.runId}`));
    return;
  }

  if (cmd === "ship") {
    const appId = rest[0];
    if (!appId) throw new Error("uso: forge ship <app> [--target cf-workers|cf-pages] [--subdomain X]");
    await ensureServer();
    const operation = await executeControlAction("pipeline.ship", {
      target: flags.target || "cf-workers",
      subdomain: flags.subdomain,
      controlMode: flags.controlMode || "full_auto",
      dryRun: Boolean(flags.dryRun),
    }, appId);
    console.log(fg(GREEN, `✓ ship reaberto para ${appId} — gate deploy pendente`));
    if (operation.result?.runId) console.log(dim(`  run ${operation.result.runId}`));
    console.log(dim(`  forge decide deploy go --app ${appId}`));
    return;
  }

  if (cmd === "new") {
    // blueprint: forge new --blueprint gameads "<campanha>" [--slug X]
    if (flags.blueprint && flags.blueprint !== "generic") {
      loadBlueprint(flags.blueprint, { root: ROOT }); // valida (lança se inexistente)
      const idea = rest.join(" ").trim();
      if (!idea) throw new Error('uso: forge new --blueprint gameads "<campanha>" [--slug X]');
      const slug = slugify(flags.slug || idea);
      const dir = scaffoldProject({ root: ROOT, blueprint: flags.blueprint, slug, name: flags.name, idea });
      console.log(fg(GREEN, `✓ projeto criado: ${path.relative(ROOT, dir)} — próximo: forge onboard ${slug}`));
      return;
    }
    // ideia grande/estruturada: forge new --idea-file ideia.md (markdown livre, multi-linha)
    let idea = rest.join(" ").trim();
    let appId = flags.appId;
    if (flags.ideaFile) {
      const f = path.resolve(flags.ideaFile);
      idea = fs.readFileSync(f, "utf8").trim();
      if (!idea) throw new Error(`arquivo de ideia vazio: ${flags.ideaFile}`);
      // nome do APP vem do NOME DO ARQUIVO, não do conteúdo: um doc que começa falando de outro
      // produto gerava slug errado ("O ANIMA//DECK ficou…" → o-anima-deck num doc do DOKI//CALL)
      if (!appId) {
        appId = slugify(path.basename(f).replace(/\.[^.]+$/, ""));
        console.log(dim(`· app-id derivado do arquivo: ${appId}   (use --app-id para outro nome)`));
      }
    }
    if (!idea) return wizard();
    await ensureServer();
    const r = await api("/api/pipeline/start", {
      idea,
      team: flags.team,
      appId,
      capability: flags.capability,
      subdomain: flags.subdomain,
      target: flags.target,
      dryRun: flags.dryRun,
      controlMode: flags.controlMode || "full_auto",
    });
    console.log(fg(GREEN, `✓ pipeline iniciada: ${r.pipeline.appId} · team ${r.pipeline.team}`));
    await attachTUI(r.pipeline.appId);
    return;
  }

  if (cmd === "feedback") {
    const [appId, ...fb] = rest;
    const feedbackText = fb.join(" ").trim();
    if (!appId || !feedbackText) return feedbackWizard(); // sem args = TUI (app → feedback → time)
    await ensureServer();
    const r = await api("/api/pipeline/feedback", {
      appId,
      feedbackText,
      team: flags.team,
      subdomain: flags.subdomain,
      target: flags.target,
      dryRun: flags.dryRun,
      controlMode: flags.controlMode || "full_auto",
    });
    console.log(fg(GREEN, `🔁 iteração de feedback iniciada: ${r.pipeline.appId} (fb${r.pipeline.iterationNum}) · team ${r.pipeline.team}`));
    await attachTUI(r.pipeline.appId);
    return;
  }

  if (cmd === "profile") {
    const sub = rest[0] || "init";
    if (sub === "init") return profileWizard();
    if (sub === "show") {
      const p = path.join(ROOT, ".forge", "profile.md");
      console.log(fs.existsSync(p) ? fs.readFileSync(p, "utf8") : dim("sem .forge/profile.md — rode: forge profile init"));
      return;
    }
    throw new Error("uso: forge profile init | forge profile show");
  }

  if (cmd === "team") return teamWizard();

  if (cmd === "onboard") {
    const slug = rest[0];
    if (!slug) throw new Error("uso: forge onboard <slug>");
    return onboardWizard(slug);
  }

  if (cmd === "run") {
    const slug = rest[0];
    if (!slug) throw new Error("uso: forge run <slug>");
    const pdir = path.join(ROOT, ".forge", "projects", slug);
    if (!fs.existsSync(path.join(pdir, "decisions", "001-brief-review.json"))) {
      throw new Error(`brief não aprovado — rode: forge onboard ${slug}`);
    }
    const project = JSON.parse(fs.readFileSync(path.join(pdir, "project.json"), "utf8"));
    await ensureServer();
    const r = await api("/api/pipeline/start", { idea: project.idea || slug, appId: slug, slug, blueprint: project.blueprint, team: flags.team, controlMode: flags.controlMode || "full_auto" });
    console.log(fg(GREEN, `✓ pipeline ${project.blueprint} iniciada: ${r.pipeline.slug}`));
    await attachTUI(r.pipeline.appId);
    return;
  }

  if (cmd === "attach") return attachTUI(rest[0]);

  if (cmd === "stats") {
    console.log(formatStats(aggregateRuns(loadRuns(ROOT))));
    return;
  }

  if (cmd === "status") {
    await ensureServer();
    printStatus(await api("/api/pipeline"));
    return;
  }

  if (cmd === "decide") {
    const [gateId, choice, ...fb] = rest;
    if (!gateId || !choice) throw new Error("uso: forge decide <gate> <go|kill|retry> [feedback…] [--app X]");
    await ensureServer();
    const r = await api("/api/pipeline/decide", { appId: flags.app, gateId, choice, feedback: fb.join(" ") || undefined });
    console.log(fg(GREEN, `✔ ${gateId} → ${choice}`));
    printStatus(r.pipeline);
    return;
  }

  if (cmd === "stop") {
    await ensureServer();
    const r = await api("/api/pipeline/stop", { appId: rest[0] || flags.app });
    console.log(r.ok ? "■ pipeline parada — forge decide stopped retry|kill" : `✗ ${r.error}`);
    return;
  }

  if (cmd === "resume") {
    await ensureServer();
    const r = await api("/api/pipeline/resume", { appId: rest[0] || flags.app });
    printStatus(r.pipeline);
    return;
  }

  if (cmd === "target") {
    const [appId, target] = rest;
    if (!appId || !target) {
      throw new Error("uso: forge target <app> <cf-pages|cf-workers|gh-pages> [--subdomain X]");
    }
    await ensureServer();
    const r = await api("/api/pipeline/target", { appId, target, subdomain: flags.subdomain });
    if (!r.ok) {
      console.error(fg(RED, `✗ ${r.error}`));
      return;
    }
    console.log(fg(GREEN, `✔ ${appId} → deploy ${r.deploy.target}`) + dim(`  ${r.deploy.subdomain}.${r.deploy.baseUrl}`));
    console.log(dim("  agora: forge decide <gate> retry --app " + appId));
    return;
  }

  if (cmd === "restart") {
    // recarrega o código do maestro sem perder estado (pipelines vivem em maestro/pipelines/)
    await ensureServer();
    // guarda no CLIENTE: funciona mesmo com um server antigo, que não conhece a rota de shutdown
    const snap0 = await api("/api/pipeline");
    const vivos = Object.values(snap0 || {}).filter((p) => p && p.status === "running");
    if (vivos.length && !flags.force) {
      console.error(fg(RED, `✗ job vivo em ${vivos.map((p) => `${p.appId}/${p.currentJob}`).join(", ")}`));
      console.error(dim("  espere o próximo gate, ou: forge restart --force  (perde o job em andamento)"));
      return;
    }
    try {
      await api("/api/pipeline/shutdown", { force: !!flags.force });
    } catch {
      killServerByPort(PORT); // server antigo (sem a rota) → encerra pela porta
    }
    await new Promise((r) => setTimeout(r, 1500));
    await ensureServer(); // sobe de novo, já com o código novo
    console.log(fg(GREEN, "✓ server reiniciado") + dim(vivos.length ? ` (jobs perdidos: ${vivos.map((p) => p.appId).join(", ")})` : ""));
    printStatus(await api("/api/pipeline"));
    return;
  }

  if (cmd === "kill") {
    const appId = rest[0] || flags.app;
    await ensureServer();
    const r = await api("/api/pipeline/kill", { appId });
    console.log(r.ok ? fg(RED, `✗ run morto${appId ? ": " + appId : ""}`) : `✗ ${r.error}`);
    return;
  }

  if (cmd === "remove" || cmd === "rm") {
    const appId = rest[0];
    if (!appId) throw new Error("uso: forge remove <app> [--force]   (apaga app, repo, estado, propostas e workbench)");
    await ensureServer();
    const r = await api("/api/pipeline/remove", { appId, force: !!flags.force });
    console.log(fg(GREEN, `🗑 ${appId} removido`) + (r.removed?.length ? dim(`  — ${r.removed.join(" · ")}`) : dim("  (nada em disco)")));
    return;
  }

  if (cmd === "roster") {
    await ensureServer();
    const r = await api("/api/roster");
    console.log(bold("\nTeams:"));
    for (const [id, t] of Object.entries(r.teams || {})) {
      console.log(`  ${t.emoji || "·"} ${fg(CYAN, id.padEnd(16))} ${t.label}`);
      const d = Object.entries(t.dispatch).map(([k, v]) => `${k}→${v}`).join("  ");
      console.log(dim(`      ${d}`));
    }
    console.log(bold("\nPlayers:"));
    for (const pl of r.players.filter((x) => !x.hidden)) {
      const ml = pl.modelLabel ? `${pl.modelLabel}${pl.effort ? " " + String(pl.effort).toUpperCase() : ""} · ` : "";
      console.log(`  ${pl.face} ${fg(pl.color, pl.name.padEnd(16))} ${dim(ml + `${pl.cli}${pl.env ? "/" + pl.env : ""} · ${(pl.jobs || []).join(" ")}`)}`);
    }
    console.log("");
    return;
  }

  throw new Error(`comando desconhecido: ${cmd} — forge help`);
}

// Apenas executa CLI quando invocado diretamente (não quando importado em testes)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(fg(RED, `✗ ${e.message || e}`));
    process.exitCode = 1; // não usar process.exit(): mata handles do stdin no meio (assertion do libuv)
    if (process.stdin.isTTY) process.stdin.pause();
  });
}
