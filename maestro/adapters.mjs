/**
 * Executor adapters — matriz de spawn por CLI (subscription only) + sanitização de stream.
 *
 * Compartilhado por server.mjs (/api/run) e engine.mjs (pipeline autopilot).
 * policy.coding = subscription_cli_only: nenhum adapter usa API paga por chamada.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const MAESTRO_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Grava conteúdo sensível com permissão restrita, inclusive ao sobrescrever arquivo existente. */
export function writePrivateFile(file, content) {
  fs.writeFileSync(file, content, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

/** Abre log sensível truncando-o e garantindo permissão 0600. */
export function openPrivateFile(file) {
  const fd = fs.openSync(file, "w", 0o600);
  fs.chmodSync(file, 0o600);
  return fd;
}

/** Anexa uma linha a um arquivo sensível sem relaxar a permissão existente. */
export function appendPrivateFile(file, content) {
  const fd = fs.openSync(file, "a", 0o600);
  try {
    fs.writeFileSync(fd, content, "utf8");
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(file, 0o600);
}

/** Prompts externalizados são temporários e não sobrevivem a um run bem-sucedido. */
export function cleanupExternalizedPrompts(root) {
  fs.rmSync(path.join(root, "maestro", ".prompts"), { recursive: true, force: true });
}

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
  if (name === "agy" || name === "agy.exe") {
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const p = path.join(local, "agy", "bin", isWin ? "agy.exe" : "agy");
    if (fs.existsSync(p)) return p;
  }
  return name;
}

/**
 * Redator de segredos: mascara valores de env sensíveis antes de qualquer
 * escrita em log/raw log (ex.: wrangler ecoando token em mensagem de erro).
 */
export function makeRedactor() {
  // pattern-based: qualquer env com cara de credencial entra, sem manter whitelist na mão
  // (_ADM cobre o token de escrita CF_GBBRAGADEV_ADM). Lista fixa mantida como piso.
  const NAME_RE = /(API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|_ADM$)/i;
  const names = new Set([
    "GLM_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "OPEN_ROUTER_API_KEY",
    "OPENROUTER_API_KEY",
    "ZAI_API_KEY",
    "GITHUB_TOKEN",
  ]);
  for (const k of Object.keys(process.env)) if (NAME_RE.test(k)) names.add(k);
  const secrets = [...names]
    .map((k) => process.env[k])
    .filter((v) => v && v.length >= 8)
    .sort((a, b) => b.length - a.length); // maiores primeiro: segredo contido em outro não deixa resíduo
  return (s) => {
    let out = String(s);
    for (const v of secrets) out = out.split(v).join("[redacted]");
    return out;
  };
}

/**
 * Sinais de rate-limit/quota/indisponibilidade → L2 automático (cooldown + fallback player).
 * Inclui 529/503 e "overloaded": o GLM (api.z.ai) devolve `API Error: 529 ... temporarily overloaded`,
 * que o forge contava como falha de trabalho e queimava as 3 tentativas do player.
 */
export function detectRateLimit(text) {
  return /(?:^|\r?\n)\s*(?:API Error:\s*(?:429|529)\b|(?:HTTP\s+)?503\s+Service Unavailable\b|Error:\s+(?:(?:usage |quota |rate.?|)limit (?:reached|exceeded)|quota exceeded|overloaded_error)\b|quota reached(?=\s*(?:[.;]|$))|temporarily overloaded(?=[^\r\n]*(?:retry|try again))|429\s+rate.?limit exceeded\b)|\brate.?limit exceeded\b/im.test(
    String(text)
  );
}

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
const EMPTY_MCP = path.join(HOME, ".claude", "empty-mcp.json");

/**
 * Monta { cmd, args, env } para um executor headless.
 * @param {string} cli grok | claude | glm | codex | gemini | bernstein | fake
 * @param {string} goal prompt completo do job
 * @param {{ root: string, maxTurns?: number, model?: string, effort?: string }} opts
 */
/**
 * Windows limita a linha de comando a ~32767 chars — prompt grande (ideia longa + system design +
 * design system colados) estourava com `spawn ENAMETOOLONG`, exit 1 em 0s e log vazio.
 * Acima do limite seguro, o prompt vai pra um arquivo e o CLI recebe só a referência.
 */
const ARG_SAFE_LIMIT = 6000;

export function externalizePrompt(goal, root) {
  const text = String(goal);
  if (text.length <= ARG_SAFE_LIMIT) return { goal: text, file: null };
  const dir = path.join(root, "maestro", ".prompts");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`);
  writePrivateFile(file, text);
  const short = [
    `PROMPT_FILE: ${file}`,
    "",
    "Esse arquivo contém o SEU prompt completo deste job (não coube na linha de comando).",
    "LEIA o arquivo AGORA (primeira ação) e execute exatamente o que está nele. Não peça confirmação.",
  ].join("\n");
  return { goal: short, file };
}

export function buildSpawn(cli, goal, opts) {
  const { root, maxTurns = 30, model, effort } = opts;
  const ext = externalizePrompt(goal, root);
  goal = ext.goal;
  // effort é REAL onde o CLI expõe (grok --effort · codex -c model_reasoning_effort);
  // em claude/glm/gemini (-p sem flag de effort) fica como etiqueta. Sanitiza p/ argv.
  const safeEffort = effort && /^[a-z]+$/.test(effort) && effort !== "default" ? effort : null;
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
        ...(model && model !== "default" ? ["--model", model] : []),
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
        model && model !== "default" ? model : "opus",
        "--dangerously-skip-permissions",
        "--max-turns",
        String(maxTurns),
        ...mcpOff,
      ],
      env,
    };
  }

  if (cli === "codex") {
    // Codex CLI (OpenAI, subscription/OAuth). Modelo + effort são REAIS aqui:
    // -m escolhe o tier (gpt-5.6-sol/terra/luna); model_reasoning_effort vai via -c.
    // Default do projeto = gpt-5.6-sol · medium (setado no roster.json).
    // Sandbox: o helper do Windows (codex-windows-sandbox-setup.exe) não existe nesta máquina — com
    // --full-auto o codex não conseguia ler NEM escrever arquivo (exit 0 sem fazer nada). Default =
    // sem sandbox, alinhado aos demais executores (grok/claude/glm/gemini já rodam com permissões
    // bypassadas — é o contrato do autopilot). Com o helper instalado, religue o sandbox por env:
    //   FORGE_CODEX_SANDBOX=workspace-write  (ou read-only)
    const codexSandbox = process.env.FORGE_CODEX_SANDBOX;
    const codexPolicy = /^[a-z-]+$/.test(codexSandbox || "")
      ? ["--sandbox", codexSandbox, "--ask-for-approval", "never"]
      : ["--dangerously-bypass-approvals-and-sandbox"];
    return {
      cmd: "codex",
      args: [
        "exec",
        ...codexPolicy,
        ...(model && model !== "default" ? ["-m", model] : []),
        ...(safeEffort ? ["-c", `model_reasoning_effort=${safeEffort}`] : []),
        goal.replace(/\r?\n/g, " "),
      ],
      env: base,
    };
  }

  if (cli === "gemini") {
    // Gemini roda via Antigravity CLI (agy) — o binário `gemini` foi descontinuado.
    // Flags REAIS (verificadas em `agy --help`): -p = 1 prompt headless que imprime a resposta;
    // --dangerously-skip-permissions = auto-aprova permissões de tool (edita arquivos).
    // ponytail: se um dia `-p` só responder sem editar, trocar por --prompt-interactive num pty —
    //   sem evidência disso hoje; player é opcional e não está em nenhum team default.
    const agy = resolveBin("agy");
    if (agy === "agy") {
      const local = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
      throw new Error(
        `agy.exe não encontrado em ${path.join(local, "agy", "bin")} — instale o Antigravity CLI; player gemini indisponível`
      );
    }
    return {
      cmd: agy,
      args: [
        "-p",
        goal.replace(/\r?\n/g, " "),
        "--dangerously-skip-permissions",
        ...(model && model !== "default" ? ["--model", model] : []),
      ],
      env: base,
    };
  }

  if (cli === "bernstein") {
    return { cmd: "bernstein", args: ["-g", goal.replace(/\r?\n/g, " · ")], env: base };
  }

  if (cli === "fake") {
    // Dry-run: gera artefatos esperados sem tocar em código real.
    // Script sempre do maestro real; artefatos vão pro root do run (FORGE_ROOT) — permite tmp-root em teste.
    return {
      cmd: process.execPath,
      args: [path.join(MAESTRO_DIR, "fake-exec.mjs"), goal],
      env: { ...base, FORGE_ROOT: root, ...(ext.file ? { FORGE_PROMPT_FILE: ext.file } : {}) },
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
      ...(safeEffort ? ["--effort", safeEffort] : []),
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
