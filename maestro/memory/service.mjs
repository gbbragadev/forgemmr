import fs from "node:fs";
import path from "node:path";
import { makeRedactor } from "../adapters.mjs";
import { createMemoryGateway, MemoryGatewayError } from "./gateway.mjs";
import { resolveMemoryLayout } from "./layout.mjs";
import { createMemoryOutbox } from "./outbox.mjs";
import { buildMemoryRecord, recordToPage } from "./records.mjs";
import { createMemoryRuntime } from "./runtime.mjs";
import { resolveMemoryScope } from "./scopes.mjs";

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

function toDate(now) {
  const value = now();
  return value instanceof Date ? value : new Date(value);
}

export function createMemoryService({
  root,
  layout,
  runtime,
  gateway,
  outbox,
  importer = null,
  redact = makeRedactor(),
  now = () => new Date(),
} = {}) {
  if (!root) throw new Error("root é obrigatório para o serviço de memória.");
  const memoryLayout = layout || resolveMemoryLayout();
  const memoryRuntime = runtime || createMemoryRuntime({ root, layout: memoryLayout });
  const memoryGateway = gateway || createMemoryGateway({
    endpoint: "http://127.0.0.1:49374",
    getToken: () => fs.readFileSync(memoryLayout.tokenPath, "utf8").trim(),
  });
  const memoryOutbox = outbox || createMemoryOutbox({
    file: memoryLayout.outboxPath,
    redact,
  });
  let pageCount = 0;

  function status() {
    try {
      const runtimeStatus = memoryRuntime.status();
      return {
        state: runtimeStatus.state || "unconfigured",
        version: runtimeStatus.version || "1.13.0",
        managed: Boolean(runtimeStatus.managed),
        latencyMs: Number.isFinite(runtimeStatus.latencyMs) ? runtimeStatus.latencyMs : null,
        pageCount,
        pendingOutbox: memoryOutbox.size(),
        lastHealthAt: runtimeStatus.lastHealthAt || null,
        lastError: runtimeStatus.lastError ? String(redact(runtimeStatus.lastError)).slice(0, 400) : null,
      };
    } catch (error) {
      return {
        state: "degraded",
        version: "1.13.0",
        managed: false,
        latencyMs: null,
        pageCount,
        pendingOutbox: 0,
        lastHealthAt: null,
        lastError: String(redact(error instanceof Error ? error.message : error)).slice(0, 400),
      };
    }
  }

  async function refreshStatus() {
    if (memoryRuntime.status().state !== "healthy") return status();
    try {
      const payload = await memoryGateway.status();
      const count = payload?.counts?.pages_latest;
      if (Number.isFinite(count) && count >= 0) pageCount = count;
    } catch {
      // O runtime continua sendo a fonte do health; refresh de contagem é best-effort.
    }
    return status();
  }

  const writeRecord = (record) => memoryGateway.writePage(recordToPage(record));

  async function drain({ force = false } = {}) {
    return memoryOutbox.drain(writeRecord, { force });
  }

  async function setup() {
    await memoryRuntime.setup();
    if (memoryRuntime.status().state === "healthy") {
      await refreshStatus();
      await drain({ force: true });
    }
    return status();
  }

  async function retry() {
    await memoryRuntime.ensureRunning();
    if (memoryRuntime.status().state === "healthy") {
      await refreshStatus();
      await drain();
    }
    return status();
  }

  function assertHealthy() {
    if (memoryRuntime.status().state !== "healthy") {
      throw new MemoryGatewayError(503, "Memória local ainda não está saudável.");
    }
  }

  async function overview({ appId, limit = 10 } = {}) {
    assertHealthy();
    const scope = resolveMemoryScope({ appId });
    const payload = await memoryGateway.overview({ ...scope, limit });
    const count = payload?.briefing?.counts?.pages_latest ?? payload?.counts?.pages_latest;
    if (Number.isFinite(count) && count >= 0) pageCount = count;
    return redactDeep(payload, redact);
  }

  async function search({ q, appId, limit = 20 } = {}) {
    assertHealthy();
    const scope = resolveMemoryScope({ appId });
    return redactDeep(await memoryGateway.search({ q, ...scope, limit }), redact);
  }

  async function briefing({ appId, limit = 8 } = {}) {
    if (memoryRuntime.status().state !== "healthy") return { items: [], text: "" };
    const scope = resolveMemoryScope({ appId });
    const payload = await memoryGateway.briefing({ ...scope, limit: Math.min(8, limit) });
    if (Array.isArray(payload?.items) && typeof payload?.text === "string") {
      return redactDeep({ items: payload.items.slice(0, 8), text: payload.text.slice(0, 12 * 1024) }, redact);
    }
    const count = payload?.counts?.pages_latest;
    if (Number.isFinite(count) && count >= 0) pageCount = count;
    const candidates = [
      ...(payload?.rules || []),
      ...(payload?.slots || []),
      ...(payload?.recent_pages || []),
    ];
    const seen = new Set();
    const selected = candidates.filter((item) => {
      if (!item?.path || seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    }).slice(0, Math.min(8, limit));
    const items = [];
    for (const item of selected) {
      try {
        const page = await memoryGateway.readPage({ ...scope, pagePath: item.path });
        items.push({
          path: item.path,
          title: item.title || page.title || item.path,
          kind: item.kind || page.kind || "fact",
          updatedAt: item.updated_at || page.updated_at || null,
          body: String(redact(page.body || "")).slice(0, 2_000),
        });
      } catch {
        // Uma página sumida entre snapshot e leitura não invalida o briefing todo.
      }
    }
    const text = items
      .map((item) => `### ${item.title}\n${item.body}`)
      .join("\n\n")
      .slice(0, 12 * 1024);
    return { items, text };
  }

  async function readPage({ appId, pagePath } = {}) {
    assertHealthy();
    const scope = resolveMemoryScope({ appId });
    return redactDeep(await memoryGateway.readPage({ ...scope, pagePath }), redact);
  }

  async function record(input) {
    const built = buildMemoryRecord({ ...input, redact });
    if (memoryRuntime.status().state === "healthy") {
      try {
        await writeRecord(built);
        void drain().catch(() => {});
        return { queued: false, sourceHash: built.sourceHash, path: recordToPage(built).path };
      } catch {
        // A outbox é a fronteira durável; a pipeline não herda a falha de rede.
      }
    }
    memoryOutbox.enqueue(built);
    return { queued: true, sourceHash: built.sourceHash, path: recordToPage(built).path };
  }

  function writeRule(input) {
    return record({ ...input, type: "rule", actor: input.actor || "owner", outcome: "active" });
  }

  async function deletePage({ appId, pagePath } = {}) {
    assertHealthy();
    const scope = resolveMemoryScope({ appId });
    return memoryGateway.deletePage({ ...scope, pagePath });
  }

  async function backup() {
    assertHealthy();
    const stamp = toDate(now).toISOString().replace(/[:.]/g, "-");
    const target = path.join(memoryLayout.backupsDir, `forge-nexus-memory-${stamp}.tar.gz`);
    return memoryGateway.backup({ target });
  }

  async function update() {
    await memoryRuntime.setup();
    await refreshStatus();
    return { ...status(), updated: false };
  }

  async function reindex() {
    await memoryRuntime.runMaintenance("reindex");
    await refreshStatus();
    return status();
  }

  async function importPreview(selection) {
    if (!importer?.preview) throw new MemoryGatewayError(501, "Importador de memória ainda não configurado.");
    return importer.preview(selection);
  }

  async function importApply(selection) {
    if (!importer?.apply) throw new MemoryGatewayError(501, "Importador de memória ainda não configurado.");
    return importer.apply(selection);
  }

  async function startIfInstalled() {
    await memoryRuntime.startIfInstalled();
    if (memoryRuntime.status().state === "healthy") {
      await refreshStatus();
      await drain();
    }
    return status();
  }

  async function close() {
    return memoryRuntime.stopManaged();
  }

  return {
    status,
    setup,
    retry,
    overview,
    search,
    briefing,
    readPage,
    record,
    writeRule,
    deletePage,
    backup,
    update,
    reindex,
    importPreview,
    importApply,
    startIfInstalled,
    close,
  };
}

export function createUnavailableMemoryService(error) {
  const message = error instanceof Error ? error.message : String(error || "Memória indisponível.");
  const unavailable = async () => {
    throw new MemoryGatewayError(503, message.slice(0, 400));
  };
  return {
    status: () => ({
      state: "unconfigured",
      version: "1.13.0",
      managed: false,
      latencyMs: null,
      pageCount: 0,
      pendingOutbox: 0,
      lastHealthAt: null,
      lastError: message.slice(0, 400),
    }),
    setup: unavailable,
    retry: unavailable,
    overview: unavailable,
    search: unavailable,
    briefing: async () => ({ items: [], text: "" }),
    readPage: unavailable,
    record: async () => ({ queued: false, unavailable: true }),
    writeRule: unavailable,
    deletePage: unavailable,
    backup: unavailable,
    update: unavailable,
    reindex: unavailable,
    importPreview: unavailable,
    importApply: unavailable,
    startIfInstalled: async () => null,
    close: async () => false,
  };
}
