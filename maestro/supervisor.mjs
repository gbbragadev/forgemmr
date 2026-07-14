import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function probeControlCenter(url, { fetchImpl = fetch, timeoutMs = 1200 } = {}) {
  const endpoint = `${String(url).replace(/\/$/, "")}/api/control/snapshot`;
  try {
    const response = await fetchImpl(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const snapshot = await response.json();
    return snapshot?.server?.localOnly === true && Array.isArray(snapshot.actions) && typeof snapshot.version === "string";
  } catch {
    return false;
  }
}

export function startDetachedServer({ root = ROOT, port = 8799, spawnImpl = spawn } = {}) {
  const child = spawnImpl(process.execPath, [path.join(root, "maestro", "server.mjs")], {
    cwd: root,
    env: { ...process.env, MAESTRO_PORT: String(port) },
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref?.();
  return child;
}

export function openDefaultBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const command = platform === "win32" ? "rundll32.exe" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawnImpl(command, args, {
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref?.();
  return child;
}

export async function ensureControlCenter({
  url = "http://127.0.0.1:8799",
  probeHealth = () => probeControlCenter(url),
  startServer = () => startDetachedServer(),
  openBrowser = () => openDefaultBrowser(url),
  wait = delay,
  retryDelayMs = 250,
  maxAttempts = 40,
} = {}) {
  if (await probeHealth()) {
    await openBrowser();
    return { url, reused: true, started: false };
  }

  await startServer();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(retryDelayMs);
    if (await probeHealth()) {
      await openBrowser();
      return { url, reused: false, started: true };
    }
  }

  throw new Error(`A porta não respondeu como Maestro Control Center após ${maxAttempts} tentativas: ${url}`);
}

async function main() {
  const port = Number(process.env.MAESTRO_PORT || 8799);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MAESTRO_PORT inválida.");
  const url = `http://127.0.0.1:${port}`;
  const result = await ensureControlCenter({
    url,
    probeHealth: () => probeControlCenter(url),
    startServer: () => startDetachedServer({ root: ROOT, port }),
    openBrowser: () => openDefaultBrowser(url),
  });
  process.stdout.write(`${result.reused ? "Maestro já estava online" : "Maestro iniciado"}: ${result.url}\n`);
}

const direct = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (direct) {
  main().catch((error) => {
    process.stderr.write(`Não foi possível abrir o Control Center: ${error.message}\n`);
    process.exitCode = 1;
  });
}
