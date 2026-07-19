/**
 * Sobe o Maestro detached (sobrevive ao terminal) e opcionalmente abre o browser.
 * Uso: node scripts/keep-maestro-up.mjs [--no-browser]
 */
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDetachedServer, probeControlCenter } from "../maestro/supervisor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.MAESTRO_PORT || 8799);
const URL = `http://127.0.0.1:${PORT}`;
const openBrowser = !process.argv.includes("--no-browser");

function freePort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* nothing on port */
  }
}

async function main() {
  let healthy = await probeControlCenter(URL);
  if (healthy) {
    console.log(`✓ já saudável em ${URL}`);
  } else {
    freePort(PORT);
    await new Promise((r) => setTimeout(r, 400));
    const child = startDetachedServer({ root: ROOT, port: PORT });
    console.log(`▶ server detached pid=${child.pid}`);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      healthy = await probeControlCenter(URL);
      if (healthy) break;
    }
    if (!healthy) {
      console.error(`✗ não subiu em ${URL} — veja se a porta ${PORT} está livre`);
      process.exit(1);
    }
    console.log(`✓ Forge Nexus em ${URL}`);
  }

  if (openBrowser) {
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", `${URL}/#pipelines`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    console.log("↗ browser: #pipelines");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
