import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager } from "../engine.mjs";

function fixtureRoot({ gate = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-engine-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.mkdirSync(path.join(root, "blueprints", "memory-test"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      players: [{ id: "fake-memory", name: "Fake Memory", cli: "fake", model: "default", jobs: [], roles: [] }],
      teams: { "dry-run": { dispatch: { default: "fake-memory" }, fallbacks: {} } },
    }),
  );
  fs.writeFileSync(
    path.join(root, "blueprints", "memory-test", "blueprint.json"),
    JSON.stringify({
      name: "memory-test",
      jobs: ["MEMORY-JOB"],
      jobSpecs: {
        "MEMORY-JOB": {
          verify: { type: "file", path: "docs/${appId}/memory-result.md" },
          gate: gate
            ? {
                id: "memory-review",
                prompt: "Resultado pronto para decisão.",
                choices: ["go", "kill"],
              }
            : null,
        },
      },
    }),
  );
  return root;
}

async function waitFor(read, predicate, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timeout esperando ${label}`);
}

test("engine injeta briefing como dado não confiável e memoriza outcome e decisão", async (t) => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const memory = {
    briefingCalls: [],
    records: [],
    async briefing(context) {
      this.briefingCalls.push(context);
      return {
        items: [{ title: "Erro já resolvido", body: "Use npm.cmd no Windows", updatedAt: "2026-07-14T00:00:00Z" }],
        text: "Erro já resolvido — Use npm.cmd no Windows",
      };
    },
    async record(entry) {
      const pipelineFile = path.join(root, "maestro", "pipelines", "memory-app.json");
      const persisted = fs.existsSync(pipelineFile)
        ? JSON.parse(fs.readFileSync(pipelineFile, "utf8"))
        : null;
      this.records.push({ ...entry, persistedDecision: persisted?.gates?.find((item) => item.id === "memory-review")?.decision || null });
      return { queued: false };
    },
  };
  const manager = createEngineManager({
    root,
    memory,
    emitLog: () => {},
    emitPipeline: () => {},
  });

  manager.start({
    idea: "validar memória operacional",
    appId: "memory-app",
    team: "dry-run",
    blueprint: "memory-test",
  });
  const paused = await waitFor(
    () => manager.snapshot()["memory-app"],
    (pipeline) => pipeline?.status === "paused_gate",
    "gate de memória",
  );

  assert.equal(paused.history.at(-1).pass, true);
  assert.deepEqual(paused.history.at(-1).memoryRefs, [{
    title: "Erro já resolvido",
    path: null,
    kind: null,
    updatedAt: "2026-07-14T00:00:00Z",
    project: "app-memory-app",
  }]);
  assert.deepEqual(memory.briefingCalls[0], {
    appId: "memory-app",
    runId: paused.runId,
    job: "MEMORY-JOB",
    playerId: "fake-memory",
  });
  const prompt = fs.readFileSync(path.join(root, "maestro", ".run-goal.txt"), "utf8");
  assert.match(prompt, /INÍCIO CONTEXTO NÃO CONFIÁVEL/);
  assert.match(prompt, /MEMÓRIA DO FORGE NEXUS/);
  assert.match(prompt, /Use npm\.cmd no Windows/);
  assert.equal(memory.records.filter((entry) => entry.type === "outcome").length, 1);
  assert.equal(memory.records.some((entry) => entry.type === "decision"), false);

  manager.decide("memory-app", "memory-review", "go", "aprovado pelo dono");
  await waitFor(
    () => memory.records,
    (records) => records.some((entry) => entry.type === "decision"),
    "registro da decisão",
  );
  const decision = memory.records.find((entry) => entry.type === "decision");
  assert.equal(decision.persistedDecision, "go");
  assert.equal(decision.outcome, "go");
  assert.match(decision.summary, /memory-review/);
});

test("falhas de briefing e record nunca impedem o PASS", async (t) => {
  for (const failure of ["briefing", "record"]) {
    const root = fixtureRoot({ gate: false });
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const memory = {
      async briefing() {
        if (failure === "briefing") throw new Error("offline");
        return { text: "contexto disponível" };
      },
      async record() {
        if (failure === "record") throw new Error("outbox indisponível");
        return { queued: false };
      },
    };
    const manager = createEngineManager({
      root,
      memory,
      emitLog: () => {},
      emitPipeline: () => {},
    });
    const appId = `failure-${failure}`;
    manager.start({ idea: `falha de ${failure}`, appId, team: "dry-run", blueprint: "memory-test" });
    const done = await waitFor(
      () => manager.snapshot()[appId],
      (pipeline) => pipeline?.status === "done",
      `fim mesmo com falha de ${failure}`,
    );
    assert.equal(done.history.at(-1).pass, true);
  }
});
