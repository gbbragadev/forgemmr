import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager, validateP0Market } from "../engine.mjs";

const market = (fields) => `## Mercado\n\n${fields.join("\n")}`;

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-p0-market-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "fake", name: "Fake", cli: "fake", model: "default", jobs: [], roles: [] }],
      teams: { "dry-run": { dispatch: { default: "fake" }, fallbacks: {} } },
    }),
    "utf8"
  );
  return root;
}

async function waitFor(condition, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timeout esperando p0-go");
}

test("P0 reprova scorecard sem Mercado", () => {
  const result = validateP0Market("# Scorecard\n\n**GO**\n\nTipo: static\n");
  assert.equal(result.pass, false);
  assert.match(result.detail, /mercado ausente/i);
});

test("P0 reprova campos de Mercado vazios ou placeholders", () => {
  const result = validateP0Market(market([
    "- **Comprador:** __",
    "- **Canal:** TODO",
    "- **Preço-alvo:** a definir",
    "- **Recorrência:** não sei",
  ]));
  assert.equal(result.pass, false);
  assert.match(result.detail, /Comprador.*Canal.*Preço-alvo.*Recorrência/i);
});

test("P0 aceita Markdown, acentos e NO-GO com mercado completo", () => {
  const result = validateP0Market("# Scorecard\n\n**NO-GO**\n\n" + market([
    "- **Comprador**: moderadores de comunidades de anime que vendem eventos locais",
    "- **Canal:** grupos públicos de Discord e posts orgânicos no TikTok",
    "- **Preço-alvo:** R$ 9,90/mês — menor que um lanche do evento",
    "- **Recorrência**: agenda semanal muda e pede divulgação recorrente",
  ]));
  assert.deepEqual(result, { pass: true, detail: "mercado declarado" });
});

test("dry-run P0 fake chega ao gate p0-go", async () => {
  const root = tmpRoot();
  try {
    const manager = createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
    manager.start({ idea: "quiz de abertura de anime", team: "dry-run", capability: "quiz", appId: "market-fake" });
    await waitFor(() => manager.snapshot()["market-fake"]?.status === "paused_gate");

    const pipeline = manager.snapshot()["market-fake"];
    assert.equal(pipeline.gates.find((gate) => !gate.decision)?.id, "p0-go");
    assert.equal(pipeline.history.find((entry) => entry.job === "L0/P0")?.pass, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
