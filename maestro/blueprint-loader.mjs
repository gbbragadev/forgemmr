import fs from "node:fs";
import path from "node:path";
import { activeBlueprintFile } from "./control/blueprint-admin.mjs";

/** Substitui ${key} e ${a.b} por ctx; placeholders sem valor ficam intactos. */
export function interpolate(tpl, ctx = {}) {
  return String(tpl).replace(/\$\{([\w.]+)\}/g, (m, key) => {
    const val = key.split(".").reduce((o, k) => (o == null ? o : o[k]), ctx);
    return val == null ? m : String(val);
  });
}

/**
 * Carrega um blueprint. `generic` (ou ausente) = sentinela: o engine usa os
 * defaults internos (JOBS_BY_CAPABILITY / GATES_AFTER / switch de verify).
 * Blueprints externos vêm de blueprints/<name>/blueprint.json.
 */
export function loadBlueprint(name, { root }) {
  const bpName = name || "generic";
  if (bpName === "generic") return { name: "generic", external: false };

  const dir = path.join(root, "blueprints", bpName);
  const { file, manifest } = activeBlueprintFile(root, bpName);
  if (manifest?.archived) throw new Error(`blueprint "${bpName}" está arquivado`);
  if (!fs.existsSync(file)) {
    throw new Error(`blueprint "${bpName}" não existe (esperado ${path.relative(root, file)})`);
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`blueprint "${bpName}": blueprint.json inválido — ${e.message}`);
  }
  if (!Array.isArray(json.jobs) || !json.jobs.length) {
    throw new Error(`blueprint "${bpName}": campo "jobs" ausente ou vazio`);
  }
  const jobSpecs = {};
  for (const jobId of json.jobs) {
    const spec = (json.jobSpecs && json.jobSpecs[jobId]) || null;
    if (!spec || !spec.verify || !["file", "builtin"].includes(spec.verify.type)) {
      throw new Error(`blueprint "${bpName}": job "${jobId}" precisa de verify file ou builtin`);
    }
    if (spec.verify.type === "file" && !spec.verify.path) {
      throw new Error(`blueprint "${bpName}": job "${jobId}" precisa de verify.path`);
    }
    jobSpecs[jobId] = {
      template: spec.template || null,
      // ref legível/absoluta que o agente pode abrir (cwd = root)
      templateRef: spec.template ? `blueprints/${bpName}/prompts/${spec.template}` : null,
      inputs: spec.inputs || [],
      verify: spec.verify,
      gate: spec.gate || null,
    };
  }
  return {
    name: bpName,
    external: true,
    version: manifest?.activeVersion || "legacy",
    derivedFrom: manifest?.derivedFrom || null,
    jobs: json.jobs.slice(),
    jobSpecs,
  };
}
