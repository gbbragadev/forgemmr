import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCapabilityFromScorecard, createEngineManager, JOBS_BY_CAPABILITY } from "../engine.mjs";

// ---------- parse ----------

test("parse: linha 'Tipo: chat' (e variantes de markdown) define a capability", () => {
  assert.equal(parseCapabilityFromScorecard("# Scorecard\n\nTipo: chat\n"), "chat");
  assert.equal(parseCapabilityFromScorecard("**Tipo:** quiz\n"), "quiz");
  assert.equal(parseCapabilityFromScorecard("- capability: static\n"), "static");
  assert.equal(parseCapabilityFromScorecard("## Tipo: **chat**\n"), "chat");
  assert.equal(parseCapabilityFromScorecard("TIPO: QUIZ"), "quiz");
});

test("parse: sem declaração (ou só menção em prosa) devolve null", () => {
  assert.equal(parseCapabilityFromScorecard("# Scorecard\n\n**GO**\n"), null);
  assert.equal(parseCapabilityFromScorecard("O tipo: chat apareceu na conversa\n"), null);
});

// ---------- fluxo: P0 decide, GO aplica ----------

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-cap-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "fake-1", face: "🧪", name: "Fake", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] }],
      teams: { "dry-run": { emoji: "🧪", label: "fake executor", dispatch: { default: "fake-1" }, fallbacks: {} } },
    }),
    "utf8"
  );
  return root;
}

async function waitFor(cond, timeoutMs = 30000, label = "condição") {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout esperando ${label}`);
}

test("capability auto: P0 propõe 'chat' (da ideia), gate mostra, GO aplica jobs com B4 + deploy server", async () => {
  const root = tmpRoot();
  const mgr = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
  // sem capability no start → auto; a ideia menciona chat → fake-exec declara Tipo: chat no scorecard
  mgr.start({ idea: "app de chat com waifus para conversar", team: "dry-run", appId: "cap-chat" });
  await waitFor(() => mgr.snapshot()["cap-chat"].status === "paused_gate", 30000, "gate p0-go");

  const snap1 = mgr.snapshot()["cap-chat"];
  const gate = snap1.gates.find((g) => !g.decision);
  assert.equal(gate.id, "p0-go");
  assert.ok(gate.choices.includes("retry"), "p0-go deveria aceitar retry (corrigir tipo com feedback)");
  assert.match(gate.prompt, /Tipo proposto: chat/);
  assert.ok(!snap1.jobs.includes("L1/B4"), "antes do GO os jobs são provisórios (static, sem B4)");

  mgr.decide("cap-chat", "p0-go", "go");
  const snap2 = mgr.snapshot()["cap-chat"];
  assert.equal(snap2.capability, "chat");
  assert.deepEqual(snap2.jobs, JOBS_BY_CAPABILITY.chat);
  assert.ok(snap2.jobs.includes("L1/B4"), "GO deveria ter aplicado a sequência chat (com B4)");
  assert.equal(snap2.deploy.target, "vercel"); // serverHost default do profile
  // deixa o run seguir sozinho até o próximo gate antes do tmp sumir (evita ruído de job órfão)
  await waitFor(() => mgr.snapshot()["cap-chat"].status === "paused_gate", 30000, "gate seguinte");
  mgr.stop("cap-chat");
});

test("capability explícita (--capability) continua manual: sem parse, sem retry-jobs", async () => {
  const root = tmpRoot();
  const mgr = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
  mgr.start({ idea: "quiz de chat sobre animes", team: "dry-run", capability: "static", appId: "cap-manual" });
  await waitFor(() => mgr.snapshot()["cap-manual"].status === "paused_gate", 30000, "gate p0-go");
  mgr.decide("cap-manual", "p0-go", "go");
  const snap = mgr.snapshot()["cap-manual"];
  assert.equal(snap.capability, "static"); // ideia menciona chat/quiz, mas o dono mandou static
  assert.deepEqual(snap.jobs, JOBS_BY_CAPABILITY.static);
  await waitFor(() => mgr.snapshot()["cap-manual"].status === "paused_gate", 30000, "gate seguinte");
  mgr.stop("cap-manual");
});
