import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildCanonicalBrief } from "../discovery/context.mjs";
import { createExecutorRunService } from "../executor-run-service.mjs";

class FakeStream extends EventEmitter {}
class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.pid = 123;
    this.stdout = new FakeStream();
    this.stderr = new FakeStream();
    this.kills = [];
  }
  kill(signal) { this.kills.push(signal); }
}

function fixture(players, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-runner-"));
  const rosterPath = path.join(root, "roster.json");
  fs.writeFileSync(rosterPath, JSON.stringify({ players }));
  const spawns = [];
  const children = [];
  const events = [];
  const service = createExecutorRunService({
    root, rosterPath,
    spawnImpl: (cmd, args, spawnOptions) => {
      if (options.throwSync) throw new Error(options.throwSync);
      const child = new FakeChild();
      children.push(child);
      spawns.push({ cmd, args, options: spawnOptions });
      return child;
    },
    emit: (type, payload) => events.push({ type, payload }),
    timeoutMs: options.timeoutMs ?? 10_000,
    setTimeoutImpl: options.setTimeoutImpl,
    clearTimeoutImpl: options.clearTimeoutImpl,
  });
  return { service, spawns, children, events, root };
}

const players = [
  { id: "claude", cli: "claude", model: "claude-sonnet-5", effort: "high" },
  { id: "codex", cli: "codex", model: "gpt-5.6-sol", effort: "max" },
  { id: "grok", cli: "grok", model: "grok-4", effort: "high" },
  { id: "glm", cli: "claude", adapter: "glm", model: "opus", effort: "max" },
];

test("seleciona adapters Claude, Codex, Grok e GLM e repassa model/effort", () => {
  const previous = process.env.GLM_API_KEY;
  process.env.GLM_API_KEY = "test-glm-key";
  try {
    for (const player of players) {
      const fx = fixture(players);
      const result = fx.service.start({ scope: "chat", playerId: player.id, prompt: "contexto", maxTurns: 3 });
      assert.equal(result.ok, true);
      const spawn = fx.spawns[0];
      if (player.id === "claude") assert.ok(spawn.args.includes("claude-sonnet-5"));
      if (player.id === "codex") {
        assert.ok(spawn.args.includes("gpt-5.6-sol"));
        assert.ok(spawn.args.some(value => String(value).includes("model_reasoning_effort=max")));
      }
      if (player.id === "grok") {
        const effort = spawn.args.indexOf("--effort");
        assert.notEqual(effort, -1);
        assert.equal(spawn.args[effort + 1], "high");
      }
      if (player.id === "glm") {
        assert.equal(spawn.cmd, "claude");
        assert.equal(spawn.options.env.ANTHROPIC_BASE_URL, "https://api.z.ai/api/anthropic");
      }
      fx.children[0].emit("close", 0);
    }
  } finally {
    if (previous === undefined) delete process.env.GLM_API_KEY; else process.env.GLM_API_KEY = previous;
  }
});

test("redige streams, limita output, bloqueia concorrência e snapshot é clonável", () => {
  process.env.RUNNER_TEST_SECRET = "runner-secret-123456789";
  try {
    const fx = fixture(players);
    const first = fx.service.start({ playerId: "claude", prompt: "p" });
    assert.equal(fx.service.start({ playerId: "codex", prompt: "p" }).ok, false);
    fx.children[0].stdout.emit("data", process.env.RUNNER_TEST_SECRET);
    fx.children[0].stderr.emit("data", "erro seguro");
    fx.children[0].stdout.emit("data", "x".repeat(300_000));
    fx.children[0].emit("close", 0);
    const snapshot = fx.service.snapshot();
    assert.doesNotThrow(() => structuredClone(snapshot));
    assert.equal(snapshot.activeRunId, null);
    assert.ok(snapshot.runs[0].response.length <= 256_000);
    assert.doesNotMatch(JSON.stringify(fx.events), /runner-secret-123456789/);
    assert.equal(fx.service.start({ playerId: "codex", prompt: "próximo" }).ok, true);
    fx.children[1].emit("close", 0);
    assert.ok(first.runId);
  } finally { delete process.env.RUNNER_TEST_SECRET; }
});

