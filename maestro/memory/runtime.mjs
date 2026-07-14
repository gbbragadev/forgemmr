import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { writePrivateFile } from "../adapters.mjs";
import { ensureRuntimeInstalled, loadRuntimeManifest } from "./installer.mjs";
import { resolveMemoryLayout } from "./layout.mjs";

const ENDPOINT = "http://127.0.0.1:49374";
const SERVE_ARGS = [
  "serve",
  "--transport",
  "http",
  "--bind",
  "127.0.0.1:49374",
  "--enable-web",
];

function isMemoryStatus(payload) {
  return Boolean(
    payload
    && typeof payload === "object"
    && /^\d+\.\d+\.\d+$/.test(payload.version)
    && typeof payload.data_dir === "string"
    && typeof payload.bind === "string"
    && payload.counts
    && typeof payload.counts === "object",
  );
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

export function createMemoryRuntime({
  root,
  layout = resolveMemoryLayout(),
  spawnImpl = spawn,
  fetchImpl = fetch,
  installer = ensureRuntimeInstalled,
  manifestLoader = loadRuntimeManifest,
  randomBytes = crypto.randomBytes,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  startupAttempts = 20,
  startupDelayMs = 250,
  healthTimeoutMs = 1_500,
  stopTimeoutMs = 5_000,
} = {}) {
  if (!root) throw new Error("root é obrigatório para o runtime de memória.");

  const runtimeInfo = manifestLoader(root);
  const publicState = {
    state: "unconfigured",
    version: runtimeInfo.manifest.version,
    endpoint: ENDPOINT,
    managed: false,
    pid: null,
    latencyMs: null,
    lastHealthAt: null,
    lastError: null,
  };

  let binaryPath = null;
  let managedChild = null;
  let token = null;
  let stopping = false;

  function status() {
    return { ...publicState };
  }

  function safeError(error, fallback = "Falha no runtime de memória.") {
    let message = error instanceof Error ? error.message : String(error || fallback);
    if (token) message = message.replaceAll(token, "[REDACTED]");
    return message.slice(0, 400) || fallback;
  }

  function ensureToken() {
    if (token) return token;
    fs.mkdirSync(layout.home, { recursive: true });
    if (fs.existsSync(layout.tokenPath)) {
      const saved = fs.readFileSync(layout.tokenPath, "utf8").trim();
      if (/^[a-f0-9]{48,}$/i.test(saved)) {
        token = saved;
        return token;
      }
    }
    token = randomBytes(24).toString("hex");
    writePrivateFile(layout.tokenPath, token);
    return token;
  }

  function childEnv() {
    return {
      PATH: process.env.PATH || "",
      SystemRoot: process.env.SystemRoot || "",
      TEMP: process.env.TEMP || "",
      TMP: process.env.TMP || "",
      USERPROFILE: process.env.USERPROFILE || "",
      AI_MEMORY_DATA_DIR: layout.dataDir,
      AI_MEMORY_SERVER_URL: ENDPOINT,
      AI_MEMORY_AUTH_TOKEN: ensureToken(),
    };
  }

  async function probe() {
    const startedAt = Date.now();
    try {
      const response = await fetchImpl(`${ENDPOINT}/admin/status`, {
        headers: { Authorization: `Bearer ${ensureToken()}` },
        signal: AbortSignal.timeout(healthTimeoutMs),
        cache: "no-store",
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // Uma resposta não JSON ainda prova que a porta pertence a outro serviço.
      }
      if (response.ok && isMemoryStatus(payload)) {
        publicState.state = "healthy";
        publicState.latencyMs = Math.max(0, Date.now() - startedAt);
        publicState.lastHealthAt = new Date().toISOString();
        publicState.lastError = null;
        return { kind: "healthy", payload };
      }
      publicState.state = "port_conflict";
      publicState.latencyMs = Math.max(0, Date.now() - startedAt);
      publicState.lastError = "A porta 49374 respondeu sem a assinatura do ai-memory.";
      return { kind: "conflict" };
    } catch (error) {
      return { kind: "unreachable", error };
    }
  }

  function trackManagedChild(child) {
    managedChild = child;
    publicState.managed = true;
    publicState.pid = Number.isInteger(child.pid) ? child.pid : null;
    child.once("exit", (code, signal) => {
      if (managedChild !== child) return;
      managedChild = null;
      publicState.managed = false;
      publicState.pid = null;
      if (!stopping && publicState.state !== "port_conflict") {
        publicState.state = "degraded";
        publicState.lastError = `ai-memory encerrou (exit ${code ?? "?"}, signal ${signal ?? "none"}).`;
      }
    });
    child.once("error", (error) => {
      if (managedChild !== child) return;
      publicState.state = "degraded";
      publicState.lastError = safeError(error, "Não foi possível iniciar o ai-memory.");
    });
  }

  async function waitUntilHealthy() {
    let lastError = null;
    for (let attempt = 0; attempt < startupAttempts; attempt += 1) {
      const result = await probe();
      if (result.kind === "healthy" || result.kind === "conflict") return result;
      lastError = result.error;
      if (attempt + 1 < startupAttempts) await sleep(startupDelayMs);
    }
    publicState.state = "degraded";
    publicState.lastError = `Health do ai-memory não respondeu: ${safeError(lastError, "timeout")}`;
    return { kind: "unreachable", error: lastError };
  }

  async function startManaged() {
    if (managedChild) {
      await waitUntilHealthy();
      return status();
    }
    if (!binaryPath || !fs.existsSync(binaryPath)) {
      publicState.state = "unconfigured";
      publicState.lastError = "Runtime ai-memory ainda não está instalado.";
      return status();
    }
    fs.mkdirSync(layout.dataDir, { recursive: true });
    try {
      const child = spawnImpl(binaryPath, SERVE_ARGS, {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
        env: childEnv(),
      });
      trackManagedChild(child);
      await waitUntilHealthy();
    } catch (error) {
      publicState.state = "degraded";
      publicState.lastError = safeError(error, "Não foi possível iniciar o ai-memory.");
    }
    return status();
  }

  async function connectOrStart() {
    const existing = await probe();
    if (existing.kind === "healthy" || existing.kind === "conflict") {
      return status();
    }
    if (managedChild) {
      await waitUntilHealthy();
      return status();
    }
    return startManaged();
  }

  async function setup() {
    if (publicState.state === "healthy") return status();
    ensureToken();
    const existing = await probe();
    if (existing.kind === "healthy" || existing.kind === "conflict") {
      return status();
    }
    if (managedChild) {
      await waitUntilHealthy();
      return status();
    }
    const installed = await installer({
      layout,
      entry: runtimeInfo.entry,
      version: runtimeInfo.manifest.version,
    });
    binaryPath = installed.binaryPath;
    return startManaged();
  }

  async function startIfInstalled() {
    if (publicState.state === "healthy") return status();
    ensureToken();
    const existing = await probe();
    if (existing.kind === "healthy" || existing.kind === "conflict") {
      return status();
    }
    const candidate = path.join(
      layout.runtimeRoot,
      runtimeInfo.manifest.version,
      runtimeInfo.entry.binary,
    );
    if (!fs.existsSync(candidate) || fs.statSync(candidate).size < 1) {
      publicState.state = "unconfigured";
      publicState.lastError = null;
      return status();
    }
    binaryPath = candidate;
    return startManaged();
  }

  async function ensureRunning() {
    if (publicState.state === "healthy") return status();
    if (binaryPath && fs.existsSync(binaryPath)) return connectOrStart();
    return setup();
  }

  async function stopManaged() {
    const child = managedChild;
    if (!child) return false;
    stopping = true;
    const exited = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), stopTimeoutMs);
      timer.unref?.();
      child.once("exit", () => finish(true));
      try {
        if (child.kill() === false) finish(false);
      } catch {
        finish(false);
      }
    });
    stopping = false;
    if (!exited) {
      publicState.state = "degraded";
      publicState.lastError = "O processo gerenciado do ai-memory não encerrou no prazo.";
      return false;
    }
    if (managedChild === child) managedChild = null;
    publicState.managed = false;
    publicState.pid = null;
    publicState.state = "unconfigured";
    publicState.lastError = null;
    return true;
  }

  async function runMaintenance(operation) {
    if (operation !== "reindex") {
      throw new Error(`Manutenção de memória desconhecida: ${operation}`);
    }
    await ensureRunning();
    if (!managedChild || !binaryPath) {
      throw new Error("Manutenção recusada: o ai-memory ativo não é gerenciado pelo Forge Nexus.");
    }
    if (!await stopManaged()) {
      throw new Error("Manutenção recusada: não foi possível parar o ai-memory gerenciado.");
    }

    let maintenanceError = null;
    try {
      const maintenance = spawnImpl(binaryPath, [operation], {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
        env: childEnv(),
      });
      const result = await waitForExit(maintenance);
      if (result.code !== 0) {
        throw new Error(`ai-memory ${operation} falhou: exit ${result.code ?? "?"}.`);
      }
    } catch (error) {
      maintenanceError = error;
    }

    await startManaged();
    if (maintenanceError) throw maintenanceError;
    return status();
  }

  return {
    status,
    setup,
    startIfInstalled,
    ensureRunning,
    stopManaged,
    runMaintenance,
  };
}
