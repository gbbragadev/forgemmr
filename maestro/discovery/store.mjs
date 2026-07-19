import fs from "node:fs";
import path from "node:path";
import { writePrivateFile } from "../adapters.mjs";

const SCHEMA_VERSION = 1;

function initialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    rooms: [],
    theses: [],
    evidence: [],
    experiments: [],
    builds: [],
    acquisitions: [],
    handoffs: [],
    bragaReturns: [],
  };
}

function validateState(value, file) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || !Number.isInteger(value.revision)) {
    throw new Error(`discovery store inválido (${path.basename(file)}): schema inválido`);
  }
  for (const collection of ["rooms", "theses", "evidence", "experiments", "builds", "acquisitions"]) {
    if (!Array.isArray(value[collection])) {
      throw new Error(`discovery store inválido (${path.basename(file)}): ${collection} inválido`);
    }
  }
  for (const collection of ["handoffs", "bragaReturns"]) {
    value[collection] ??= [];
    if (!Array.isArray(value[collection])) {
      throw new Error(`discovery store inválido (${path.basename(file)}): ${collection} inválido`);
    }
  }
  return value;
}

function readFile(file) {
  if (!fs.existsSync(file)) return initialState();
  try {
    return validateState(JSON.parse(fs.readFileSync(file, "utf8")), file);
  } catch (error) {
    if (String(error.message).startsWith("discovery store inválido")) throw error;
    throw new Error(`discovery store inválido (${path.basename(file)}): ${error.message}`);
  }
}

function writeAtomicPrivate(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writePrivateFile(temp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows aplica a proteção disponível em writePrivateFile.
  }
}

export function createDiscoveryStore({ root }) {
  const file = path.join(root, ".control", "discovery", "workspace.json");
  return {
    file,
    read() {
      return structuredClone(readFile(file));
    },
    update(mutator) {
      const state = readFile(file);
      mutator(state);
      state.revision += 1;
      writeAtomicPrivate(file, state);
      return structuredClone(state);
    },
  };
}
