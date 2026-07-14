import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryRuntime } from "../memory/runtime.mjs";
import { resolveMemoryLayout } from "../memory/layout.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");

function statusResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        version: "1.13.0",
        data_dir: "C:\\memory",
        bind: "127.0.0.1:49374",
        counts: { pages_latest: 0 },
        ...overrides,
      };
    },
  };
}

function fakeChild(pid, { autoExit = false } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return true;
  };
  if (autoExit) queueMicrotask(() => child.emit("exit", 0, null));
  return child;
}

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-runtime-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const layout = resolveMemoryLayout({
    env: { LOCALAPPDATA: home },
    platform: "win32",
  });
  const binaryPath = path.join(home, "ai-memory.exe");
  fs.writeFileSync(binaryPath, "binary");
  return { home, layout, binaryPath };
}

test("setup instala, inicia com env mínimo e publica health sem expor token", async (t) => {
  const { layout, binaryPath } = fixture(t);
  const calls = { spawn: [], random: 0 };
  let probes = 0;
  const runtime = createMemoryRuntime({
    root,
    layout,
    spawnImpl(file, args, options) {
      const child = fakeChild(501);
      calls.spawn.push({ file, args, options, child });
      return child;
    },
    fetchImpl: async () => {
      probes += 1;
      if (probes === 1) throw new Error("ECONNREFUSED");
      return statusResponse({ data_dir: layout.dataDir });
    },
    installer: async () => ({ binaryPath, installed: true }),
    randomBytes: () => {
      calls.random += 1;
      return Buffer.alloc(24, 7);
    },
    sleep: async () => {},
    startupAttempts: 1,
  });

  assert.deepEqual(runtime.status(), {
    state: "unconfigured",
    version: "1.13.0",
    endpoint: "http://127.0.0.1:49374",
    managed: false,
    pid: null,
    latencyMs: null,
    lastHealthAt: null,
    lastError: null,
  });

  await runtime.setup();
  assert.equal(calls.spawn[0].file, binaryPath);
  assert.deepEqual(calls.spawn[0].args, [
    "serve",
    "--transport",
    "http",
    "--bind",
    "127.0.0.1:49374",
    "--enable-web",
  ]);
  assert.equal(calls.spawn[0].options.shell, false);
  assert.equal(calls.spawn[0].options.env.OPENAI_API_KEY, undefined);
  assert.equal(calls.spawn[0].options.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(calls.spawn[0].options.env.GOOGLE_API_KEY, undefined);
  assert.equal(calls.spawn[0].options.env.AI_MEMORY_DATA_DIR, layout.dataDir);
  assert.equal(runtime.status().state, "healthy");
  assert.equal(runtime.status().managed, true);
  assert.equal(runtime.status().pid, 501);
  assert.equal(JSON.stringify(runtime.status()).includes("070707"), false);

  await runtime.setup();
  assert.equal(calls.random, 1);
  assert.equal(calls.spawn.length, 1);
  assert.equal(fs.readFileSync(layout.tokenPath, "utf8"), "07".repeat(24));
});

test("porta ocupada por serviço desconhecido falha fechada e nunca recebe kill", async (t) => {
  const { layout, binaryPath } = fixture(t);
  let spawnCount = 0;
  const runtime = createMemoryRuntime({
    root,
    layout,
    spawnImpl() {
      spawnCount += 1;
      return fakeChild(502);
    },
    fetchImpl: async () => statusResponse({ version: undefined, counts: undefined }),
    installer: async () => ({ binaryPath, installed: true }),
    randomBytes: () => Buffer.alloc(24, 8),
  });

  await runtime.setup();
  assert.equal(runtime.status().state, "port_conflict");
  assert.equal(runtime.status().managed, false);
  assert.equal(spawnCount, 0);
  assert.equal(await runtime.stopManaged(), false);
});

test("timeout de health depois do spawn resulta degraded", async (t) => {
  const { layout, binaryPath } = fixture(t);
  const child = fakeChild(503);
  const runtime = createMemoryRuntime({
    root,
    layout,
    spawnImpl: () => child,
    fetchImpl: async () => {
      throw new DOMException("timeout", "TimeoutError");
    },
    installer: async () => ({ binaryPath, installed: true }),
    randomBytes: () => Buffer.alloc(24, 9),
    sleep: async () => {},
    startupAttempts: 2,
  });

  await runtime.setup();
  assert.equal(runtime.status().state, "degraded");
  assert.match(runtime.status().lastError, /health|timeout/i);
  assert.equal(runtime.status().managed, true);
});

test("stopManaged encerra somente o child criado pela instância", async (t) => {
  const { layout, binaryPath } = fixture(t);
  const child = fakeChild(504);
  let probes = 0;
  const runtime = createMemoryRuntime({
    root,
    layout,
    spawnImpl: () => child,
    fetchImpl: async () => {
      if (probes++ === 0) throw new Error("ECONNREFUSED");
      return statusResponse({ data_dir: layout.dataDir });
    },
    installer: async () => ({ binaryPath, installed: true }),
    randomBytes: () => Buffer.alloc(24, 10),
    sleep: async () => {},
    startupAttempts: 1,
  });

  await runtime.setup();
  assert.equal(await runtime.stopManaged(), true);
  assert.equal(child.killed, true);
  assert.equal(runtime.status().managed, false);
  assert.equal(runtime.status().pid, null);
});

test("reindex para o servidor gerenciado, executa manutenção e reinicia", async (t) => {
  const { layout, binaryPath } = fixture(t);
  const calls = [];
  let pid = 600;
  let firstProbe = true;
  const runtime = createMemoryRuntime({
    root,
    layout,
    spawnImpl(file, args, options) {
      const child = fakeChild(pid++, { autoExit: args[0] === "reindex" });
      calls.push({ file, args, options, child });
      return child;
    },
    fetchImpl: async () => {
      if (firstProbe) {
        firstProbe = false;
        throw new Error("ECONNREFUSED");
      }
      return statusResponse({ data_dir: layout.dataDir });
    },
    installer: async () => ({ binaryPath, installed: true }),
    randomBytes: () => Buffer.alloc(24, 11),
    sleep: async () => {},
    startupAttempts: 1,
  });

  await runtime.setup();
  await runtime.runMaintenance("reindex");

  assert.deepEqual(calls.map((call) => call.args[0]), ["serve", "reindex", "serve"]);
  assert.equal(calls[0].child.killed, true);
  assert.equal(runtime.status().state, "healthy");
  assert.equal(runtime.status().managed, true);
  assert.equal(runtime.status().pid, 602);
});
