import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writePrivateFile } from "../adapters.mjs";

const BACKOFF_MS = [1_000, 2_000, 5_000, 15_000];
const MAX_BACKOFF_MS = 60_000;

function redactDeep(value, redact) {
  if (typeof value === "string") return String(redact(value));
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, redact));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactDeep(item, redact)]),
    );
  }
  return value;
}

export function createMemoryOutbox({
  file,
  redact = (value) => String(value),
  now = Date.now,
} = {}) {
  if (typeof file !== "string" || !path.isAbsolute(file)) {
    throw new Error("Path absoluto da outbox de memória é obrigatório.");
  }

  let entries = [];
  let draining = null;

  function load() {
    if (!fs.existsSync(file)) return;
    const seen = new Set();
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const hash = entry?.record?.sourceHash;
        if (!/^[a-f0-9]{64}$/.test(hash) || seen.has(hash)) continue;
        seen.add(hash);
        entries.push({
          record: redactDeep(entry.record, redact),
          attempts: Number.isInteger(entry.attempts) && entry.attempts >= 0 ? entry.attempts : 0,
          nextAttemptAt: Number.isFinite(entry.nextAttemptAt) ? entry.nextAttemptAt : 0,
          lastError: entry.lastError ? String(redact(entry.lastError)).slice(0, 400) : null,
        });
      } catch {
        // Uma linha truncada não impede a recuperação das entradas válidas.
      }
    }
  }

  function persist() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const temp = `${file}.tmp-${suffix}`;
    const content = entries.length
      ? `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`
      : "";
    try {
      writePrivateFile(temp, content);
      fs.renameSync(temp, file);
      fs.chmodSync(file, 0o600);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  function enqueue(record) {
    if (!/^[a-f0-9]{64}$/.test(record?.sourceHash)) {
      throw new Error("Registro inválido para a outbox de memória.");
    }
    if (entries.some((entry) => entry.record.sourceHash === record.sourceHash)) return false;
    entries.push({
      record: redactDeep(record, redact),
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    });
    persist();
    return true;
  }

  function size() {
    return entries.length;
  }

  function list() {
    return structuredClone(entries);
  }

  async function performDrain(writer, { force = false } = {}) {
    if (typeof writer !== "function") throw new Error("Writer da outbox é obrigatório.");
    const result = { attempted: 0, sent: 0, failed: 0, pending: entries.length };
    const candidates = entries.map((entry) => entry.record.sourceHash);
    for (const hash of candidates) {
      const index = entries.findIndex((entry) => entry.record.sourceHash === hash);
      if (index < 0) continue;
      const entry = entries[index];
      if (!force && entry.nextAttemptAt > now()) continue;
      result.attempted += 1;
      try {
        await writer(structuredClone(entry.record));
        entries.splice(index, 1);
        result.sent += 1;
      } catch (error) {
        entry.attempts += 1;
        const delay = BACKOFF_MS[entry.attempts - 1] ?? MAX_BACKOFF_MS;
        entry.nextAttemptAt = now() + Math.min(delay, MAX_BACKOFF_MS);
        entry.lastError = String(redact(error instanceof Error ? error.message : error)).slice(0, 400);
        result.failed += 1;
      }
      persist();
    }
    result.pending = entries.length;
    return result;
  }

  function drain(writer, options) {
    if (draining) return draining;
    draining = performDrain(writer, options).finally(() => {
      draining = null;
    });
    return draining;
  }

  load();

  return { enqueue, drain, size, list };
}
