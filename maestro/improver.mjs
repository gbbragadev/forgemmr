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
import { buildSpawn, makeRedactor, stripAnsi } from "./adapters.mjs";
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
    "SAÍDA (obrigatória): escreva UM arquivo JSON válido em:",
    outFile,
    'Formato exato: {"prompt": "<prompt melhorado, completo>", "skills": ["nome"], "agents": ["nome"], "notes": "<1 linha do que mudou>"}',
    "Não imprima o prompt no stdout — grave o arquivo. Depois responda só 'ok'.",
  ].join("\n");
}

/** Valida a saída do improver. Devolve null se inválida (→ fallback pro original). */
export function parseImproved(raw, original) {
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
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
  const fallback = { prompt, improved: false, skills: [], agents: [] };
  if (!cfg || !cfg.enabled) return fallback;

  const dir = path.join(root, "maestro", "runs", String(runId || "improve"));
  const stamp = `${job.replace("/", "-")}-${Date.now()}`;
  const outFile = path.join(dir, `${stamp}.improved.json`);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}

  const sup = supportsToolbox(player);
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
    log(`· prompt-improver indisponível (${String(e).slice(0, 80)}) — usando prompt original`);
    return fallback;
  }
  // o fake-exec (dry-run/teste) escreve o JSON a partir do meta-prompt, sem gastar quota
  spec.env = { ...spec.env, FORGE_IMPROVE_OUTFILE: outFile };

  const t0 = Date.now();
  log(`✎ prompt-improver (${cfg.cli}${cfg.model ? " · " + cfg.model : ""}${cfg.effort ? " " + String(cfg.effort).toUpperCase() : ""}) → ${job}`);

  const exitCode = await new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(spec.cmd, spec.args, { cwd: root, env: spec.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve(-1);
      return;
    }
    const redact = makeRedactor();
    let tail = "";
    const onChunk = (b) => {
      tail = (tail + redact(stripAnsi(String(b)))).slice(-2000);
    };
    proc.stdout?.on("data", onChunk);
    proc.stderr?.on("data", onChunk);
    proc.on("error", () => resolve(-1));
    const timer = setTimeout(() => {
      try {
        if (process.platform === "win32" && proc.pid) spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { shell: true });
        else proc.kill("SIGTERM");
      } catch {}
      resolve(-2);
    }, cfg.timeoutMs || 5 * 60 * 1000);
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 0);
    });
  });

  if (exitCode === -2) log("· prompt-improver: timeout — usando prompt original");

  let improved = null;
  try {
    if (fs.existsSync(outFile)) improved = parseImproved(fs.readFileSync(outFile, "utf8"), prompt);
  } catch {}

  if (!improved) {
    log(`· prompt-improver não produziu prompt válido (exit ${exitCode}) — usando o original`);
    return fallback;
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
