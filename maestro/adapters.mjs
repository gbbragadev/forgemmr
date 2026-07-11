/**
 * Executor adapters — matriz de spawn por CLI (subscription only) + sanitização de stream.
 *
 * Compartilhado por server.mjs (/api/run) e engine.mjs (pipeline autopilot).
 * policy.coding = subscription_cli_only: nenhum adapter usa API paga por chamada.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Strip ANSI / OSC / TUI control codes */
export function stripAnsi(input) {
  let s = String(input);
  s = s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
  s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
  s = s.replace(/\x1b[@-Z\\-_]/g, "");
  s = s.replace(/\x1b./g, "");
  // only strip CSI-like leftovers that look like escape params, not "[08:27:15]"
  s = s.replace(/(?<![\w\d])\[[\?\d;]{1,40}[A-Za-z](?![\w])/g, "");
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  return s;
}

/** True = ruído de TUI, não mostrar em log limpo */
export function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^[\d*]+$/.test(t)) return true;
  if (/^[*\s]*\d{1,4}$/.test(t)) return true;
  if (/^[a-z]\.\d+$/i.test(t)) return true;
  if (/^[\d.]+\s*%?$/.test(t)) return true;
  if (/^[\s│┃─┌┐└┘╭╮╰╯█░▒▓●○◦·▌▐▀▄]+$/u.test(t)) return true;
  if (t.length <= 2 && !/^[✓✗▶■$]/.test(t)) return true;
  const letters = (t.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  if (t.length >= 6 && letters / t.length < 0.2) return true;
  return false;
}

/**
 * Buffer bytes → só emite linhas completas (\n). \r = redraw de TUI (descarta).
 * emit(line) é chamado por linha limpa e deduplicada.
 */
export function createStreamSanitizer(emit, prefix = "") {
  let buf = "";
  let lastEmitted = "";
  let lastProgressAt = 0;

  return {
    push(chunk) {
      const s = stripAnsi(String(chunk));
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "\r") {
          buf = "";
          continue;
        }
        if (ch === "\n") {
          const line = buf.replace(/\s+$/, "");
          buf = "";
          if (isNoiseLine(line)) continue;
          if (line === lastEmitted) continue;
          lastEmitted = line;
          emit(prefix + line);
          continue;
        }
        buf += ch;
        if (buf.length > 8000) buf = buf.slice(-2000);
      }
      const soft = buf.trim();
      if (
        soft.length >= 12 &&
        /[A-Za-z]/.test(soft) &&
        !isNoiseLine(soft) &&
        soft !== lastEmitted &&
        Date.now() - lastProgressAt > 2500
      ) {
        if (/\b(run|build|error|pass|fail|writing|created|done|npm|✓|✗|▶)\b/i.test(soft)) {
          lastProgressAt = Date.now();
          lastEmitted = soft;
          emit(prefix + soft + " …");
        }
      }
    },
    flush() {
      const line = buf.replace(/\s+$/, "");
      buf = "";
      if (!isNoiseLine(line) && line !== lastEmitted) emit(prefix + line);
    },
  };
}

export function resolveBin(name) {
  const isWin = process.platform === "win32";
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  if (name === "grok" || name === "grok.exe") {
    const p = path.join(home, ".grok", "bin", isWin ? "grok.exe" : "grok");
    if (fs.existsSync(p)) return p;
  }
  return name;
}

/**
 * Redator de segredos: mascara valores de env sensíveis antes de qualquer
 * escrita em log/raw log (ex.: wrangler ecoando token em mensagem de erro).
 */
export function makeRedactor() {
  const secrets = [
    "GLM_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "VERCEL_TOKEN",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "OPEN_ROUTER_API_KEY",
    "OPENROUTER_API_KEY",
    "ZAI_API_KEY",
    "GITHUB_TOKEN",
  ]
    .map((k) => process.env[k])
    .filter((v) => v && v.length >= 8);
  return (s) => {
    let out = String(s);
    for (const v of secrets) out = out.split(v).join("[redacted]");
    return out;
  };
}

