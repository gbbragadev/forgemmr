import fs from "node:fs";
import path from "node:path";
import { writePrivateFile } from "../adapters.mjs";

function writeAtomicPrivate(file, value) {
  const dir = path.dirname(file);
  const temp = `${file}.tmp`;
  fs.mkdirSync(dir, { recursive: true });
  writePrivateFile(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // idem
  }
}

function readState(file) {
  if (!fs.existsSync(file)) return { version: 1, operations: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.operations)) throw new Error("schema inválido");
    return parsed;
  } catch (error) {
    throw new Error(`control store inválido (${path.basename(file)}): ${error.message}`);
  }
}

export function createOperationStore({ root }) {
  const file = path.join(root, ".control", "operations.json");

  return {
    file,
    list() {
      return readState(file).operations.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    },
    get(id) {
      return readState(file).operations.find((operation) => operation.id === id) || null;
    },
    findByIdempotencyKey(key) {
      return readState(file).operations.find((operation) => operation.idempotencyKey === key) || null;
    },
    put(operation) {
      if (!operation || !/^[a-zA-Z0-9_-]+$/.test(String(operation.id || ""))) {
        throw new Error("operação precisa de id seguro");
      }
      const state = readState(file);
      const index = state.operations.findIndex((candidate) => candidate.id === operation.id);
      if (index === -1) state.operations.push(structuredClone(operation));
      else state.operations[index] = structuredClone(operation);
      writeAtomicPrivate(file, state);
      return structuredClone(operation);
    },
  };
}
