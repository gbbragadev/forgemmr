/**
 * Prompt improver — todo prompt de job passa por aqui ANTES de ir pro executor.
 *
 * Um modelo dedicado (default: GPT-5.6 Terra · effort high, via codex) reescreve o prompt
 * (mais específico/acionável, sem perder nenhuma restrição) e ESCOLHE as skills e os
 * subagentes (agency-*) que o executor deve usar.
 *
 * Contrato de segurança: qualquer falha (timeout, JSON inválido, prompt encolhido) → usa o
 * prompt ORIGINAL. O improver nunca bloqueia nem degrada a pipeline.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildSpawn, makeRedactor, stripAnsi, detectRateLimit } from "./adapters.mjs";
import { listAgents, listSkills, defaultAgentDirs, defaultSkillDirs, supportsToolbox } from "./toolbox.mjs";

const OPEN = "<<<PROMPT_ORIGINAL>>>";
const CLOSE = "<<<FIM_PROMPT_ORIGINAL>>>";

/** Meta-prompt do improver (puro/testável). */
export function buildImproverPrompt({ original, job, player, appId, outFile, agents, skills, supportsToolbox: sup }) {
  const cat = (list) => (list.length ? list.map((x) => `- ${x.name}: ${x.description}`).join("\n") : "- (nenhum disponível)");
  return [
    "Você é o ENGENHEIRO DE PROMPT da pipeline autônoma Forge. Sua ÚNICA tarefa é melhorar o prompt",
    `de um job antes de ele ir para o executor. NÃO execute o job, NÃO escreva código do app.`,
    "",
    `Job: ${job} · App: ${appId}`,
    `Executor alvo: ${player.name} (${player.cli}${player.modelLabel ? " · " + player.modelLabel : ""})`,
    sup
      ? "Esse executor RODA no Claude Code: pode invocar skills (Skill tool) e subagentes (Task tool)."
      : "Esse executor NÃO tem skills/subagentes — escolha-os mesmo assim (o orquestrador decide se anexa), mas o prompt deve funcionar sem eles.",
    "",
    "REGRAS DURAS (violar = falha):",
    "- NÃO remova nenhuma restrição, regra, caminho de arquivo, critério de sucesso ou instrução do original.",
    "- NÃO invente requisitos novos, tecnologias ou escopo que não estejam no original.",
    "- Preserve TODO o contexto colado (system design, design system, feedback do dono, tails de erro).",
    "- O prompt melhorado deve ser AUTOCONTIDO e >= o original em completude (pode ser mais longo, nunca mais pobre).",
    "- Melhore: ordem, especificidade, critérios verificáveis, passos concretos, armadilhas a evitar.",
    "",
    "SKILLS DISPONÍVEIS:",
    cat(skills),
    "",
    "SUBAGENTES DISPONÍVEIS:",
    cat(agents),
    "",
    "Escolha só o que agrega de verdade a ESTE job (pode ser lista vazia). Não force ferramentas.",
    "",
    OPEN,
    original,
    CLOSE,
    "",
    "SAÍDA — FAÇA AS DUAS COISAS, NESTA ORDEM:",
    `1) GRAVE (ferramenta de escrita de arquivo) um JSON válido, sozinho no arquivo, no caminho EXATO:`,
    `   ${outFile}`,
    "2) DEPOIS imprima o MESMO JSON no stdout, entre as marcas abaixo (fallback caso a escrita falhe):",
    "   <<<FORGE_JSON>>>",
    "   {...}",
    "   <<<FIM_FORGE_JSON>>>",
    "",
    'Formato exato do JSON: {"prompt": "<prompt melhorado, completo>", "skills": ["nome"], "agents": ["nome"], "notes": "<1 linha do que mudou>"}',
    "O campo prompt precisa conter o PROMPT INTEIRO (não um resumo, não um diff, não instruções sobre o prompt).",
    "Escape corretamente quebras de linha (\\n) e aspas. Não use markdown fence.",
  ].join("\n");
}

/** Extrai o JSON de uma saída suja (marcas <<<FORGE_JSON>>>, fence markdown ou objeto solto). */
export function extractJson(text) {
  const s = String(text || "");
  const marked = s.match(/<<<FORGE_JSON>>>\s*([\s\S]*?)\s*<<<FIM_FORGE_JSON>>>/);
  if (marked) return marked[1].trim();
  const fenced = s.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) return fenced[1];
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return null;
}

/** Valida a saída do improver. Devolve null se inválida (→ fallback pro original). */
export function parseImproved(raw, original) {
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    // saída suja (o CLI imprimiu texto em volta do JSON) → tenta extrair
    const inner = typeof raw === "string" ? extractJson(raw) : null;
    if (!inner) return null;
    try {
      obj = JSON.parse(inner);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj.prompt !== "string") return null;
  const prompt = obj.prompt.trim();
  // guard anti-truncamento: um prompt bem menor que o original perdeu restrições → rejeita
  if (prompt.length < Math.max(50, original.length * 0.8)) return null;
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^[\w:@./-]+$/.test(x)).slice(0, 6) : []);
  return { prompt, skills: arr(obj.skills), agents: arr(obj.agents), notes: String(obj.notes || "").slice(0, 200) };
}

