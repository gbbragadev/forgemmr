/**
 * Workbench writers — espelha o estado da pipeline em QUEUE/HANDOFF/CLAIMS (markdown).
 * Mantém o contrato L2 válido: humano ou outro agente pode retomar na mão.
 * Todas as funções são best-effort: erro de parsing nunca derruba a engine.
 */

import fs from "node:fs";
import path from "node:path";

const FREE_ROW = "| — | — | — | — | — | — | livre |";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s.replace(/\n{3,}/g, "\n\n"), "utf8"); // colapsa linhas em branco órfãs
}

function section(paths, name) {
  return path.join(paths.root, "workbench", name);
}

/** Insere linha logo abaixo de um heading "## X" */
function insertUnder(md, heading, line) {
  const re = new RegExp(`(^## ${heading}\\s*$)`, "m");
  if (!re.test(md)) return md + `\n## ${heading}\n\n${line}\n`;
  return md.replace(re, `$1\n\n${line}`);
}

export function queueStart(paths, job, appId) {
  try {
    const p = section(paths, "QUEUE.md");
    let md = read(p);
    md = md.replace(/^_\(vazio\)_\s*$/m, "");
    md = insertUnder(md, "Doing", `- [ ] **${job}** ${appId} — forge autopilot`);
    write(p, md);
  } catch {
    /* best-effort */
  }
}

export function queueDone(paths, job, appId, player) {
  try {
    const p = section(paths, "QUEUE.md");
    let md = read(p);
    const doing = new RegExp(`^- \\[ \\] \\*\\*${job.replace("/", "\\/")}\\*\\* ${appId} — forge autopilot\\s*$`, "m");
    md = md.replace(doing, "");
    const date = new Date().toISOString().slice(0, 10);
    md = insertUnder(md, "Done", `- [x] **${job}** ${appId} — forge/${player} (${date})`);
    write(p, md);
  } catch {
    /* best-effort */
  }
}

export function claimSet(paths, player, loop, job, appId) {
  try {
    const p = section(paths, "CLAIMS.md");
    let md = read(p);
    const hhmm = new Date().toISOString().slice(11, 16);
    const row = `| F | ${player} | ${loop} | ${job} | ${appId} | ${hhmm} | forge autopilot |`;
    if (md.includes(FREE_ROW)) md = md.replace(FREE_ROW, row);
    else md = md.replace(/(\|------\|.*\|\s*\n)/, `$1${row}\n`);
    write(p, md);
  } catch {
    /* best-effort */
  }
}

export function claimFree(paths) {
  try {
    const p = section(paths, "CLAIMS.md");
    let md = read(p);
    md = md
      .split("\n")
      .filter((l) => !/^\| F \|.*\| forge autopilot \|\s*$/.test(l))
      .join("\n");
    if (!md.includes(FREE_ROW)) md = md.replace(/(\|------\|.*\|\s*\n)/, `$1${FREE_ROW}\n`);
    write(p, md);
  } catch {
    /* best-effort */
  }
}

const BEGIN = "<!-- forge:begin -->";
const END = "<!-- forge:end -->";

/** Substitui (ou cria) a seção do autopilot no HANDOFF.md */
export function handoffUpdate(paths, pipeline, extra = "") {
  try {
    const p = section(paths, "HANDOFF.md");
    let md = read(p);
    const gate = (pipeline.gates || []).find((g) => !g.decision);
    const lines = [
      BEGIN,
      `## Forge autopilot — ${pipeline.appId}`,
      "",
      `- **Ideia:** ${pipeline.idea}`,
      `- **Team:** ${pipeline.team} · **Status:** ${pipeline.status}`,
      `- **Job atual:** ${pipeline.currentJob || "—"} (${(pipeline.jobIndex ?? 0) + 1}/${pipeline.jobs.length})`,
      `- **Branch:** ${pipeline.git?.branch || "—"} · checkpoints: ${pipeline.git?.checkpoints?.length || 0}`,
      gate ? `- **⏸ GATE pendente:** \`${gate.id}\` — ${gate.prompt} → \`forge decide ${gate.id} go|kill\`` : null,
      pipeline.deploy?.url ? `- **URL:** ${pipeline.deploy.url}` : null,
      extra ? `- ${extra}` : null,
      "",
      `_Atualizado ${new Date().toISOString()} pelo forge (maestro/engine.mjs). Estado completo: maestro/pipeline.json_`,
      END,
    ].filter(Boolean);
    const block = lines.join("\n");
    if (md.includes(BEGIN) && md.includes(END)) {
      md = md.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), block);
    } else {
      md = md.trimEnd() + "\n\n" + block + "\n";
    }
    write(p, md);
  } catch {
    /* best-effort */
  }
}