test("spawn síncrono, child error/close, stop e timeout finalizam uma vez e liberam slot", () => {
  const sync = fixture(players, { throwSync: "spawn quebrado" });
  assert.equal(sync.service.start({ playerId: "claude", prompt: "p" }).ok, false);
  assert.equal(sync.service.snapshot().activeRunId, null);

  const errored = fixture(players);
  errored.service.start({ playerId: "claude", prompt: "p" });
  errored.children[0].emit("error", new Error("child falhou"));
  errored.children[0].emit("close", 1);
  assert.equal(errored.events.filter(event => event.type === "run.finished").length, 1);
  assert.equal(errored.service.snapshot().activeRunId, null);

  const stopped = fixture(players);
  const run = stopped.service.start({ playerId: "claude", prompt: "p" });
  assert.equal(stopped.service.stop({ runId: run.runId }).ok, true);
  stopped.children[0].emit("close", 0);
  assert.equal(stopped.events.filter(event => event.type === "run.finished").length, 1);
  assert.deepEqual(stopped.children[0].kills, ["SIGTERM"]);

  let timeoutCallback;
  const timed = fixture(players, { setTimeoutImpl: callback => (timeoutCallback = callback, 1), clearTimeoutImpl: () => {} });
  timed.service.start({ playerId: "claude", prompt: "p" });
  timeoutCallback();
  timed.children[0].emit("close", 0);
  assert.equal(timed.service.snapshot().runs[0].status, "timeout");
  assert.equal(timed.events.filter(event => event.type === "run.finished").length, 1);
});

test("resume usa apenas contrato allowlisted e nunca altera prompt", () => {
  const resumable = { id: "safe", cli: "claude", resumeSupported: true, resumeArgs: ["--resume", "{token}"] };
  const fx = fixture([resumable, { id: "unsafe", cli: "claude", resumeSupported: true }]);
  assert.equal(fx.service.start({ playerId: "unsafe", prompt: "CANONICO", resumeToken: "token-valid-123" }).resumeUsed, false);
  assert.ok(fx.spawns[0].args.includes("CANONICO"));
  assert.equal(fx.spawns[0].args.some(value => String(value).includes("token-valid-123")), false);
  fx.children[0].emit("close", 0);
  assert.equal(fx.service.start({ playerId: "safe", prompt: "CANONICO", resumeToken: "token-valid-123" }).resumeUsed, true);
  assert.ok(fx.spawns[1].args.includes("--resume"));
  assert.ok(fx.spawns[1].args.includes("token-valid-123"));
  assert.equal(fx.spawns[1].args.some(value => String(value).includes("CANONICO\n")), false);
  fx.children[1].emit("close", 0);
});

test("briefing é determinístico, filtra unverified, marca externos e respeita UTF-8", () => {
  const input = {
    room: { messages: [
      { author: "human", text: "olá café", refs: ["https://example.com"] },
      { author: "assistant", text: "resposta" },
    ] },
    thesis: { id: "thesis-1", buyer: "síndico" },
    evidence: [
      { id: "e1", polarity: "supporting", source: "https://a", verification: { decision: "verified" } },
      { id: "e2", polarity: "contradicting", source: "https://b", verification: { decision: "verified" } },
      { id: "e3", observation: "não mostrar", verification: { decision: "unverified" } },
    ],
    experiments: [{ id: "x1", status: "running" }],
    maxBytes: 10_000,
  };
  const first = buildCanonicalBrief(input);
  assert.equal(first, buildCanonicalBrief(input));
  assert.match(first, /e1/);
  assert.match(first, /e2/);
  assert.doesNotMatch(first, /não mostrar/);
  assert.match(first, /NÃO CONFIÁVEL/);
  const short = buildCanonicalBrief({ ...input, maxBytes: 137 });
  assert.ok(Buffer.byteLength(short, "utf8") <= 137);
  assert.doesNotMatch(short, /�/);
});
