#!/usr/bin/env node
/**
 * forge — CLI do Maestro Autopilot (estilo harness: TUI full-screen, cliente REST+SSE).
 *
 *   forge new "<ideia>" [--team grok-glm-front] [--app-id x] [--capability static|quiz|chat]
 *                       [--subdomain x] [--target cf-pages|vercel] [--dry-run]
 *   forge attach | status | decide <gate> <go|kill|retry> [feedback…] | stop | resume | roster
 *
 * Teclas na TUI: [g] go · [k] kill (2x) · [r] retry · [f] retry + feedback · [q] detach
 * O server (maestro/server.mjs :8799) é iniciado automaticamente se não estiver de pé.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API = `http://127.0.0.1:${process.env.MAESTRO_PORT || 8799}`;

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

// ---------- args ----------
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a.startsWith("--")) flags[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else rest.push(a);
  }
  return { flags, rest };
}

// ---------- TUI ----------
const JOB_SHORT = { "L0/P0": "P0", "L0/P1": "P1", "L1/B1": "B1", "L1/B2": "B2", "L1/B3": "B3", "L1/B4": "B4", "L1/B5": "B5", P3: "ship" };
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

let keysEnabled = false;
function enableKeys() {
  if (keysEnabled) return;
  keysEnabled = true;
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
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

async function attachTUI() {
  await ensureServer();
  const state = {
    pipeline: null,
    roster: null,
    logs: [],
    tick: 0,
    flash: null,
    input: null, // {buffer} quando digitando feedback
    pendingKill: 0,
    detach: false,
  };
  try {
    state.pipeline = await api("/api/pipeline");
  } catch {}
  try {
    state.roster = await api("/api/roster");
  } catch {}

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
              if (ev.type === "log") {
                state.logs.push(ev.line);
                if (state.logs.length > 300) state.logs.shift();
              } else if (ev.type === "pipeline") {
                state.pipeline = ev.pipeline;
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

  const gate = () => (state.pipeline?.gates || []).find((g) => !g.decision);

  async function decideKey(choice, feedback) {
    const g = gate();
    if (!g) return;
    if (!g.choices.includes(choice)) {
      state.flash = `gate ${g.id} não aceita "${choice}" (opções: ${g.choices.join("/")})`;
      return;
    }
    try {
      await api("/api/pipeline/decide", { gateId: g.id, choice, feedback });
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
      const st = state.pipeline?.status;
      if (st === "running") console.log("· detach — a pipeline continua no server. `forge attach` para voltar.");
      process.exit(0);
    }
    if (key.name === "g") await decideKey("go");
    if (key.name === "r") await decideKey("retry");
    if (key.name === "f" && gate()?.choices.includes("retry")) state.input = { buffer: "" };
    if (key.name === "k") {
      if (Date.now() - state.pendingKill < 3000) await decideKey("kill");
      else {
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
    const p = state.pipeline;
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
          `${bold(p.appId)} ${dim("·")} team ${fg(CYAN, p.team)} ${dim("·")} ${statusBadge(p.status)}${p.dryRun ? dim(" · DRY-RUN") : ""}`
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
        if (state.input) {
          out.push(row(fg(CYAN, `feedback: ${state.input.buffer}▌`) + dim("  (Enter envia · Esc cancela)")));
        } else {
          const opts = [];
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
    const logRows = Math.max(3, rows - used - footerRows - 1);
    const tail = state.logs.slice(-logRows);
    for (let i = 0; i < logRows; i++) out.push(row(tail[i] !== undefined ? dim(tail[i]) : ""));

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

// ---------- setup wizard (forge sem args — estilo tela inicial de harness) ----------
async function wizard() {
  await ensureServer();
  let roster = null;
  try {
    roster = await api("/api/roster");
  } catch {}
  const teams = Object.entries(roster?.teams || {});
  if (!teams.length) throw new Error("roster sem teams — confira maestro/roster.json");
  const caps = [
    ["static", "site estático (export → <app>.gbbragadev.com)"],
    ["quiz", "quiz estático shareable"],
    ["chat", "app com API/chat (server → Vercel)"],
  ];
  const st = { step: 0, idea: "", teamIdx: 0, capIdx: 0, dry: false, err: "" };

  process.stdout.write(`${ESC}?1049h${ESC}?25l`);
  const restore = () => process.stdout.write(`${ESC}?25h${ESC}?1049l`);
  enableKeys();

  const stepNames = ["ideia", "time", "tipo", "confirmar"];

  function render() {
    const cols = Math.max(64, Math.min(process.stdout.columns || 100, 100));
    const W = cols - 2;
    const out = [];
    const row = (s) => fg(PURPLE, "│") + padTo(" " + truncTo(s, W - 2), W) + fg(PURPLE, "│");
    const blank = () => row("");
    out.push(fg(PURPLE, "┌─ ") + bold(fg(PURPLE, "🎼 MAESTRO · NOVO APP")) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - 25)) + "┐"));
    out.push(row(stepNames.map((n, i) => (i === st.step ? bold(fg(CYAN, `● ${n}`)) : i < st.step ? fg(GREEN, `✓ ${n}`) : dim(`○ ${n}`))).join(dim("  ─  "))));
    out.push(blank());

    if (st.step === 0) {
      out.push(row(bold("Qual é a ideia do app?")));
      out.push(blank());
      out.push(row(fg(CYAN, `  ${st.idea}▌`)));
      out.push(blank());
      out.push(row(dim("  ex.: quiz de openings de anime · gerador de photocard · fanfic interativa")));
      out.push(blank());
      out.push(row(dim("  ideia grande/detalhada? escreva um .md em ideas/ (pasta gitignored) e rode:")));
      out.push(row(dim("  forge new --idea-file ideas/minha-ideia.md   (mais contexto = app melhor)")));
    } else if (st.step === 1) {
      out.push(row(bold("Quem toca? (setup de agentes)")));
      out.push(blank());
      teams.forEach(([id, t], i) => {
        const sel = i === st.teamIdx;
        const disp = Object.entries(t.dispatch || {}).map(([k, v]) => `${k}→${v}`).join("  ");
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${t.emoji || "·"} ${sel ? bold(id) : id}  ${dim(t.label || "")}`));
        if (sel) out.push(row(dim(`      ${disp}`)));
      });
    } else if (st.step === 2) {
      out.push(row(bold("Que tipo de app?")));
      out.push(blank());
      caps.forEach(([id, label], i) => {
        const sel = i === st.capIdx;
        out.push(row(`${sel ? bold(fg(CYAN, "▸ ")) : "  "}${sel ? bold(id) : id}  ${dim(label)}`));
      });
    } else {
      const [teamId, team] = teams[st.teamIdx];
      out.push(row(bold("Partitura pronta:")));
      out.push(blank());
      out.push(row(`  ideia   ${fg(CYAN, truncTo(st.idea, W - 14))}`));
      out.push(row(`  time    ${team.emoji || "·"} ${fg(CYAN, teamId)} ${dim(team.label || "")}`));
      out.push(row(`  tipo    ${fg(CYAN, caps[st.capIdx][0])}`));
      out.push(row(`  dry-run ${st.dry ? fg(YELLOW, "SIM (não gasta limite)") : dim("não")}   ${dim("← tecla [d] alterna")}`));
      out.push(blank());
      out.push(row(bold(fg(GREEN, "  Enter = começar o arco ▶"))));
    }

    out.push(blank());
    if (st.err) out.push(row(fg(RED, st.err)));
    const hints =
      st.step === 0
        ? "Enter continua · Esc sai"
        : st.step === 3
          ? "Enter inicia · d dry-run · ← volta · Esc sai"
          : "↑↓ escolhe · Enter continua · ← volta · Esc sai";
    out.push(fg(PURPLE, "└─ ") + dim(hints) + fg(PURPLE, " " + "─".repeat(Math.max(0, W - visibleLen(hints) - 5)) + "┘"));

    let frame = `${ESC}H`;
    for (const line of out) frame += line + `${ESC}K\n`;
    frame += `${ESC}J`;
    process.stdout.write(frame);
  }

  const payload = await new Promise((resolve) => {
    const bootAt = Date.now();
    const onKey = (str, key) => {
      // terminais Windows soltam ESC fantasma ao entrar em raw mode — engole o boot
      if (Date.now() - bootAt < 350) return;
      st.err = "";
      if ((key.ctrl && key.name === "c") || key.name === "escape") return finish(null);
      if (st.step === 0) {
        if (key.name === "return") {
          if (st.idea.trim().length >= 6) st.step = 1;
          else st.err = "escreve a ideia (mínimo 6 caracteres)";
        } else if (key.name === "backspace") st.idea = st.idea.slice(0, -1);
        else if (str && !key.ctrl && str >= " " && st.idea.length < 600) st.idea += str;
      } else if (st.step === 1) {
        if (key.name === "up") st.teamIdx = (st.teamIdx + teams.length - 1) % teams.length;
        else if (key.name === "down") st.teamIdx = (st.teamIdx + 1) % teams.length;
        else if (key.name === "return") st.step = 2;
        else if (key.name === "left") st.step = 0;
      } else if (st.step === 2) {
        if (key.name === "up") st.capIdx = (st.capIdx + caps.length - 1) % caps.length;
        else if (key.name === "down") st.capIdx = (st.capIdx + 1) % caps.length;
        else if (key.name === "return") st.step = 3;
        else if (key.name === "left") st.step = 1;
      } else {
        if (key.name === "return")
          return finish({ idea: st.idea.trim(), team: teams[st.teamIdx][0], capability: caps[st.capIdx][0], dryRun: st.dry });
        if (key.name === "left") st.step = 2;
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
  const r = await api("/api/pipeline/start", payload);
  console.log(fg(GREEN, `✓ pipeline iniciada: ${r.pipeline.appId} · team ${r.pipeline.team}`));
  await attachTUI();
}

// ---------- comandos ----------
function printStatus(p) {
  if (!p || !p.appId) {
    console.log(dim("sem pipeline ativa"));
    return;
  }
  console.log(`${bold(p.appId)} · team ${p.team} · ${statusBadge(p.status)}${p.dryRun ? " · DRY-RUN" : ""}`);
  console.log(`  fase: ${p.currentJob || "—"} (${p.jobIndex}/${p.jobs.length}) · ⏱ ${elapsed(p.startedAt, p.endedAt)}`);
  const g = (p.gates || []).find((x) => !x.decision);
  if (g) console.log(fg(YELLOW, `  ⏸ gate ${g.id}: ${g.prompt}`) + `\n    → forge decide ${g.id} <${g.choices.join("|")}>`);
  if (p.deploy?.url) console.log(`  🌐 ${p.deploy.url}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { flags, rest } = parseArgs(args);

  if (!cmd) return wizard(); // sem args = tela de setup (ideia → time → tipo → RUN)

  if (cmd === "help" || cmd === "--help") {
    console.log(`
${bold(fg(PURPLE, "🎼 forge"))} — Maestro Autopilot (anime-forge)

  ${bold("forge")}           tela de setup interativa (ideia → time → tipo → RUN)
  ${bold("forge new")} "<ideia>" [--team X] [--app-id X] [--capability static|quiz|chat]
            [--subdomain X] [--target cf-pages|vercel] [--dry-run]
  ${bold("forge new --idea-file")} ideia.md   ideia GRANDE/estruturada (markdown multi-linha —
            vai inteira pro prompt de todos os jobs; mais contexto = app melhor)
  ${bold("forge feedback")} <app> "<feedback geral>" [--team X] [--dry-run]
            loop de melhoria: aplica seu feedback no app pronto e redeploya
  ${bold("forge attach")}    TUI ao vivo da pipeline
  ${bold("forge status")}    snapshot rápido
  ${bold("forge decide")} <gate> <go|kill|retry> [feedback…]
  ${bold("forge stop")}      pausa a pipeline (job atual é morto)
  ${bold("forge resume")}    retoma após stop/restart do server
  ${bold("forge roster")}    players e team presets

Teams: grok-solo (default) · grok-glm-front · quality · dry-run
`);
    return;
  }

  if (cmd === "new") {
    // ideia grande/estruturada: forge new --idea-file ideia.md (markdown livre, multi-linha)
    let idea = rest.join(" ").trim();
    if (flags.ideaFile) {
      idea = fs.readFileSync(path.resolve(flags.ideaFile), "utf8").trim();
      if (!idea) throw new Error(`arquivo de ideia vazio: ${flags.ideaFile}`);
    }
    if (!idea) return wizard();
    await ensureServer();
    const r = await api("/api/pipeline/start", {
      idea,
      team: flags.team,
      appId: flags.appId,
      capability: flags.capability,
      subdomain: flags.subdomain,
      target: flags.target,
      dryRun: flags.dryRun,
    });
    console.log(fg(GREEN, `✓ pipeline iniciada: ${r.pipeline.appId} · team ${r.pipeline.team}`));
    await attachTUI();
    return;
  }

  if (cmd === "feedback") {
    const [appId, ...fb] = rest;
    const feedbackText = fb.join(" ").trim();
    if (!appId || !feedbackText) throw new Error('uso: forge feedback <app> "<feedback geral>" [--team X] [--dry-run]');
    await ensureServer();
    const r = await api("/api/pipeline/feedback", {
      appId,
      feedbackText,
      team: flags.team,
      subdomain: flags.subdomain,
      target: flags.target,
      dryRun: flags.dryRun,
    });
    console.log(fg(GREEN, `🔁 iteração de feedback iniciada: ${r.pipeline.appId} (fb${r.pipeline.iterationNum}) · team ${r.pipeline.team}`));
    await attachTUI();
    return;
  }

  if (cmd === "attach") return attachTUI();

  if (cmd === "status") {
    await ensureServer();
    printStatus(await api("/api/pipeline"));
    return;
  }

  if (cmd === "decide") {
    const [gateId, choice, ...fb] = rest;
    if (!gateId || !choice) throw new Error("uso: forge decide <gate> <go|kill|retry> [feedback…]");
    await ensureServer();
    const r = await api("/api/pipeline/decide", { gateId, choice, feedback: fb.join(" ") || undefined });
    console.log(fg(GREEN, `✔ ${gateId} → ${choice}`));
    printStatus(r.pipeline);
    return;
  }

  if (cmd === "stop") {
    await ensureServer();
    const r = await api("/api/pipeline/stop", {});
    console.log(r.ok ? "■ pipeline parada — forge decide stopped retry|kill" : `✗ ${r.error}`);
    return;
  }

  if (cmd === "resume") {
    await ensureServer();
    const r = await api("/api/pipeline/resume", {});
    printStatus(r.pipeline);
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

main().catch((e) => {
  console.error(fg(RED, `✗ ${e.message || e}`));
  process.exitCode = 1; // não usar process.exit(): mata handles do stdin no meio (assertion do libuv)
  if (process.stdin.isTTY) process.stdin.pause();
});
