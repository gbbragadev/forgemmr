import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createEngineManager,
  hasVisualImplementationChanges,
  jobExecutionMode,
  parseRecommendedDesignProposal,
} from "../engine.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-control-mode-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.mkdirSync(path.join(root, "blueprints", "control-test"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      players: [{ id: "fake", name: "Fake", cli: "fake", model: "default", jobs: [], roles: [] }],
      teams: { "dry-run": { dispatch: { default: "fake" }, fallbacks: {} } },
    }),
  );
  fs.writeFileSync(
    path.join(root, "blueprints", "control-test", "blueprint.json"),
    JSON.stringify({
      name: "control-test",
      jobs: ["DISCOVER", "SHAPE", "BUILD"],
      jobSpecs: {
        DISCOVER: { verify: { type: "file", path: "docs/${appId}/discover.md" } },
        SHAPE: { verify: { type: "file", path: "docs/${appId}/shape.md" } },
        BUILD: { verify: { type: "file", path: "docs/${appId}/build.md" } },
      },
    }),
  );
  return root;
}

function manager(root) {
  return createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });
}

async function waitFor(read, predicate, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout esperando ${label}`);
}

test("manual pausa entre jobs, persiste no restart e exige continue explícito", async () => {
  const root = fixtureRoot();
  try {
    const firstManager = manager(root);
    assert.equal(typeof firstManager.setControlMode, "function");
    assert.equal(typeof firstManager.continuePipeline, "function");

    firstManager.start({
      idea: "pipeline controlada manualmente",
      appId: "manual-app",
      team: "dry-run",
      blueprint: "control-test",
      controlMode: "manual",
    });
    const firstPause = await waitFor(
      () => firstManager.snapshot()["manual-app"],
      (pipeline) => pipeline?.status === "paused_control",
      "primeira pausa manual",
    );
    assert.equal(firstPause.controlMode, "manual");
    assert.equal(firstPause.controlPause.afterJob, "DISCOVER");
    assert.equal(firstPause.controlPause.nextJob, "SHAPE");
    assert.equal(firstPause.gates.length, 0);

    firstManager.continuePipeline("manual-app");
    await waitFor(
      () => firstManager.snapshot()["manual-app"],
      (pipeline) => pipeline?.status === "paused_control" && pipeline.controlPause?.afterJob === "SHAPE",
      "segunda pausa manual",
    );

    const restarted = manager(root);
    assert.equal(restarted.snapshot()["manual-app"].status, "paused_control");
    assert.equal(restarted.snapshot()["manual-app"].controlPause.afterJob, "SHAPE");
    assert.throws(() => restarted.setControlMode("manual-app", "chaos"), /modo de controle inválido/);

    restarted.setControlMode("manual-app", "autopilot_to_gate");
    assert.equal(restarted.snapshot()["manual-app"].status, "paused_control", "trocar modo não deve continuar sozinho");
    restarted.continuePipeline("manual-app");
    const done = await waitFor(
      () => restarted.snapshot()["manual-app"],
      (pipeline) => pipeline?.status === "done",
      "fim após continue",
    );
    assert.equal(done.controlPause, null);
    assert.deepEqual(done.history.filter((entry) => entry.pass).map((entry) => entry.job), ["DISCOVER", "SHAPE", "BUILD"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("autopilot_to_gate preserva os gates contratuais legados", async () => {
  const root = fixtureRoot();
  try {
    const mgr = manager(root);
    mgr.start({ idea: "pipeline automática", appId: "auto-app", team: "dry-run", blueprint: "control-test", controlMode: "autopilot_to_gate" });
    const automatic = await waitFor(
      () => mgr.snapshot()["auto-app"],
      (pipeline) => pipeline?.status === "done",
      "autopilot concluir",
    );
    assert.equal(automatic.controlMode, "autopilot_to_gate");
    assert.equal(automatic.controlPause, null);

    mgr.start({ idea: "gate humano preservado", appId: "gate-app", team: "dry-run", controlMode: "manual" });
    const gated = await waitFor(
      () => mgr.snapshot()["gate-app"],
      (pipeline) => pipeline?.status === "paused_gate",
      "gate p0-go",
    );
    assert.equal(gated.gates.find((gate) => !gate.decision)?.id, "p0-go");
    assert.equal(gated.controlPause, null);
    mgr.decide("gate-app", "p0-go", "kill");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full_auto decide gates locais e para antes do deploy", async () => {
  const root = fixtureRoot();
  try {
    const mgr = manager(root);
    mgr.start({ idea: "app static realmente automático", appId: "full-auto-app", team: "dry-run", capability: "static", controlMode: "full_auto" });

    const stopped = await waitFor(
      () => mgr.snapshot()["full-auto-app"],
      (pipeline) => pipeline?.status === "paused_gate" && pipeline.gates.find((gate) => !gate.decision)?.id === "deploy",
      "full auto chegar ao gate externo",
      45000,
    );

    assert.equal(stopped.controlMode, "full_auto");
    assert.equal(stopped.dsChoice, "2");
    assert.deepEqual(
      stopped.gates.filter((gate) => gate.automatic).map((gate) => [gate.id, gate.decision, gate.decidedBy]),
      [
        ["p0-go", "go", "orchestrator"],
        ["foundation-review", "go", "orchestrator"],
        ["ds-pick", "2", "orchestrator"],
        ["b3-visual", "go", "orchestrator"],
      ],
    );
    assert.equal(stopped.gates.find((gate) => !gate.decision)?.id, "deploy");
    mgr.decide("full-auto-app", "deploy", "kill");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full_auto para em sinal externo e não inventa validação de mercado", async () => {
  const root = fixtureRoot();
  try {
    const mgr = manager(root);
    mgr.start({ idea: "GO condicionado com validação externa", appId: "signal-app", team: "dry-run", capability: "static", controlMode: "full_auto" });
    const stopped = await waitFor(
      () => mgr.snapshot()["signal-app"],
      (pipeline) => pipeline?.status === "paused_gate" && pipeline.gates.find((gate) => !gate.decision)?.id === "p1-signal",
      "gate de sinal externo",
      30000,
    );
    assert.equal(stopped.gates.find((gate) => !gate.decision)?.automatic, undefined);
    mgr.decide("signal-app", "p1-signal", "kill");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("B3 usa implementação direta somente no full_auto", () => {
  assert.equal(jobExecutionMode("L1/B3", "full_auto"), "direct");
  assert.equal(jobExecutionMode("L1/B3", "autopilot_to_gate"), "delegated_prompt");
  assert.equal(jobExecutionMode("L1/B1", "full_auto"), "standard");
});

test("B3 full_auto exige diff real de interface", () => {
  assert.equal(hasVisualImplementationChanges(" M src/app/page.tsx\n?? docs/prompt.md"), true);
  assert.equal(hasVisualImplementationChanges(" M src\\components\\Hero.jsx"), true);
  assert.equal(hasVisualImplementationChanges("?? docs/prompts/design.md\n M README.md"), false);
});

test("full_auto escolhe somente recomendacao explicita do design-system", () => {
  assert.equal(parseRecommendedDesignProposal("Recomendação automática: proposta 3"), "3");
  assert.equal(parseRecommendedDesignProposal("## Escolha recomendada\nProposta 1"), "1");
  assert.equal(parseRecommendedDesignProposal("Três propostas sem decisão final"), null);
});

test("trocar uma pipeline pausada para full_auto resolve gate local e retoma", async () => {
  const root = fixtureRoot();
  try {
    const mgr = manager(root);
    mgr.start({ idea: "retomada automática", appId: "switch-app", team: "dry-run", capability: "static", controlMode: "autopilot_to_gate" });
    await waitFor(
      () => mgr.snapshot()["switch-app"],
      (pipeline) => pipeline?.status === "paused_gate" && pipeline.gates.find((gate) => !gate.decision)?.id === "p0-go",
      "p0 legado",
    );

    mgr.setControlMode("switch-app", "full_auto");
    const resumed = await waitFor(
      () => mgr.snapshot()["switch-app"],
      (pipeline) => pipeline?.gates.some((gate) => gate.id === "p0-go" && gate.automatic),
      "decisão automática do gate existente",
    );
    assert.equal(resumed.controlMode, "full_auto");
    assert.notEqual(resumed.gates.find((gate) => !gate.decision)?.id, "p0-go");
    mgr.kill("switch-app");
    await waitFor(() => mgr.snapshot()["switch-app"], (pipeline) => pipeline?.status === "killed", "kill da retomada");
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
