import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildControlSnapshot } from "../control/snapshot.mjs";
import { createOperationStore } from "../control/store.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-control-snapshot-"));
  fs.mkdirSync(path.join(root, "maestro", "runs"), { recursive: true });
  fs.mkdirSync(path.join(root, "profiles", "anime"), { recursive: true });
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  fs.mkdirSync(path.join(root, "blueprints", "campaign"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      players: [{ id: "fake-dry", name: "Fake", cli: "fake", modelLabel: "Dry", roles: ["qa"] }],
      teams: { "dry-run": { label: "Dry-run", emoji: "🎭", dispatch: { default: "fake-dry" }, fallbacks: {} } },
    }),
  );
  fs.writeFileSync(
    path.join(root, "profiles", "anime", "profile.md"),
    '# Anime\n\n```forge-config\n{"name":"Anime","niche":"anime"}\n```\n',
  );
  fs.writeFileSync(path.join(root, ".forge", "active.txt"), "anime");
  fs.writeFileSync(
    path.join(root, "blueprints", "campaign", "blueprint.json"),
    JSON.stringify({ name: "campaign", title: "Campaign", jobs: ["PLAN"], jobSpecs: {} }),
  );
  return root;
}

function engineWith(secret, status = "paused_gate") {
  return {
    snapshot() {
      return {
        "z-app": { appId: "z-app", status: "done", gates: [], history: [] },
        "a-app": {
          appId: "a-app",
          idea: `não vaze ${secret}`,
          status,
          currentJob: "L0/P0",
          deploy: { target: "cf-pages" },
          gates: [{ id: "p0-go", prompt: "Mercado validado?", choices: ["go", "kill"], decision: null }],
          history: [],
        },
      };
    },
    cooldowns: () => ({}),
  };
}

test("snapshot reúne a fábrica, ordena pipelines e descreve somente ações válidas", () => {
  const root = fixtureRoot();
  const secret = "control-secret-123456789";
  process.env.CONTROL_SECRET_TOKEN = secret;
  try {
    const snapshot = buildControlSnapshot({
      root,
      engineManager: engineWith(secret),
      operations: [],
      now: new Date("2026-07-14T12:00:00.000Z"),
    });

    assert.match(snapshot.version, /^[a-f0-9]{16}$/);
    assert.equal(snapshot.generatedAt, "2026-07-14T12:00:00.000Z");
    assert.deepEqual(snapshot.pipelines.map((pipeline) => pipeline.appId), ["a-app", "z-app"]);
    assert.deepEqual(snapshot.profiles.map((profile) => profile.slug), ["anime"]);
    assert.deepEqual(snapshot.teams.map((team) => team.id), ["dry-run"]);
    assert.deepEqual(snapshot.blueprints.map((blueprint) => blueprint.id), ["generic", "campaign"]);
    assert.equal(snapshot.decisions[0].gateId, "p0-go");
    assert.equal(snapshot.server.localOnly, true);

    const start = snapshot.actions.find((action) => action.id === "pipeline.start");
    assert.equal(start.risk, "safe");
    assert.equal(start.enabled, true);
    assert.ok(start.fields.find((field) => field.name === "team").options.includes("dry-run"));
    assert.deepEqual(start.fields.find((field) => field.name === "controlMode").options, [
      "full_auto", "autopilot_to_gate", "guided", "manual",
    ]);
    for (const actionId of ["operator.ingest", "operator.evolve", "profile.create", "profile.activate", "blueprint.save", "blueprint.migrate", "team.save", "providers.refresh", "provider.login"]) {
      assert.ok(snapshot.actions.some((action) => action.id === actionId), `ação de fábrica ausente: ${actionId}`);
    }

    const decide = snapshot.actions.find((action) => action.id === "gate.decide" && action.scope === "pipeline:a-app");
    assert.equal(decide.risk, "guarded");
    assert.deepEqual(decide.fields.find((field) => field.name === "choice").options, ["go", "kill"]);
    assert.equal(snapshot.actions.find((action) => action.id === "p4.record" && action.scope === "pipeline:z-app")?.enabled, true);
    assert.equal(snapshot.actions.find((action) => action.id === "p5.decide" && action.scope === "pipeline:z-app")?.enabled, false);
    assert.equal(snapshot.actions.find((action) => action.id === "pipeline.feedback" && action.scope === "pipeline:z-app")?.enabled, true);
    assert.equal(snapshot.actions.find((action) => action.id === "pipeline.simulate" && action.scope === "pipeline:z-app")?.enabled, true);
    assert.deepEqual(
      snapshot.actions.find((action) => action.id === "pipeline.control_mode" && action.scope === "pipeline:a-app")
        ?.fields.find((field) => field.name === "mode").options,
      ["full_auto", "autopilot_to_gate", "guided", "manual"],
    );

    for (const action of snapshot.actions) {
      assert.deepEqual(Object.keys(action), [
        "id", "scope", "label", "description", "risk", "enabled", "blockedReason", "expectedEffect", "fields",
      ]);
      assert.ok(["safe", "guarded", "external", "destructive"].includes(action.risk));
    }

    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(serialized, new RegExp(secret));
    assert.match(serialized, /\[redacted\]/i);
  } finally {
    delete process.env.CONTROL_SECRET_TOKEN;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("versão ignora o relógio, mas muda quando o estado muda", () => {
  const root = fixtureRoot();
  try {
    const first = buildControlSnapshot({ root, engineManager: engineWith("x", "paused_gate"), operations: [], now: new Date(0) });
    const later = buildControlSnapshot({ root, engineManager: engineWith("x", "paused_gate"), operations: [], now: new Date(1000) });
    const changed = buildControlSnapshot({ root, engineManager: engineWith("x", "blocked"), operations: [], now: new Date(1000) });
    assert.equal(first.version, later.version);
    assert.notEqual(first.version, changed.version);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("operation store persiste de forma atômica, privada e recuperável", () => {
  const root = fixtureRoot();
  try {
    const store = createOperationStore({ root });
    assert.deepEqual(store.list(), []);
    store.put({ id: "op-1", actionId: "pipeline.start", status: "queued", createdAt: "2026-07-14T12:00:00.000Z" });
    store.put({ id: "op-1", actionId: "pipeline.start", status: "succeeded", createdAt: "2026-07-14T12:00:00.000Z" });

    assert.equal(createOperationStore({ root }).get("op-1").status, "succeeded");
    const controlDir = path.join(root, ".control");
    assert.equal(fs.existsSync(path.join(controlDir, "operations.json.tmp")), false);
    assert.deepEqual(fs.readdirSync(controlDir), ["operations.json"]);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(controlDir, "operations.json"), "utf8")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
