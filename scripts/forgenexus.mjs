import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runtimeSourceFingerprint } from "../maestro/runtime-version.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tokenFile = path.join(root, "maestro", ".token");
const serverFile = path.join(root, "maestro", "server.mjs");
const controlPlaneUrl = "http://127.0.0.1:8799/api/control/snapshot";
const expectedSourceFingerprint = runtimeSourceFingerprint(root);

function readToken() {
  try {
    return fs.readFileSync(tokenFile, "utf8").trim();
  } catch {
    return "";
  }
}

async function serverSnapshot() {
  const token = readToken();
  if (!token) return null;
  try {
    const response = await fetch(controlPlaneUrl, {
      headers: { "X-Maestro-Token": token },
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return null;
    const snapshot = await response.json();
    return Array.isArray(snapshot.actions) && snapshot.actions.some(action => action.id === "room.create") ? snapshot : null;
  } catch {
    return null;
  }
}

function listenerPid() {
  if (process.platform !== "win32") return null;
  try {
    const output = execFileSync("netstat.exe", ["-ano"], { encoding: "utf8", windowsHide: true });
    const line = output.split(/\r?\n/).find(row => /LISTENING/i.test(row) && row.trim().split(/\s+/)[1]?.endsWith(":8799"));
    const pid = Number(line?.trim().split(/\s+/).at(-1));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function stopStaleServer(snapshot) {
  const activeOperation = snapshot.runner?.activeRunId || snapshot.operations?.some(operation => operation.status === "running");
  if (activeOperation) throw new Error("O Maestro ativo está desatualizado, mas há uma execução em andamento. Aguarde-a terminar e rode forgenexus novamente.");
  const pid = Number(snapshot.server?.pid) || listenerPid();
  if (!Number.isInteger(pid) || pid < 1) throw new Error("O Maestro ativo está desatualizado e não foi possível localizar seu processo para reiniciar.");
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!await serverSnapshot()) return;
  }
  throw new Error("O Maestro desatualizado não encerrou; feche-o e rode forgenexus novamente.");
}

async function ensureServer() {
  let snapshot = await serverSnapshot();
  let restarted = false;
  if (snapshot && snapshot.server?.sourceFingerprint !== expectedSourceFingerprint) {
    await stopStaleServer(snapshot);
    snapshot = null;
    restarted = true;
  }
  if (snapshot) return { started: false, restarted: false };

  const server = spawn(process.execPath, [serverFile], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  server.unref();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (await serverSnapshot()) return { started: true, restarted };
  }
  throw new Error("O Maestro não respondeu em 127.0.0.1:8799.");
}

function runTui() {
  const windows = process.platform === "win32";
  const command = windows ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = windows ? ["/d", "/s", "/c", "npm.cmd run tui"] : ["run", "tui"];
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, FORGE_ROOT: root },
  });
  child.on("error", error => {
    console.error(`Não foi possível abrir a TUI: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 0);
  });
}

if (process.argv.includes("--help")) {
  console.log("Uso: forgenexus [--check | --help]");
  process.exit(0);
}

try {
  const { started, restarted } = await ensureServer();
  if (process.argv.includes("--check")) {
    console.log(`Forge Nexus pronto (${restarted ? "Maestro atualizado e reiniciado" : started ? "Maestro iniciado" : "Maestro já estava ativo"}).`);
  } else {
    runTui();
  }
} catch (error) {
  console.error(`forgenexus: ${error.message}`);
  process.exitCode = 1;
}