/** Sinais de rate-limit/quota → L2 automático (cooldown + fallback player) */
export function detectRateLimit(text) {
  return /(429|rate.?limit|usage limit|quota (exceeded|reached)|limit (reached|exceeded)|overloaded_error)/i.test(
    String(text)
  );
}

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
const EMPTY_MCP = path.join(HOME, ".claude", "empty-mcp.json");

/**
 * Monta { cmd, args, env } para um executor headless.
 * @param {string} cli grok | claude | glm | codex | gemini | bernstein | fake
 * @param {string} goal prompt completo do job
 * @param {{ root: string, maxTurns?: number, model?: string }} opts
 */
export function buildSpawn(cli, goal, opts) {
  const { root, maxTurns = 30, model } = opts;
  const base = {
    ...process.env,
    FORCE_COLOR: "0",
    NO_COLOR: "1",
    TERM: "dumb",
    CI: "1",
    GROK_NO_TUI: "1",
  };
  const dropAnthropic = (env) => {
    for (const k of [
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    ])
      delete env[k];
    return env;
  };

  if (cli === "claude") {
    // Anthropic OAuth — limpa qualquer backend alternativo herdado do ambiente
    return {
      cmd: "claude",
      args: [
        "-p",
        goal,
        ...(model ? ["--model", model] : []),
        "--permission-mode",
        "bypassPermissions",
        "--max-turns",
        String(maxTurns),
      ],
      env: dropAnthropic(base),
    };
  }

  if (cli === "glm") {
    // Claude Code + backend Z.ai (GLM Coding Plan) — espelho fiel de ~/.claude/switch-model.ps1 (provider=glm)
    if (!process.env.GLM_API_KEY) throw new Error("GLM_API_KEY não está no ambiente");
    const env = dropAnthropic(base);
    env.ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic";
    env.ANTHROPIC_AUTH_TOKEN = process.env.GLM_API_KEY;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = "glm-5.2[1m]";
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = "glm-5.2[1m]";
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "glm-4.7";
    const mcpOff = fs.existsSync(EMPTY_MCP)
      ? ["--strict-mcp-config", "--mcp-config", EMPTY_MCP] // lean: poupa quota do Coding Plan
      : [];
    return {
      cmd: "claude",
      args: [
        "-p",
        goal,
        "--model",
        model || "opus",
        "--dangerously-skip-permissions",
        "--max-turns",
        String(maxTurns),
        ...mcpOff,
      ],
      env,
    };
  }

  if (cli === "codex") {
    return { cmd: "codex", args: ["exec", "--full-auto", goal.replace(/\r?\n/g, " ")], env: base };
  }

  if (cli === "gemini") {
    return { cmd: "gemini", args: ["-p", goal.replace(/\r?\n/g, " "), "-y"], env: base };
  }

  if (cli === "bernstein") {
    return { cmd: "bernstein", args: ["-g", goal.replace(/\r?\n/g, " · ")], env: base };
  }

  if (cli === "fake") {
    // Dry-run: gera artefatos esperados sem tocar em código real
    return {
      cmd: process.execPath,
      args: [path.join(root, "maestro", "fake-exec.mjs"), goal],
      env: base,
    };
  }

  // default: grok (Grok Build CLI — SuperGrok subscription).
  // -p/--single = headless real: roda o loop agêntico, imprime resumo limpo e SAI.
  // (goal posicional abre a TUI interativa — era a causa do hang + ANSI soup)
  return {
    cmd: resolveBin("grok"),
    args: [
      "-p",
      goal,
      "--cwd",
      root,
      "--always-approve",
      "--permission-mode",
      "bypassPermissions",
      "--max-turns",
      String(maxTurns),
      "--check",
    ],
    env: base,
  };
}
