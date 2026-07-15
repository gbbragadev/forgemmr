import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const JOB = /^[A-Z0-9][A-Z0-9/_-]{0,79}$/;

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function hashOf(value) {
  return `sha256-${crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(temp, file);
}

function validateDraft(input) {
  const name = String(input?.name || input?.title || "").trim();
  const title = String(input?.title || name).trim();
  if (name.length < 2 || name.length > 100) throw new Error("blueprint precisa de nome com 2–100 caracteres");
  if (title.length < 2 || title.length > 160) throw new Error("blueprint precisa de título com 2–160 caracteres");
  const jobs = Array.isArray(input?.jobs) ? [...new Set(input.jobs.map(String))] : [];
  if (!jobs.length || jobs.length > 40) throw new Error("blueprint precisa de 1–40 jobs");
  const jobSpecs = {};
  for (const job of jobs) {
    if (!JOB.test(job)) throw new Error(`job inválido: ${job}`);
    const spec = input?.jobSpecs?.[job];
    if (!spec?.verify || !["file", "builtin"].includes(spec.verify.type)) {
      throw new Error(`job "${job}" precisa de verify {type:"file", path} ou {type:"builtin"}`);
    }
    if (spec.verify.type === "file" && !spec.verify.path) {
      throw new Error(`job "${job}" precisa de verify.path`);
    }
    if (spec.verify.type === "file" && (path.isAbsolute(spec.verify.path) || String(spec.verify.path).includes(".."))) {
      throw new Error(`job "${job}" possui caminho de verificação inseguro`);
    }
    jobSpecs[job] = {
      template: spec.template || null,
      inputs: Array.isArray(spec.inputs) ? spec.inputs.map(String) : [],
      verify: spec.verify.type === "builtin"
        ? { type: "builtin" }
        : { ...spec.verify, type: "file", path: String(spec.verify.path) },
      gate: spec.gate || null,
    };
  }
  return {
    schemaVersion: 1,
    name,
    title,
    purpose: String(input?.purpose || "").trim().slice(0, 2_000),
    jobs,
    jobSpecs,
  };
}

export function activeBlueprintFile(root, id) {
  const dir = path.join(root, "blueprints", id);
  const manifest = readJson(path.join(dir, "manifest.json"));
  if (manifest?.activeVersion) {
    return {
      file: path.join(dir, "versions", manifest.activeVersion, "blueprint.json"),
      manifest,
    };
  }
  return { file: path.join(dir, "blueprint.json"), manifest: null };
}

export function createBlueprintAdmin({ root, now = () => new Date() } = {}) {
  const base = path.join(root, "blueprints");

  function loadManifest(id) {
    if (!ID.test(id)) throw new Error(`blueprint id inválido: ${id}`);
    return readJson(path.join(base, id, "manifest.json"));
  }

  function save(input, { id: requestedId, reason = "create", derivedFrom = null } = {}) {
    const blueprint = validateDraft(input);
    const id = requestedId || slugify(blueprint.name);
    if (!ID.test(id)) throw new Error(`blueprint id inválido: ${id}`);
    const dir = path.join(base, id);
    const previous = loadManifest(id);
    const activeVersion = hashOf(blueprint);
    const versionFile = path.join(dir, "versions", activeVersion, "blueprint.json");
    if (!fs.existsSync(versionFile)) writeJsonAtomic(versionFile, blueprint);
    const timestamp = now().toISOString();
    const versions = Array.isArray(previous?.versions) ? previous.versions.slice() : [];
    if (!versions.some((version) => version.id === activeVersion)) {
      versions.push({
        id: activeVersion,
        parent: previous?.activeVersion || null,
        reason: String(reason || "update").slice(0, 200),
        createdAt: timestamp,
      });
    }
    const manifest = {
      schemaVersion: 1,
      id,
      name: blueprint.name,
      title: blueprint.title,
      purpose: blueprint.purpose,
      activeVersion,
      archived: false,
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp,
      derivedFrom: previous?.derivedFrom || derivedFrom || null,
      versions,
    };
    writeJsonAtomic(path.join(dir, "manifest.json"), manifest);
    return manifest;
  }

  function setArchived(id, archived) {
    const manifest = loadManifest(id);
    if (!manifest) throw new Error(`blueprint "${id}" não possui contrato versionado`);
    const next = { ...manifest, archived, updatedAt: now().toISOString() };
    writeJsonAtomic(path.join(base, id, "manifest.json"), next);
    return next;
  }

  return {
    save,
    derive(sourceId, draft, options = {}) {
      const source = loadManifest(sourceId) || (() => {
        throw new Error(`blueprint fonte não encontrado: ${sourceId}`);
      })();
      const targetId = options.id || slugify(draft?.name || draft?.title);
      if (targetId === sourceId) throw new Error("derivação precisa de um novo nome/id; para editar, crie uma nova versão");
      return save(draft, {
        ...options,
        id: targetId,
        derivedFrom: { blueprintId: sourceId, version: source.activeVersion },
        reason: options.reason || "derive",
      });
    },
    migrate(id) {
      const legacyFile = path.join(base, id, "blueprint.json");
      const legacy = readJson(legacyFile);
      if (!legacy) throw new Error(`blueprint legado não encontrado: ${id}`);
      return save(legacy, { id, reason: "migrate-legacy" });
    },
    archive: (id) => setArchived(id, true),
    restore: (id) => setArchived(id, false),
    list({ includeArchived = false } = {}) {
      if (!fs.existsSync(base)) return [];
      const items = [];
      for (const id of fs.readdirSync(base).sort()) {
        if (!ID.test(id)) continue;
        const manifest = loadManifest(id);
        if (manifest) {
          if (!manifest.archived || includeArchived) items.push(manifest);
          continue;
        }
        const legacy = readJson(path.join(base, id, "blueprint.json"));
        if (legacy) items.push({
          schemaVersion: 0,
          id,
          name: legacy.name || id,
          title: legacy.title || legacy.name || id,
          purpose: legacy.purpose || "",
          activeVersion: "legacy",
          archived: false,
          versions: [],
          legacy: true,
        });
      }
      return items;
    },
  };
}
