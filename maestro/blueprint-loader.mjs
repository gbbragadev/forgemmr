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

/** Id de blueprint seguro (sem path traversal). `generic` é sentinela. */
export function assertSafeBlueprintId(id) {
  const s = String(id || "");
  if (s !== "generic" && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(s)) {
    throw new Error(`blueprint id inválido: ${s.slice(0, 40)}`);
  }
  return s;
}

/** Resolve path relativo sob root; rejeita absolute, null bytes e `..`. */
export function assertSafeRepoRelPath(root, rel) {
  const raw = String(rel || "");
  if (!raw || path.isAbsolute(raw) || raw.includes("\0")) throw new Error("path inválido");
  if (raw.split(/[/\\]/).some((p) => p === "..")) throw new Error("path não pode conter ..");
  const resolved = path.resolve(root, raw);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("path fora do repo");
  }
  return resolved;
}

/**
 * Carrega um blueprint. `generic` (ou ausente) = sentinela: o engine usa os
 * defaults internos (JOBS_BY_CAPABILITY / GATES_AFTER / switch de verify).
 * Blueprints externos vêm de blueprints/<name>/blueprint.json.
 */
export function loadBlueprint(name, { root }) {
  const bpName = assertSafeBlueprintId(name || "generic");
  if (bpName === "generic") return { name: "generic", external: false };

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
    if (spec.verify.type === "file") {
      if (!spec.verify.path) {
        throw new Error(`blueprint "${bpName}": job "${jobId}" precisa de verify.path`);
      }
      const rawPath = String(spec.verify.path);
      if (path.isAbsolute(rawPath) || rawPath.includes("\0") || rawPath.split(/[/\\]/).some((p) => p === "..")) {
        throw new Error(`blueprint "${bpName}": verify.path inseguro em "${jobId}"`);
      }
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
