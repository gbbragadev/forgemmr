import fs from "node:fs";
import path from "node:path";

const PROTECTED = /\b(auth|autentica|billing|pagamento|payment|preco|pricing|banco de dados|database|migracao|migration|segredo|secret|credencial|deploy|dominio|domain|juridic|legal|security|seguranca|excluir dados|delete data)\b/i;

export function simulationArtifactPaths(root, pipeline) {
  const directory = path.join(root, "apps", pipeline.appId, "docs", "simulations");
  return {
    directory,
    json: path.join(directory, `${pipeline.runId}.json`),
    html: path.join(directory, `${pipeline.runId}.html`),
  };
}

export function validateSimulationReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return { pass: false, detail: "relatório JSON inválido" };
  if (!String(report.verdict || "").trim()) return { pass: false, detail: "relatório sem verdict" };
  if (!report.biggest_leak || typeof report.biggest_leak !== "object") return { pass: false, detail: "relatório sem biggest_leak" };
  if (!Array.isArray(report.personas) || report.personas.length !== 5) return { pass: false, detail: "relatório precisa de exatamente cinco personas" };
  if (report.personas.some((persona) => !persona?.name || !Number.isFinite(Number(persona.score)))) {
    return { pass: false, detail: "persona sem nome ou simulated decision score" };
  }
  if (!Array.isArray(report.fixes) || report.fixes.length < 5) return { pass: false, detail: "relatório precisa de cinco correções priorizadas" };
  const disclaimer = String(report.limits || []).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/(simulation|simulacao)/.test(disclaimer) || !/(not observed|nao.*observ|not.*research|nao.*pesquisa|real user|usuarios reais)/.test(disclaimer)) {
    return { pass: false, detail: "limits precisa dizer que a simulação não é pesquisa real nem comportamento observado" };
  }
  return { pass: true, detail: "cinco personas, fixes e limites explícitos" };
}

export function selectAutomaticFixes(report, { limit = 3 } = {}) {
  return (report?.fixes || [])
    .filter((fix) => fix && fix.auto_apply === true)
    .filter((fix) => /^(high|medium)$/i.test(String(fix.impact || "")))
    .filter((fix) => /^high$/i.test(String(fix.confidence || "")))
    .filter((fix) => /^(small|medium|low)$/i.test(String(fix.effort || "")))
    .filter((fix) => !PROTECTED.test(`${fix.change || ""} ${fix.detail || ""} ${fix.protected_reason || ""}`))
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999))
    .slice(0, Math.max(0, Math.min(Number(limit) || 3, 3)));
}

export function applySimulationResult({ root, pipeline }) {
  const artifacts = simulationArtifactPaths(root, pipeline);
  const report = JSON.parse(fs.readFileSync(artifacts.json, "utf8"));
  const validation = validateSimulationReport(report);
  if (!validation.pass) throw new Error(validation.detail);
  const alreadyUsed = Boolean(pipeline.simulationAutoIterationUsed);
  const autoFixes = alreadyUsed ? [] : selectAutomaticFixes(report);
  pipeline.simulationCompleted = true;
  pipeline.simulation = {
    reportJson: path.relative(root, artifacts.json),
    reportHtml: path.relative(root, artifacts.html),
    verdict: String(report.verdict).slice(0, 500),
    selectedAutoFixes: autoFixes.map((fix) => String(fix.change)),
    completedAt: new Date().toISOString(),
  };
  if (autoFixes.length) {
    pipeline.simulationAutoIterationUsed = true;
    pipeline.simulationAutoIterationPending = true;
    pipeline.feedbackText = [
      "Correções selecionadas pelo Startup User Simulator (uma única rodada automática):",
      ...autoFixes.map((fix, index) => `${index + 1}. ${fix.change}`),
      "Não altere auth, billing, dados, deploy, domínio, segurança ou decisões legais.",
    ].join("\n");
    const insertAt = pipeline.jobIndex + 1;
    pipeline.jobs.splice(insertAt, 0, "ITERATE", "L1/B5");
  }
  return { validation, autoFixes, artifacts, report };
}