/** Anexa a seção de ferramentas — só quando o executor consegue invocá-las. */
export function mergeToolbox(improved, executorSupports) {
  if (!executorSupports) return improved.prompt;
  const skills = improved.skills || [];
  const agents = improved.agents || [];
  if (!skills.length && !agents.length) return improved.prompt;
  return [
    improved.prompt,
    "",
    "---",
    "FERRAMENTAS SUGERIDAS (escolhidas pelo prompt-improver — use se agregarem, ignore se não):",
    skills.length ? `- Skills (Skill tool): ${skills.join(", ")}` : null,
    agents.length ? `- Subagentes (Task tool): ${agents.join(", ")}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Roda o improver. Sempre resolve — em qualquer falha devolve { prompt: original, improved: false }.
 * @returns {Promise<{prompt: string, improved: boolean, skills?: string[], agents?: string[], notes?: string}>}
 */
export async function improvePrompt({ root, job, appId, runId, player, prompt, cfg, log = () => {} }) {
  const original = { prompt, improved: false, skills: [], agents: [] };
  if (!cfg || !cfg.enabled) return original;

  const sup = supportsToolbox(player);
  const attempt = async (c, label) => runImprover({ root, job, appId, runId, player, prompt, cfg: c, log, sup, label });

  const first = await attempt(cfg, "");
  if (first.improved) return first;

  // fallback (ex.: limite do codex estourou) → segundo modelo antes de desistir do improve
  if (cfg.fallback && cfg.fallback.cli) {
    log(`· improver primário falhou (${first.reason}) — tentando fallback ${cfg.fallback.cli}/${cfg.fallback.model || "default"}`);
    const second = await attempt({ ...cfg.fallback, enabled: true }, "fallback");
    if (second.improved) return second;
    log(`· fallback também falhou (${second.reason}) — usando o prompt ORIGINAL`);
  }
  return original;
}

/** Uma tentativa de improve com um CLI/modelo. Nunca lança — devolve {improved, reason}. */
async function runImprover({ root, job, appId, runId, player, prompt, cfg, log, sup, label }) {
  const fallback = (reason) => ({ prompt, improved: false, skills: [], agents: [], reason });

  const dir = path.join(root, "maestro", "runs", String(runId || "improve"));
  const stamp = `${job.replace("/", "-")}-${Date.now()}${label ? "-" + label : ""}`;
  const outFile = path.join(dir, `${stamp}.improved.json`);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}

  const meta = buildImproverPrompt({
    original: prompt,
    job,
    player,
    appId,
    outFile,
    agents: listAgents(defaultAgentDirs(root)),
    skills: listSkills(defaultSkillDirs(root)),
    supportsToolbox: sup,
  });

  let spec;
  try {
    spec = buildSpawn(cfg.cli || "codex", meta, {
      root,
      maxTurns: cfg.maxTurns || 12,
      model: cfg.model && cfg.model !== "default" ? cfg.model : undefined,
      effort: cfg.effort,
    });
  } catch (e) {
    return fallback(`CLI indisponível: ${String(e).slice(0, 60)}`);
  }
  // o fake-exec (dry-run/teste) escreve o JSON a partir do meta-prompt, sem gastar quota
  spec.env = { ...spec.env, FORGE_IMPROVE_OUTFILE: outFile };

  const t0 = Date.now();
  log(`✎ prompt-improver${label ? " [" + label + "]" : ""} (${cfg.cli}${cfg.model ? " · " + cfg.model : ""}${cfg.effort ? " " + String(cfg.effort).toUpperCase() : ""}) → ${job}`);

  const rawPath = path.join(dir, `${stamp}.improve.raw.log`);
  const { exitCode, out } = await new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(spec.cmd, spec.args, { cwd: root, env: spec.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve({ exitCode: -1, out: String(e) });
      return;
    }
    const redact = makeRedactor();
    let buf = "";
    const onChunk = (b) => {
      buf = (buf + redact(stripAnsi(String(b)))).slice(-200000); // grande: o JSON de fallback vem aqui
    };
    proc.stdout?.on("data", onChunk);
    proc.stderr?.on("data", onChunk);
    proc.on("error", () => resolve({ exitCode: -1, out: buf }));
    const timer = setTimeout(() => {
      try {
        if (process.platform === "win32" && proc.pid) spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { shell: true });
        else proc.kill("SIGTERM");
      } catch {}
      resolve({ exitCode: -2, out: buf });
    }, cfg.timeoutMs || 5 * 60 * 1000);
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 0, out: buf });
    });
  });

  try {
    fs.writeFileSync(rawPath, out, "utf8"); // auditoria: dá pra ver o que o improver respondeu
  } catch {}

  let improved = null;
  try {
    if (fs.existsSync(outFile)) improved = parseImproved(fs.readFileSync(outFile, "utf8"), prompt);
  } catch {}
  // o CLI não gravou o arquivo mas imprimiu o JSON no stdout
  if (!improved && out) improved = parseImproved(out, prompt);

  if (!improved) {
    const reason =
      exitCode === -2 ? "timeout" : detectRateLimit(out) ? "rate-limit/limite da conta" : `sem JSON válido (exit ${exitCode})`;
    log(`· prompt-improver${label ? " [" + label + "]" : ""} falhou: ${reason} · saída em ${path.relative(root, rawPath)}`);
    return fallback(reason);
  }

  const finalPrompt = mergeToolbox(improved, sup);
  const secs = Math.round((Date.now() - t0) / 1000);
  const tools = [...(improved.skills || []), ...(improved.agents || [])];
  log(
    `✓ prompt melhorado em ${secs}s (${prompt.length}→${finalPrompt.length} chars)` +
      (tools.length ? ` · ferramentas: ${tools.join(", ")}${sup ? "" : " (executor não suporta — não anexadas)"}` : "")
  );
  if (improved.notes) log(`  ↳ ${improved.notes}`);
  return { prompt: finalPrompt, improved: true, skills: improved.skills, agents: improved.agents, notes: improved.notes };
}
