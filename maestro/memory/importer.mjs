import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writePrivateFile } from "../adapters.mjs";

const MAX_SOURCE_BYTES = 512 * 1024;
const MAX_SUMMARY_BYTES = 8_000;

function inside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function relativeName(root, file) {
  if (!inside(root, file)) throw new Error("Fonte de importação fora do root lógico.");
  return path.relative(root, file).replaceAll("\\", "/");
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  let bytes = 0;
  for (const char of String(value)) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > maxBytes) break;
    result += char;
    bytes += size;
  }
  return result;
}

function safePipeline(raw) {
  const appId = typeof raw?.appId === "string" && /^[a-z0-9-]+$/.test(raw.appId)
    ? raw.appId
    : null;
  if (!appId) return null;
  return {
    appId,
    status: typeof raw.status === "string" ? raw.status : null,
    job: typeof raw.currentJob === "string" ? raw.currentJob : null,
    gates: Array.isArray(raw.gates)
      ? raw.gates.map((gate) => ({
          id: typeof gate?.id === "string" ? gate.id : null,
          decision: typeof gate?.decision === "string" ? gate.decision : null,
          createdAt: typeof gate?.createdAt === "string" ? gate.createdAt : null,
          decidedAt: typeof gate?.decidedAt === "string" ? gate.decidedAt : null,
        }))
      : [],
    history: Array.isArray(raw.history)
      ? raw.history.map((entry) => ({
          job: typeof entry?.job === "string" ? entry.job : null,
          pass: typeof entry?.pass === "boolean" ? entry.pass : null,
          startedAt: typeof entry?.startedAt === "string" ? entry.startedAt : null,
          endedAt: typeof entry?.endedAt === "string" ? entry.endedAt : null,
        }))
      : [],
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    endedAt: typeof raw.endedAt === "string" ? raw.endedAt : null,
  };
}

