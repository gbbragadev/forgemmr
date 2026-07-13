import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detectRateLimit } from "../adapters.mjs";
import { createEngineManager } from "../engine.mjs";

const providerFailures = [
  "API Error: 429 Too Many Requests",
  'API Error: 529 {"error":"temporarily overloaded"}',
  "Error: usage limit reached for this account",
  "Error: quota exceeded",
  "quota reached",
  "temporarily overloaded; retry later",
  "HTTP 503 Service Unavailable",
  "503 Service Unavailable",
  "Error: overloaded_error",
  "429 rate limit exceeded",
];

const agentMentions = [
  "Criei o handler: if (res.status === 429) retry()",
  "Adicionei rate limit por sessão/IP no middleware",
  "| Custo free path | cap 3 textos; rate limit session/IP |",
  "Job concluído: 12 arquivos, build ok, 429 linhas alteradas",
];

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-ratelimit-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "fake-1", face: "fake", name: "Fake", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] }],
      teams: { "dry-run": { emoji: "fake", label: "fake executor", dispatch: { default: "fake-1" }, fallbacks: {} } },
    }),
    "utf8"
  );
  return root;
}

async function waitFor(condition, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timeout esperando p0-go");
}

test("detectRateLimit reconhece falhas do provedor, não menções do agente", () => {
  for (const text of providerFailures) assert.equal(detectRateLimit(text), true, text);
  for (const text of agentMentions) assert.equal(detectRateLimit(text), false, text);
  assert.equal(detectRateLimit("rate limit exceeded"), true);
});

test("fake-exec ecoa goal quando FORGE_FAKE_ECHO está presente, mesmo vazio", () => {
  const root = tmpRoot();
  const fakeExec = fileURLToPath(new URL("../fake-exec.mjs", import.meta.url));
  const goal = "goal curto para echo";

  try {
    const result = spawnSync(process.execPath, [fakeExec, goal], {
      env: { ...process.env, FORGE_ROOT: root, FORGE_FAKE_ECHO: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /goal curto para echo/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("saída 0 que menciona rate limit 429 chega ao gate sem cooldown", async () => {
  const root = tmpRoot();
  const logs = [];
  const previousEcho = process.env.FORGE_FAKE_ECHO;
  let manager;
  process.env.FORGE_FAKE_ECHO = "1";

  try {
    manager = createEngineManager({ root, emitLog: (line) => logs.push(line), emitPipeline: () => {} });
    manager.start({ idea: "ideia de teste menciona rate limit 429", team: "dry-run", appId: "rate-limit-mention" });

    await waitFor(() => manager.snapshot()["rate-limit-mention"]?.status === "paused_gate");
    const pipeline = manager.snapshot()["rate-limit-mention"];
    assert.equal(pipeline.gates.find((gate) => !gate.decision)?.id, "p0-go");
    assert.deepEqual(pipeline.cooldowns, {});
    assert.ok(!logs.some((line) => /⏳ rate-limit em/.test(line)), "menção do agente não deve ser classificada como rate-limit");
  } finally {
    const status = manager?.snapshot()["rate-limit-mention"]?.status;
    if (["running", "paused_gate", "blocked"].includes(status)) {
      try {
        manager.kill("rate-limit-mention");
      } catch {}
    }
    if (previousEcho === undefined) delete process.env.FORGE_FAKE_ECHO;
    else process.env.FORGE_FAKE_ECHO = previousEcho;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
