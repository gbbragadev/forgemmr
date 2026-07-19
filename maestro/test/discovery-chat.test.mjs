import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createMaestroServer } from "../server.mjs";

class Stream extends EventEmitter {}
class Child extends EventEmitter {
  constructor() { super(); this.pid = 42; this.stdout = new Stream(); this.stderr = new Stream(); this.kills = []; }
  kill(signal) { this.kills.push(signal); }
}

function engine() {
  return {
    snapshot: () => ({}), cooldowns: () => ({}), start: () => null,
    startFeedback: () => null, decide: () => null, stop: () => ({ ok: true }), resume: () => null,
    setTarget: () => null, kill: () => null, removeApp: () => null,
  };
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

test("chat alterna Claude, Codex e Grok preservando contexto, metadata e falhas auditáveis", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-discovery-chat-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "roster.json"), JSON.stringify({
    players: [
      { id: "claude", adapter: "fake", cli: "claude", model: "sonnet" },
      { id: "codex", adapter: "fake", cli: "codex", model: "sol" },
      { id: "grok", adapter: "fake", cli: "grok", model: "grok" },
    ],
    teams: {},
  }));
  const children = [];
  const prompts = [];
  const server = createMaestroServer({
    root,
    engineManager: engine(),
    spawnImpl: (_cmd, args) => {
      const child = new Child();
      children.push(child);
      prompts.push(args.at(-1));
      return child;
    },
  });
  t.after(() => new Promise(resolve => server.close(() => { fs.rmSync(root, { recursive: true, force: true }); resolve(); })));
  const base = await listen(server);
  const token = (await (await fetch(`${base}/api/token`)).json()).token;
  const headers = { "content-type": "application/json", "x-maestro-token": token };

  async function execute(actionId, input, key) {
    const snapshot = await (await fetch(`${base}/api/control/snapshot`)).json();
    const response = await fetch(`${base}/api/control/actions/execute`, {
      method: "POST", headers,
      body: JSON.stringify({ actionId, input, stateVersion: snapshot.version, idempotencyKey: key }),
    });
    return { response, body: await response.json() };
  }

  const created = await execute("room.create", { title: "Chat canônico" }, "chat-room-create-001");
  const roomId = created.body.result.id;

  for (const [index, playerId] of ["claude", "codex", "grok"].entries()) {
    const sent = await execute("chat.send", { roomId, text: `pergunta-${index + 1}`, playerId, maxTurns: 1, resumeToken: "token-ignored-123" }, `chat-send-turn-00${index + 1}`);
    assert.equal(sent.response.status, 200);
    assert.equal(sent.body.result.playerId, playerId);
    assert.equal(sent.body.result.resumeUsed, false);
    assert.match(prompts[index], new RegExp(`pergunta-${index + 1}`));
    if (index > 0) assert.match(prompts[index], new RegExp(`resposta-${index}`));
    children[index].stdout.emit("data", `resposta-${index + 1}`);
    children[index].emit("close", 0);
  }

  const room = await (await fetch(`${base}/api/discovery/rooms/${roomId}`, { headers })).json();
  assert.deepEqual(room.messages.map(message => message.author), ["human", "assistant", "human", "assistant", "human", "assistant"]);
  assert.deepEqual(room.messages.filter(message => message.author === "assistant").map(message => message.executor.playerId), ["claude", "codex", "grok"]);

  const active = await execute("chat.send", { roomId, text: "fica ativa", playerId: "claude", maxTurns: 1 }, "chat-active-run-001");
  const blocked = await execute("chat.send", { roomId, text: "concorrente", playerId: "codex", maxTurns: 1 }, "chat-blocked-run-001");
  assert.equal(blocked.body.result.ok, false);
  assert.match(blocked.body.result.error, /run interativa ativa/);
  const stopped = await execute("chat.stop", { runId: active.body.result.runId }, "chat-stop-run-001");
  assert.equal(stopped.body.result.ok, true);

  const failed = await execute("chat.send", { roomId, text: "vai falhar", playerId: "grok", maxTurns: 1 }, "chat-error-run-001");
  children.at(-1).emit("error", new Error("falha fake"));
  const finalRoom = await (await fetch(`${base}/api/discovery/rooms/${roomId}`, { headers })).json();
  assert.ok(finalRoom.messages.some(message => /Falha auditável/.test(message.text)));
  assert.ok(failed.body.result.runId);

  const publicSnapshot = await (await fetch(`${base}/api/control/snapshot`)).json();
  assert.equal("response" in publicSnapshot.runner.runs.at(-1), false);
  assert.equal("error" in publicSnapshot.runner.runs.at(-1), false);
});
