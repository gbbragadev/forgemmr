/**
 * Executor fake — dry-run da pipeline (cli: "fake" no roster).
 * Recebe o prompt envelope como argv[2], extrai Job/App e gera os artefatos
 * mínimos que o verify espera, sem tocar em código real.
 *
 * FORGE_FAKE_FAIL no prompt → exit 1 (testa retry/rollback/L2).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const goal = process.argv[2] || "";

const job = (goal.match(/^Job:\s*(\S+)/m) || [])[1] || "?";
const appId = (goal.match(/^App:\s*(\S+)/m) || [])[1] || "fake-app";

console.log(`▶ fake-exec: job=${job} app=${appId}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);

if (/FORGE_FAKE_FAIL/.test(goal)) {
  console.error("✗ fake-exec: falha simulada (FORGE_FAKE_FAIL)");
  process.exit(1);
}

if (job === "L0/P0") {
  const p = path.join(ROOT, "docs", `scorecard-${appId}.md`);
  fs.writeFileSync(
    p,
    `# Scorecard — ${appId} (dry-run)\n\n**GO**\n\n| critério | nota |\n|---|---|\n| hook shareable | 4 |\n| custo API | 5 |\n| fit anime | 4 |\n\n- gerado pelo fake-exec para teste da pipeline\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "L0/P1") {
  const p = path.join(ROOT, "docs", `content-hooks-${appId}.md`);
  fs.writeFileSync(
    p,
    `# Content hooks — ${appId} (dry-run)\n\n1. hook fake 1\n2. hook fake 2\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else {
  console.log(`· fake-exec: job ${job} simulado (sem artefato)`);
}

await sleep(400);
console.log("✓ fake-exec done");