export function createMemoryImporter({
  root,
  redact = (value) => String(value),
  writeRecord,
  checkpointPath,
  now = () => new Date(),
} = {}) {
  if (!root || !fs.existsSync(root)) throw new Error("Root da importação de memória inválido.");
  if (typeof writeRecord !== "function") throw new Error("writeRecord é obrigatório no importador.");
  if (!checkpointPath || !path.isAbsolute(checkpointPath) || inside(root, checkpointPath)) {
    throw new Error("Checkpoint da importação deve ficar fora do checkout.");
  }

  const previews = new Map();

  function redactContent(value) {
    return String(redact(value))
      .replace(
        /\b([A-Z][A-Z0-9_]*(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH))\s*[:=]\s*([^\s`"']+)/gi,
        "$1=[REDACTED]",
      )
      .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
  }

  function markdownCandidate(file, { kind = "fact", type = "product-learning" } = {}) {
    if (!fs.existsSync(file)) return null;
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SOURCE_BYTES) return null;
    const relative = relativeName(root, file);
    const content = redactContent(fs.readFileSync(file, "utf8"));
    return makeCandidate({
      path: relative,
      kind,
      type,
      project: "factory",
      appId: null,
      content,
      bytes: stat.size,
      observedAt: stat.mtime.toISOString(),
    });
  }

  function makeCandidate(input) {
    const sourceHash = crypto.createHash("sha256").update(JSON.stringify({
      path: input.path,
      kind: input.kind,
      type: input.type,
      project: input.project,
      appId: input.appId,
      content: input.content,
    })).digest("hex");
    return { ...input, sourceHash };
  }

  function walkMarkdown(dir) {
    if (!fs.existsSync(dir)) return [];
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (!inside(root, file)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) result.push(...walkMarkdown(file));
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const candidate = markdownCandidate(file);
        if (candidate) result.push(candidate);
      }
    }
    return result;
  }

  function pipelineCandidates() {
    const dir = path.join(root, "maestro", "pipelines");
    if (!fs.existsSync(dir)) return [];
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) continue;
      const file = path.join(dir, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.size > MAX_SOURCE_BYTES) continue;
      try {
        const summary = safePipeline(JSON.parse(fs.readFileSync(file, "utf8")));
        if (!summary) continue;
        const content = redactContent(JSON.stringify(summary, null, 2));
        result.push(makeCandidate({
          path: relativeName(root, file),
          kind: "fact",
          type: "handoff",
          project: `app-${summary.appId}`,
          appId: summary.appId,
          content,
          bytes: stat.size,
          observedAt: stat.mtime.toISOString(),
        }));
      } catch {
        // Pipeline truncada permanece no checkout, mas não vira memória inválida.
      }
    }
    return result;
  }

  function scan() {
    const candidates = [];
    const readme = markdownCandidate(path.join(root, "README.md"));
    if (readme) candidates.push(readme);
    candidates.push(...walkMarkdown(path.join(root, "docs")));
    const handoff = markdownCandidate(path.join(root, "workbench", "HANDOFF.md"), {
      kind: "decision",
      type: "handoff",
    });
    if (handoff) candidates.push(handoff);
    const queue = markdownCandidate(path.join(root, "workbench", "QUEUE.md"), {
      kind: "fact",
      type: "handoff",
    });
    if (queue) candidates.push(queue);
    candidates.push(...pipelineCandidates());
    return candidates.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  function publicCandidate(candidate, { preview = false } = {}) {
    return {
      path: candidate.path,
      kind: candidate.kind,
      type: candidate.type,
      project: candidate.project,
      appId: candidate.appId,
      bytes: candidate.bytes,
      observedAt: candidate.observedAt,
      sourceHash: candidate.sourceHash,
      ...(preview ? { summary: truncateUtf8(candidate.content, 1_500) } : {}),
    };
  }

  function discover() {
    return scan().map((candidate) => publicCandidate(candidate));
  }

  async function preview(selection = {}) {
    const available = scan();
    const byPath = new Map(available.map((candidate) => [candidate.path, candidate]));
    let paths;
    if (selection.all === true) paths = available.map((candidate) => candidate.path);
    else if (Array.isArray(selection.paths) && selection.paths.length) paths = [...new Set(selection.paths)];
    else throw new Error("Seleção da importação exige all ou paths descobertos.");
    for (const selected of paths) {
      if (typeof selected !== "string" || !byPath.has(selected)) {
        throw new Error(`Seleção fora da descoberta permitida: ${selected}`);
      }
    }
    const selected = paths.map((item) => byPath.get(item));
    const previewId = crypto.createHash("sha256").update(JSON.stringify(
      selected.map((candidate) => [candidate.path, candidate.sourceHash]),
    )).digest("hex").slice(0, 32);
    previews.set(previewId, {
      paths: selected.map((candidate) => candidate.path),
      hashes: Object.fromEntries(selected.map((candidate) => [candidate.path, candidate.sourceHash])),
    });
    while (previews.size > 20) previews.delete(previews.keys().next().value);
    return {
      previewId,
      count: selected.length,
      entries: selected.map((candidate) => publicCandidate(candidate, { preview: true })),
    };
  }

  function loadCheckpoint() {
    try {
      const value = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
      return value?.schemaVersion === 1 && value.applied && typeof value.applied === "object"
        ? value
        : { schemaVersion: 1, applied: {} };
    } catch {
      return { schemaVersion: 1, applied: {} };
    }
  }

  function persistCheckpoint(checkpoint) {
    fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
    const temp = `${checkpointPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      writePrivateFile(temp, `${JSON.stringify(checkpoint, null, 2)}\n`);
      fs.renameSync(temp, checkpointPath);
      fs.chmodSync(checkpointPath, 0o600);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  async function apply({ previewId } = {}) {
    const approved = previews.get(String(previewId || ""));
    if (!approved) throw new Error("Prévia de importação ausente ou expirada.");
    const current = new Map(scan().map((candidate) => [candidate.path, candidate]));
    for (const selectedPath of approved.paths) {
      if (!current.has(selectedPath) || current.get(selectedPath).sourceHash !== approved.hashes[selectedPath]) {
        throw new Error(`Prévia expirada: ${selectedPath} mudou; gere uma nova prévia.`);
      }
    }

    const checkpoint = loadCheckpoint();
    const result = { imported: 0, skipped: 0, failed: 0 };
    for (const selectedPath of approved.paths) {
      const candidate = current.get(selectedPath);
      if (checkpoint.applied[candidate.sourceHash]) {
        result.skipped += 1;
        continue;
      }
      const prefix = `Importado de ${candidate.path}\n\n`;
      const summary = prefix + truncateUtf8(
        candidate.content,
        MAX_SUMMARY_BYTES - Buffer.byteLength(prefix, "utf8"),
      );
      try {
        await writeRecord({
          type: candidate.type,
          appId: candidate.appId || undefined,
          actor: "forge-import",
          summary,
          evidenceRefs: [candidate.path],
          outcome: "imported",
          observedAt: candidate.observedAt,
          sourceHash: candidate.sourceHash,
        });
        checkpoint.applied[candidate.sourceHash] = {
          path: candidate.path,
          appliedAt: toDate(now).toISOString(),
        };
        persistCheckpoint(checkpoint);
        result.imported += 1;
      } catch {
        result.failed += 1;
      }
    }
    return result;
  }

  return { discover, preview, apply };
}

function toDate(now) {
  const value = now();
  return value instanceof Date ? value : new Date(value);
}
