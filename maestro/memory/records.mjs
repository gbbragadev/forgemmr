import crypto from "node:crypto";
import path from "node:path";
import { makeRedactor } from "../adapters.mjs";
import { resolveMemoryScope } from "./scopes.mjs";

export const MEMORY_TYPES = Object.freeze([
  "decision",
  "error-resolution",
  "verification",
  "handoff",
  "product-learning",
  "rule",
  "outcome",
]);

const TYPE_CONFIG = Object.freeze({
  decision: { directory: "decisions", title: "Decisão", kind: "decision", tier: "semantic" },
  "error-resolution": { directory: "error-resolutions", title: "Erro resolvido", kind: "gotcha", tier: "episodic" },
  verification: { directory: "verifications", title: "Verificação", kind: "fact", tier: "episodic" },
  handoff: { directory: "handoffs", title: "Handoff", kind: "fact", tier: "episodic" },
  "product-learning": { directory: "product-learnings", title: "Aprendizado de produto", kind: "fact", tier: "semantic" },
  rule: { directory: "rules", title: "Regra", kind: "rule", tier: "procedural" },
  outcome: { directory: "outcomes", title: "Resultado", kind: "fact", tier: "episodic" },
});

const SENSITIVITY = new Set(["public", "internal", "restricted"]);

function optionalText(value, label, max = 256) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} inválido no registro de memória.`);
  }
  return value;
}

function normalizeEvidenceRefs(refs, redact) {
  if (refs === undefined) return Object.freeze([]);
  if (!Array.isArray(refs) || refs.length > 50) {
    throw new Error("evidenceRefs inválido no registro de memória.");
  }
  const normalized = refs.map((ref) => {
    if (typeof ref !== "string" || ref.length < 1 || ref.length > 500 || /[\r\n\0]/.test(ref)) {
      throw new Error("evidenceRef inválido no registro de memória.");
    }
    const value = ref.trim().replaceAll("\\", "/");
    if (
      !value
      || path.posix.isAbsolute(value)
      || /^[A-Za-z]:\//.test(value)
      || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      || value.split("/").some((segment) => segment === "..")
    ) {
      throw new Error("evidenceRef fora do root lógico da fábrica.");
    }
    return String(redact(value));
  });
  return Object.freeze([...new Set(normalized)]);
}

export function buildMemoryRecord(input = {}) {
  if (!MEMORY_TYPES.includes(input.type)) {
    throw new Error("Tipo desconhecido no registro de memória.");
  }
  if (typeof input.summary !== "string" || input.summary.trim().length < 1) {
    throw new Error("summary é obrigatório no registro de memória.");
  }
  if (Buffer.byteLength(input.summary, "utf8") > 8_000) {
    throw new Error("summary excede 8000 bytes.");
  }

  const redact = typeof input.redact === "function" ? input.redact : makeRedactor();
  const summary = String(redact(input.summary)).trim();
  if (!summary) throw new Error("summary ficou vazio após redaction.");
  if (Buffer.byteLength(summary, "utf8") > 8_000) {
    throw new Error("summary redigido excede 8000 bytes.");
  }
  const scope = resolveMemoryScope({ appId: input.appId });
  const observedAt = input.observedAt || new Date().toISOString();
  if (Number.isNaN(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) {
    throw new Error("observedAt inválido no registro de memória.");
  }
  const sensitivity = input.sensitivity || "internal";
  if (!SENSITIVITY.has(sensitivity)) {
    throw new Error("sensitivity inválida no registro de memória.");
  }

  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs, redact);
  const identity = {
    schemaVersion: 1,
    type: input.type,
    ...scope,
    appId: optionalText(input.appId, "appId", 64),
    runId: optionalText(input.runId, "runId"),
    job: optionalText(input.job, "job"),
    actor: optionalText(input.actor || "forge", "actor", 128),
    summary,
    evidenceRefs,
    outcome: optionalText(input.outcome, "outcome", 128),
    sensitivity,
  };
  const sourceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");

  return Object.freeze({
    ...identity,
    observedAt,
    sourceHash,
  });
}

export function recordPath(record) {
  const config = TYPE_CONFIG[record?.type];
  if (!config || !/^[a-f0-9]{64}$/.test(record.sourceHash)) {
    throw new Error("Registro de memória inválido para path.");
  }
  return `${config.directory}/${record.sourceHash}.md`;
}

function inlineCode(value) {
  return String(value ?? "—").replaceAll("`", "ˋ");
}

export function recordMarkdown(record) {
  const config = TYPE_CONFIG[record?.type];
  if (!config) throw new Error("Registro de memória inválido para Markdown.");
  const evidence = record.evidenceRefs.length
    ? record.evidenceRefs.map((ref) => `- \`${inlineCode(ref)}\``).join("\n")
    : "- Nenhuma evidência anexada.";
  return [
    `# ${config.title}`,
    "",
    "## Resumo",
    "",
    record.summary,
    "",
    "## Contexto",
    "",
    `- App: \`${inlineCode(record.appId || "factory")}\``,
    `- Run: \`${inlineCode(record.runId)}\``,
    `- Job: \`${inlineCode(record.job)}\``,
    `- Ator: \`${inlineCode(record.actor)}\``,
    `- Resultado: \`${inlineCode(record.outcome)}\``,
    "",
    "## Evidências",
    "",
    evidence,
    "",
    "## Metadados",
    "",
    `- Tipo: \`${record.type}\``,
    `- Escopo: \`${record.workspace}/${record.project}\``,
    `- Observado em: \`${record.observedAt}\``,
    `- Sensibilidade: \`${record.sensitivity}\``,
    `- Source hash: \`${record.sourceHash}\``,
    "",
  ].join("\n");
}

export function recordToPage(record) {
  const config = TYPE_CONFIG[record?.type];
  if (!config) throw new Error("Registro de memória inválido para página.");
  return {
    workspace: record.workspace,
    project: record.project,
    path: recordPath(record),
    body: recordMarkdown(record),
    title: config.title,
    kind: config.kind,
    tier: config.tier,
    tags: ["forge", record.type, record.appId ? `app:${record.appId}` : "factory"],
    pinned: record.type === "rule",
  };
}
