/**
 * Toolbox — catálogo de skills e subagentes disponíveis no host (Claude Code).
 *
 * O prompt-improver usa isto para ESCOLHER quais skills/agentes o executor deve invocar.
 * Só o CLI `claude` (e o glm, que roda o claude) consegue invocá-los de fato — ver supportsToolbox().
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();

/** dirs padrão: os do usuário (~/.claude) + os do projeto (<root>/.claude) */
export function defaultAgentDirs(root) {
  return [path.join(HOME, ".claude", "agents"), ...(root ? [path.join(root, ".claude", "agents")] : [])];
}
export function defaultSkillDirs(root) {
  return [path.join(HOME, ".claude", "skills"), ...(root ? [path.join(root, ".claude", "skills")] : [])];
}

/** name/description do frontmatter YAML simples (--- name: x \n description: y ---) */
function frontmatter(file) {
  try {
    const raw = fs.readFileSync(file, "utf8").slice(0, 4000);
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const name = (m[1].match(/^name:\s*(.+)$/m) || [])[1];
    const desc = (m[1].match(/^description:\s*(.+)$/m) || [])[1];
    if (!name) return null;
    return { name: name.trim(), description: (desc || "").trim().slice(0, 220) };
  } catch {
    return null;
  }
}

/** subagentes: <dir>/*.md com frontmatter name/description */
export function listAgents(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const fm = frontmatter(path.join(dir, f));
      if (fm && !out.some((a) => a.name === fm.name)) out.push(fm);
    }
  }
  return out;
}

/** skills: <dir>/<slug>/SKILL.md com frontmatter name/description */
export function listSkills(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const slug of fs.readdirSync(dir)) {
      const file = path.join(dir, slug, "SKILL.md");
      if (!fs.existsSync(file)) continue;
      const fm = frontmatter(file) || { name: slug, description: "" };
      if (!out.some((s) => s.name === fm.name)) out.push(fm);
    }
  }
  return out;
}

/** Só o CLI claude (Anthropic OAuth) e o glm (claude + backend Z.ai) invocam skills/subagentes. */
export function supportsToolbox(player) {
  return (player?.cli || "") === "claude";
}
