import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export class MemoryGatewayError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "MemoryGatewayError";
    this.status = status;
  }
}

function requiredSegment(value, label) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 128
    || value === "."
    || value === ".."
    || /[\\/\0]/.test(value)
  ) {
    throw new MemoryGatewayError(400, `${label} inválido.`);
  }
  return encodeURIComponent(value);
}

function pagePath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || value.includes("\\")) {
    throw new MemoryGatewayError(400, "Path de memória inválido.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new MemoryGatewayError(400, "Path de memória inválido.");
  }
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function boundedLimit(value, fallback = 10) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new MemoryGatewayError(400, "limit deve ser um inteiro entre 1 e 50.");
  }
  return value;
}

function searchQuery(value) {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 500) {
    throw new MemoryGatewayError(400, "A busca deve conter entre 1 e 500 caracteres.");
  }
  return value.trim();
}

export function createMemoryGateway({
  endpoint,
  getToken,
  fetchImpl = fetch,
  timeoutMs = 5_000,
} = {}) {
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "http:" || parsedEndpoint.hostname !== "127.0.0.1") {
    throw new Error("O gateway de memória exige endpoint loopback HTTP.");
  }
  const base = parsedEndpoint.origin;
  if (typeof getToken !== "function") throw new Error("getToken é obrigatório.");

  function token() {
    const value = getToken();
    if (typeof value !== "string" || value.length < 1) {
      throw new MemoryGatewayError(503, "Token interno do ai-memory indisponível.");
    }
    return value;
  }

  function sanitize(message, secret) {
    return String(message || "Resposta inválida do ai-memory")
      .replaceAll(secret, "[REDACTED]")
      .slice(0, 400);
  }

  async function request(pathname, { method = "GET", body } = {}) {
    const secret = token();
    let response;
    try {
      response = await fetchImpl(base + pathname, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secret}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      throw new MemoryGatewayError(
        timedOut ? 504 : 502,
        timedOut
          ? "Tempo esgotado ao consultar o ai-memory."
          : "Não foi possível alcançar o ai-memory local.",
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new MemoryGatewayError(
        response.status,
        sanitize(payload?.error || `ai-memory respondeu HTTP ${response.status}.`, secret),
      );
    }
    if (payload === null) {
      throw new MemoryGatewayError(502, "Resposta inválida do ai-memory.");
    }
    return payload;
  }

  async function status() {
    return request("/admin/status");
  }

  async function overview({ workspace, project, limit } = {}) {
    const workspacePart = requiredSegment(workspace, "workspace");
    const route = project
      ? `/api/v1/workspaces/${workspacePart}/projects/${requiredSegment(project, "project")}/overview`
      : `/api/v1/workspaces/${workspacePart}/overview`;
    return request(`${route}?limit=${boundedLimit(limit)}`);
  }

  async function search({ q, workspace, project, limit } = {}) {
    requiredSegment(workspace, "workspace");
    const params = new URLSearchParams({
      q: searchQuery(q),
      limit: String(boundedLimit(limit)),
    });
    if (project) {
      params.set("workspace", workspace);
      params.set("project", project);
      requiredSegment(project, "project");
    }
    return request(`/api/v1/search?${params.toString()}`);
  }

  async function briefing({ workspace, project, limit } = {}) {
    const route = `/api/v1/workspaces/${requiredSegment(workspace, "workspace")}`
      + `/projects/${requiredSegment(project, "project")}/briefing`;
    return request(`${route}?limit=${boundedLimit(limit)}`);
  }

  async function readPage({ workspace, project, pagePath: requestedPath } = {}) {
    const route = `/api/v1/workspaces/${requiredSegment(workspace, "workspace")}`
      + `/projects/${requiredSegment(project, "project")}`
      + `/pages/${pagePath(requestedPath)}`;
    return request(route);
  }

  async function writePage(input = {}) {
    const payload = {
      workspace: input.workspace,
      project: input.project,
      path: input.path,
      body: input.body,
      title: input.title,
      kind: input.kind,
      tier: input.tier,
      tags: input.tags,
      pinned: input.pinned,
    };
    requiredSegment(payload.workspace, "workspace");
    requiredSegment(payload.project, "project");
    pagePath(payload.path);
    if (typeof payload.body !== "string" || payload.body.length > 5_000_000) {
      throw new MemoryGatewayError(400, "Body da página de memória inválido.");
    }
    for (const field of ["title", "kind", "tier"]) {
      if (payload[field] !== undefined && typeof payload[field] !== "string") {
        throw new MemoryGatewayError(400, `${field} da página de memória inválido.`);
      }
    }
    if (
      payload.tags !== undefined
      && (!Array.isArray(payload.tags)
        || payload.tags.length > 32
        || payload.tags.some((tag) => typeof tag !== "string" || tag.length > 64))
    ) {
      throw new MemoryGatewayError(400, "Tags da página de memória inválidas.");
    }
    if (payload.pinned !== undefined && typeof payload.pinned !== "boolean") {
      throw new MemoryGatewayError(400, "pinned da página de memória inválido.");
    }
    return request("/admin/write-page", { method: "POST", body: payload });
  }

  async function deletePage({ workspace, project, pagePath: requestedPath } = {}) {
    requiredSegment(workspace, "workspace");
    requiredSegment(project, "project");
    pagePath(requestedPath);
    return request("/admin/delete-page", {
      method: "POST",
      body: { workspace, project, path: requestedPath },
    });
  }

  async function backup({ target } = {}) {
    if (typeof target !== "string" || !path.isAbsolute(target) || !target.endsWith(".tar.gz")) {
      throw new MemoryGatewayError(400, "Destino interno do backup inválido.");
    }
    const secret = token();
    let response;
    try {
      response = await fetchImpl(`${base}/admin/backup`, {
        method: "POST",
        headers: {
          Accept: "application/gzip",
          Authorization: `Bearer ${secret}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      throw new MemoryGatewayError(
        timedOut ? 504 : 502,
        timedOut ? "Tempo esgotado ao criar backup." : "Não foi possível criar backup.",
      );
    }
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null);
      throw new MemoryGatewayError(
        response.status || 502,
        sanitize(payload?.error || "Backup recusado pelo ai-memory.", secret),
      );
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        fs.createWriteStream(temp, { flags: "wx", mode: 0o600 }),
      );
      fs.chmodSync(temp, 0o600);
      fs.renameSync(temp, target);
      return { file: path.basename(target), bytes: fs.statSync(target).size };
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  return {
    status,
    overview,
    search,
    briefing,
    readPage,
    writePage,
    deletePage,
    backup,
  };
}
