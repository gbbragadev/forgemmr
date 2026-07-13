import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cleanupExternalizedPrompts,
  openPrivateFile,
  writePrivateFile,
} from "../adapters.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");

function source(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("arquivos sensíveis usam 0600 e prompts temporários são limpos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-private-"));
  try {
    const privateFile = path.join(dir, "private.txt");
    writePrivateFile(privateFile, "segredo");
    assert.equal(fs.readFileSync(privateFile, "utf8"), "segredo");

    const rawFile = path.join(dir, "run.raw.log");
    const fd = openPrivateFile(rawFile);
    fs.closeSync(fd);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(privateFile).mode & 0o777, 0o600);
      assert.equal(fs.statSync(rawFile).mode & 0o777, 0o600);
    } else {
      const adapters = source("maestro/adapters.mjs");
      assert.match(adapters, /writeFileSync\([^\n]+mode:\s*0o600/);
      assert.match(adapters, /openSync\([^\n]+"w",\s*0o600\)/);
      assert.match(adapters, /chmodSync\([^\n]+0o600\)/);
    }

    const promptDir = path.join(dir, "maestro", ".prompts");
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(path.join(promptDir, "prompt.md"), "temporário");
    cleanupExternalizedPrompts(dir);
    assert.equal(fs.existsSync(promptDir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("SSE é same-origin e logger central aplica redaction", () => {
  const server = source("maestro/server.mjs");
  assert.equal(server.includes('"Access-Control-Allow-Origin": "*"'), false);
  assert.match(server, /function log\(line\)[\s\S]*redactLog\(/);
});

test("todos os writers sensíveis usam helpers privados e limpam prompts no sucesso", () => {
  const engine = source("maestro/engine.mjs");
  const server = source("maestro/server.mjs");
  const improver = source("maestro/improver.mjs");

  assert.match(engine, /openPrivateFile\(rawPath\)/);
  assert.match(engine, /writePrivateFile\([^\n]*\.run-goal\.txt/);
  assert.match(engine, /status === "done"[\s\S]*cleanupExternalizedPrompts\(root\)/);
  assert.match(server, /openPrivateFile\(rawLogPath\)/);
  assert.match(server, /writePrivateFile\(goalFile/);
  assert.match(server, /code === 0[\s\S]*cleanupExternalizedPrompts\(ROOT\)/);
  assert.match(improver, /writePrivateFile\(rawPath/);
});
