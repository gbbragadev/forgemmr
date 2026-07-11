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
    `# Scorecard — ${appId} (dry-run)\n\n**GO**\n\n| critério | nota |\n|---|---|\n| hook / valor | 4 |\n| custo | 5 |\n| fit ao nicho | 4 |\n\n- gerado pelo fake-exec para teste da pipeline\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "FOUNDATION") {
  const p = path.join(ROOT, "docs", `system-design-${appId}.md`);
  fs.writeFileSync(
    p,
    `# System Design — ${appId} (dry-run)\n\n## Arquitetura\nFrontend estático → estado local → sem backend (dry-run).\n\n## Dados\nlocalStorage; entidades mínimas.\n\n## Decisões\n(A) localStorage (B) DB — escolho A porque v0 single-device.\n\n## Design patterns\nComponentes puros + hook de estado.\n\n## Riscos\nEscopo v0; sem conta/backend.\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "DS-GEN") {
  const propDir = path.join(ROOT, "maestro", "proposals", appId);
  fs.mkdirSync(propDir, { recursive: true });
  const dirs = ["minimalista", "vibrante", "editorial"];
  for (let n = 1; n <= 3; n++) {
    fs.writeFileSync(
      path.join(propDir, `proposal-${n}.html`),
      `<!doctype html><meta charset="utf-8"><title>${appId} — proposta ${n} (dry-run)</title>` +
        `<style>body{font-family:system-ui;background:#0a0612;color:#f5f0ff;padding:24px}` +
        `.sw{display:inline-block;width:48px;height:48px;border-radius:8px;margin:4px}` +
        `.btn{padding:8px 16px;border-radius:10px;border:0;background:#c44dff;color:#fff}</style>` +
        `<h1>${appId} — direção ${n}: ${dirs[n - 1]} (dry-run)</h1>` +
        `<p>Paleta:</p><span class="sw" style="background:#c44dff"></span><span class="sw" style="background:#38bdf8"></span>` +
        `<span class="sw" style="background:#34d399"></span><p><button class="btn">Botão primário</button></p>` +
        `<p>proposta fake gerada pelo dry-run para testar o gate ds-pick.</p>`,
      "utf8"
    );
  }
  const md = path.join(ROOT, "docs", `design-system-${appId}.md`);
  fs.writeFileSync(
    md,
    `# Design System — ${appId} (dry-run)\n\n` +
      dirs
        .map(
          (d, i) =>
            `## Proposta ${i + 1}: ${d}\n| token | valor |\n|---|---|\n| primária | #c44dff |\n| bg | #0a0612 |\n| radius | 10px |\n| font | system-ui |\n\nQuando escolher: exemplo dry-run.\n`
        )
        .join("\n"),
    "utf8"
  );
  console.log(`✓ escreveu 3 propostas + ${path.relative(ROOT, md)}`);
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
