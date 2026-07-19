import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { writePrivateFile } from "../adapters.mjs";

export const BRAGA_SCHEMA_VERSION = 1;
export const BRAGA_HANDOFF_VERSION = 1;

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} inválido`);
  return structuredClone(value);
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} é obrigatório`);
  return value.trim();
}

function nullableMetric(value, label) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} inválido`);
  return value;
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) throw new Error(`${label} inválido`);
  return [...value];
}

export function canonicalJson(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.keys(item).sort().map(key => [key, canonicalize(item[key])]),
    );
  };
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function contentHash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function buildBragaHandoff({ thesis, experiment, build, proposal, evidence, input, preparedAt }) {
  object(input, "handoff");
  const budget = object(input.budget, "budget");
  for (const field of ["requested", "approved", "ceiling"]) {
    if (!Number.isFinite(budget[field]) || budget[field] < 0) throw new Error(`budget.${field} inválido`);
  }
  if (budget.approved > budget.ceiling || budget.approved > budget.requested) throw new Error("budget aprovado excede o limite");
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  const frozenEvidence = proposal.evidenceRefs.map(id => evidenceById.get(id)).filter(Boolean);
  const counterevidence = evidence
    .filter(item => item.polarity === "contradicting" && item.verification?.decision === "verified")
    .map(item => ({ evidenceId: item.id, observation: item.observation, source: item.source }));
  const contract = {
    schemaVersion: BRAGA_SCHEMA_VERSION,
    handoffVersion: BRAGA_HANDOFF_VERSION,
    thesisId: thesis.id,
    experimentId: experiment.id,
    appId: text(build.appId, "appId"),
    icp: text(thesis.reachableSegment, "ICP"),
    buyer: text(thesis.buyer, "buyer"),
    user: text(thesis.user, "user"),
    pain: text(thesis.painfulJob, "pain"),
    counterevidence,
    offer: text(thesis.offer, "offer"),
    price: thesis.price ?? null,
    fatalAssumption: text(thesis.fatalAssumption, "fatalAssumption"),
    evidenceRefs: frozenEvidence.map(item => item.id),
    channel: text(thesis.channel, "channel"),
    testedMessage: text(input.testedMessage, "testedMessage"),
    build: {
      url: build.url ?? null,
      artifact: build.artifact ?? null,
      assets: stringList(input.assets ?? [], "assets"),
      instrumented: build.instrumentationObserved === true,
    },
    events: Array.isArray(input.events) ? structuredClone(input.events) : (() => { throw new Error("events inválido"); })(),
    baseline: object(input.baseline, "baseline"),
    successCriteria: proposal.successCriteria,
    killCriteria: proposal.killCriteria,
    timebox: text(input.timebox, "timebox"),
    budget: { requested: budget.requested, approved: budget.approved, ceiling: budget.ceiling },
    legalRestrictions: stringList(input.legalRestrictions, "legalRestrictions"),
    preparedAt,
  };
  if (!contract.build.instrumented || (!contract.build.url && !contract.build.artifact)) throw new Error("build precisa ser testável e instrumentado");
  return contract;
}

export function renderBragaMarkdown(contract) {
  return `# Handoff BragaMarketing\n\n- Tese: ${contract.thesisId}\n- App: ${contract.appId}\n- ICP: ${contract.icp}\n- Comprador: ${contract.buyer}\n- Usuário: ${contract.user}\n- Dor: ${contract.pain}\n- Oferta: ${contract.offer}\n- Canal: ${contract.channel}\n- Mensagem testada: ${contract.testedMessage}\n- Build: ${contract.build.url || contract.build.artifact}\n- Critério de sucesso: ${contract.successCriteria}\n- Critério de kill: ${contract.killCriteria}\n- Timebox: ${contract.timebox}\n- Orçamento: solicitado ${contract.budget.requested}; aprovado ${contract.budget.approved}; teto ${contract.budget.ceiling}\n- Restrições legais: ${contract.legalRestrictions.join("; ")}\n\n## Contraevidência\n\n${contract.counterevidence.length ? contract.counterevidence.map(item => `- ${item.observation} (${item.evidenceId})`).join("\n") : "- Nenhuma contraevidência verificada."}\n`;
}

export function writePreparedHandoff({ root, id, contract, markdown }) {
  const directory = path.join(root, ".control", "discovery", "handoffs");
  fs.mkdirSync(directory, { recursive: true });
  const jsonPath = path.join(directory, `${id}.json`);
  const markdownPath = path.join(directory, `${id}.md`);
  writePrivateFile(jsonPath, canonicalJson(contract));
  writePrivateFile(markdownPath, markdown);
  return { jsonPath, markdownPath };
}

export function exportPreparedHandoff({ root, target, contract }) {
  text(target, "target");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, target);
  const relative = path.relative(resolvedRoot, resolved);
  if (path.isAbsolute(target) || relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("caminho de export precisa ficar dentro do root");
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  writePrivateFile(resolved, canonicalJson(contract));
  return resolved;
}

export function validateBragaReturn(value) {
  const result = object(value, "retorno Braga");
  if (result.schemaVersion !== BRAGA_SCHEMA_VERSION) throw new Error("retorno Braga: schemaVersion inválido");
  text(result.experimentId, "experimentId");
  text(result.channel, "channel");
  object(result.window, "window");
  if (!Array.isArray(result.actions)) throw new Error("actions inválido");
  const metricNames = ["spend", "impressions", "reach", "clicks", "visits", "leads", "qualified", "responses", "calls", "registrations", "activations", "sales", "revenue"];
  for (const name of metricNames) result[name] = nullableMetric(result[name], name);
  result.rawRefs = stringList(result.rawRefs, "rawRefs");
  result.attributionLimitations = stringList(result.attributionLimitations, "attributionLimitations");
  result.anomalies = stringList(result.anomalies, "anomalies");
  text(result.recommendation, "recommendation");
  const spend = result.spend;
  result.metrics = {
    cpa: spend !== null && spend > 0 && result.leads > 0 ? spend / result.leads : null,
    cac: spend !== null && spend > 0 && result.sales > 0 ? spend / result.sales : null,
    roi: spend !== null && spend > 0 && result.revenue !== null ? (result.revenue - spend) / spend : null,
  };
  return result;
}
