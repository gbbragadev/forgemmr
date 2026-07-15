import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createEngineManager } from "../engine.mjs";

/** Root temporário com o mínimo que a engine precisa: roster com team dry-run. */
function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-conc-"));
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

function makeManager(root, logs = []) {
  return createEngineManager({
    root,
    emitLog: (l) => logs.push(l),
    emitPipeline: () => {},
  });
}

/** espera até cond() ou estoura em ~timeoutMs */
async function waitFor(cond, timeoutMs = 30000, label = "condição") {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout esperando ${label}`);
}

test("concorrência: 2 dry-runs simultâneos avançam independentes até o gate p0-go", async () => {
  const root = tmpRoot();
  const logs = [];
  const mgr = makeManager(root, logs);

  mgr.start({ idea: "app A de teste concorrente", team: "dry-run", capability: "static", appId: "app-a" });
  mgr.start({ idea: "app B de teste concorrente", team: "dry-run", capability: "static", appId: "app-b" });

  // os dois SIMULTANEAMENTE vivos desde o começo
  const snap0 = mgr.snapshot();
  assert.deepEqual(Object.keys(snap0).sort(), ["app-a", "app-b"]);
  assert.ok(["running", "paused_gate"].includes(snap0["app-a"].status));
  assert.ok(["running", "paused_gate"].includes(snap0["app-b"].status));

  await waitFor(() => {
    const s = mgr.snapshot();
    return s["app-a"].status === "paused_gate" && s["app-b"].status === "paused_gate";
  }, 30000, "ambos em paused_gate");

  const s = mgr.snapshot();
  for (const id of ["app-a", "app-b"]) {
    assert.equal(s[id].gates.filter((g) => !g.decision)[0].id, "p0-go", `${id} deveria estar no gate p0-go`);
    // repo próprio com init + checkpoint
    const log = execFileSync("git", ["log", "--oneline"], { cwd: path.join(root, "apps", id), encoding: "utf8" });
    assert.ok(log.includes("L0/P0 PASS"), `${id}: falta checkpoint L0/P0`);
    assert.ok(log.includes("init app repo"), `${id}: falta commit inicial`);
    // scorecard no repo do app + estado por app
    assert.ok(fs.existsSync(path.join(root, "apps", id, "docs", "scorecard.md")), `${id}: falta scorecard`);
    assert.ok(fs.existsSync(path.join(root, "maestro", "pipelines", `${id}.json`)), `${id}: falta estado persistido`);
  }

  // logs etiquetados por app
  assert.ok(logs.some((l) => l.startsWith("[app-a]")));
  assert.ok(logs.some((l) => l.startsWith("[app-b]")));

  // decidir o gate de A não afeta B
  mgr.decide("app-a", "p0-go", "kill");
  assert.equal(mgr.snapshot()["app-a"].status, "killed");
  assert.equal(mgr.snapshot()["app-b"].status, "paused_gate");

  // decide sem appId com exatamente 1 ativa → fallback resolve pra B
  mgr.decide(undefined, "p0-go", "kill");
  assert.equal(mgr.snapshot()["app-b"].status, "killed");
});

test("resume pós-restart: novo manager reconstrói pipelines de maestro/pipelines/*.json", async () => {
  const root = tmpRoot();
  const mgr1 = makeManager(root);
  mgr1.start({ idea: "app persistente de teste", team: "dry-run", capability: "static", appId: "persist-a" });
  await waitFor(() => mgr1.snapshot()["persist-a"].status === "paused_gate", 30000, "persist-a no gate");

  // "restart": manager novo, do disco
  const mgr2 = makeManager(root);
  const snap = mgr2.snapshot();
  assert.ok(snap["persist-a"], "estado não recarregado do disco");
  assert.equal(snap["persist-a"].status, "paused_gate");
  assert.equal(snap["persist-a"].gates.filter((g) => !g.decision)[0].id, "p0-go");
  // e dá pra decidir no manager novo
  mgr2.decide("persist-a", "p0-go", "kill");
  assert.equal(mgr2.snapshot()["persist-a"].status, "killed");
});

test("restart preserves a completed pipeline so it can be iterated", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, "maestro", "pipelines"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "pipelines", "shipped-app.json"),
    JSON.stringify({
      appId: "shipped-app",
      status: "done",
      currentJob: null,
      jobs: ["L0/P0", "L1/B5", "P3"],
      jobIndex: 3,
      gates: [],
      history: [
        { job: "L0/P0", pass: true },
        { job: "L1/B5", pass: true },
      ],
      cooldowns: {},
      deploy: { url: "https://shipped.example" },
      endedAt: "2026-07-14T12:00:00.000Z",
    }),
    "utf8",
  );

  const snapshot = makeManager(root).snapshot()["shipped-app"];
  assert.equal(snapshot.status, "done");
  assert.equal(snapshot.endedAt, "2026-07-14T12:00:00.000Z");
  assert.deepEqual(snapshot.history.map((entry) => entry.job), ["L0/P0", "L1/B5"]);
});

test("manual simulation on a completed app runs one safe ITERATE → B5 cycle before deploy gate", async () => {
  const root = tmpRoot();
  const app = path.join(root, "apps", "sim-app");
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "@forge/sim-app" }));
  execFileSync("git", ["init"], { cwd: app });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: app });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: app });
  execFileSync("git", ["add", "."], { cwd: app });
  execFileSync("git", ["commit", "-m", "init"], { cwd: app });
  fs.mkdirSync(path.join(root, "maestro", "pipelines"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "pipelines", "sim-app.json"), JSON.stringify({
    appId: "sim-app",
    status: "done",
    jobs: ["P3"],
    jobIndex: 1,
    gates: [],
    history: [],
    cooldowns: {},
    deploy: { target: "gh-pages", subdomain: "sim-app", baseUrl: "example.com" },
  }));

  const manager = makeManager(root);
  manager.startSimulation({ appId: "sim-app", team: "dry-run" });
  await waitFor(() => manager.snapshot()["sim-app"].status === "paused_gate", 30_000, "simulação no gate deploy");
  const pipeline = manager.snapshot()["sim-app"];
  assert.deepEqual(pipeline.jobs, ["SIMULATE", "ITERATE", "L1/B5", "P3"]);
  assert.equal(pipeline.simulationAutoIterationUsed, true);
  assert.equal(pipeline.gates.find((gate) => !gate.decision)?.id, "deploy");
  assert.equal(pipeline.history.filter((entry) => entry.job === "ITERATE").length, 1);
  manager.decide("sim-app", "deploy", "kill");
});

test("guard é POR APP: re-start do mesmo app ativo explica que outros apps rodam em paralelo", async () => {
  const root = tmpRoot();
  const mgr = makeManager(root);
  mgr.start({ idea: "app original de teste do guard", team: "dry-run", appId: "guard-a" });
  await waitFor(() => mgr.snapshot()["guard-a"].status === "paused_gate", 30000, "guard-a no gate");
  assert.throws(
    () => mgr.start({ idea: "segundo run do mesmo app", team: "dry-run", appId: "guard-a" }),
    /guard-a.*outros apps rodam em paralelo/s
  );
  // outro app começa numa boa enquanto o primeiro segue ativo
  mgr.start({ idea: "outro app em paralelo ao guard", team: "dry-run", appId: "guard-b" });
  assert.ok(["running", "paused_gate"].includes(mgr.snapshot()["guard-b"].status));
  mgr.decide("guard-a", "p0-go", "kill");
  await waitFor(() => mgr.snapshot()["guard-b"].status === "paused_gate", 30000, "guard-b no gate");
  mgr.decide("guard-b", "p0-go", "kill");
});

test("team é resolvido case-insensitive (CxB → cxb)", async () => {
  const root = tmpRoot();
  // adiciona um team com nome minúsculo e chama com caixa mista
  const rosterPath = path.join(root, "maestro", "roster.json");
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  roster.teams.cxb = roster.teams["dry-run"];
  fs.writeFileSync(rosterPath, JSON.stringify(roster), "utf8");
  const mgr = makeManager(root);
  mgr.start({ idea: "team com caixa mista deve resolver", team: "CxB", appId: "case-team" });
  assert.equal(mgr.snapshot()["case-team"].team, "cxb");
  await waitFor(() => mgr.snapshot()["case-team"].status === "paused_gate", 30000, "case-team no gate");
  mgr.decide("case-team", "p0-go", "kill");
});

test("migração: maestro/pipeline.json legado vira maestro/pipelines/<appId>.json", () => {
  const root = tmpRoot();
  const legacyState = { appId: "legado-x", status: "paused_gate", idea: "x", team: "dry-run", jobs: ["L0/P0"], jobIndex: 1, gates: [{ id: "p0-go", choices: ["go", "kill"], decision: null }], history: [], cooldowns: {}, git: {} };
  fs.writeFileSync(path.join(root, "maestro", "pipeline.json"), JSON.stringify(legacyState), "utf8");
  const mgr = makeManager(root);
  assert.ok(!fs.existsSync(path.join(root, "maestro", "pipeline.json")), "legado deveria ter sido movido");
  assert.ok(fs.existsSync(path.join(root, "maestro", "pipelines", "legado-x.json")));
  assert.equal(mgr.snapshot()["legado-x"].status, "paused_gate");
});
