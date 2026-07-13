import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEngineManager } from "../engine.mjs";

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-rm-"));
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
  fs.mkdirSync(path.join(root, "workbench"), { recursive: true });
  for (const f of ["QUEUE.md", "CLAIMS.md", "HANDOFF.md"]) {
    fs.writeFileSync(path.join(root, "workbench", f), `# ${f}\n\n## Doing\n\n## Done\n`, "utf8");
  }
  return root;
}

const mk = (root) => createEngineManager({ root, emitLog: () => {}, emitPipeline: () => {} });

async function waitFor(cond, ms = 30000, label = "condição") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout esperando ${label}`);
}

test("remove: apaga app (repo incluso), estado, proposals e some do snapshot", async () => {
  const root = tmpRoot();
  const mgr = mk(root);
  mgr.start({ idea: "app para remover no teste", team: "dry-run", appId: "rm-app" });
  await waitFor(() => mgr.snapshot()["rm-app"].status === "paused_gate", 30000, "gate");
  mgr.decide("rm-app", "p0-go", "kill"); // encerra (sem run ativo → remove sem force)

  // proposals ficam sob maestro/ (não sob o app)
  fs.mkdirSync(path.join(root, "maestro", "proposals", "rm-app"), { recursive: true });
  fs.writeFileSync(path.join(root, "maestro", "proposals", "rm-app", "proposal-1.html"), "x", "utf8");

  assert.ok(fs.existsSync(path.join(root, "apps", "rm-app", ".git")), "pré-condição: repo do app existe");
  const res = mgr.removeApp("rm-app");

  assert.ok(!fs.existsSync(path.join(root, "apps", "rm-app")), "apps/<app> deveria sumir (com .git)");
  assert.ok(!fs.existsSync(path.join(root, "maestro", "pipelines", "rm-app.json")), "estado deveria sumir");
  assert.ok(!fs.existsSync(path.join(root, "maestro", "proposals", "rm-app")), "proposals deveriam sumir");
  assert.ok(!("rm-app" in mgr.snapshot()), "não deveria aparecer no snapshot");
  assert.ok(res.removed.length >= 3, "deveria reportar o que removeu");
});

test("remove: recusa app com run ativo sem force; com force mata e remove", async () => {
  const root = tmpRoot();
  const mgr = mk(root);
  mgr.start({ idea: "app ativo que nao pode sumir", team: "dry-run", appId: "rm-live" });
  await waitFor(() => mgr.snapshot()["rm-live"].status === "paused_gate", 30000, "gate");

  assert.throws(() => mgr.removeApp("rm-live"), /run ativo/i);
  assert.ok(fs.existsSync(path.join(root, "apps", "rm-live")), "não pode ter removido nada");

  mgr.removeApp("rm-live", { force: true });
  assert.ok(!fs.existsSync(path.join(root, "apps", "rm-live")));
  assert.ok(!("rm-live" in mgr.snapshot()));
});

test("remove: estado órfão (sem dir do app) é limpo mesmo assim", async () => {
  const root = tmpRoot();
  const mgr = mk(root);
  mgr.start({ idea: "app cujo diretorio sumiu", team: "dry-run", appId: "rm-orfao" });
  await waitFor(() => mgr.snapshot()["rm-orfao"].status === "paused_gate", 30000, "gate");
  mgr.decide("rm-orfao", "p0-go", "kill");
  fs.rmSync(path.join(root, "apps", "rm-orfao"), { recursive: true, force: true }); // dir sumiu na mão

  mgr.removeApp("rm-orfao");
  assert.ok(!fs.existsSync(path.join(root, "maestro", "pipelines", "rm-orfao.json")), "estado órfão deveria sumir");
  assert.ok(!("rm-orfao" in mgr.snapshot()));
});

test("kill: mata run em andamento (running, SEM gate) — era o buraco da tecla [k] no TUI", async () => {
  const root = tmpRoot();
  const mgr = mk(root);
  mgr.start({ idea: "run que vai ser morto no meio", team: "dry-run", appId: "kill-live" });
  // pega a pipeline RODANDO (sem gate pendente) — é aqui que o TUI não conseguia matar
  assert.equal(mgr.snapshot()["kill-live"].status, "running");
  assert.equal((mgr.snapshot()["kill-live"].gates || []).filter((g) => !g.decision).length, 0, "pré-condição: sem gate");

  const res = mgr.kill("kill-live");
  assert.equal(res.ok, true);
  assert.equal(mgr.snapshot()["kill-live"].status, "killed");
});

test("kill: run já encerrado devolve erro claro (não explode)", async () => {
  const root = tmpRoot();
  const mgr = mk(root);
  mgr.start({ idea: "run que morre e depois recebe kill de novo", team: "dry-run", appId: "kill-twice" });
  mgr.kill("kill-twice");
  const again = mgr.kill("kill-twice");
  assert.equal(again.ok, false);
  assert.match(again.error, /killed|nada/i);
});

test("remove: appId inválido não vira path traversal", () => {
  const root = tmpRoot();
  const mgr = mk(root);
  for (const bad of ["../maestro", "..", "a/b", "C:\\Windows"]) {
    assert.throws(() => mgr.removeApp(bad), /inválido/i, `deveria recusar "${bad}"`);
  }
  assert.ok(fs.existsSync(path.join(root, "maestro", "roster.json")), "nada da fábrica pode sumir");
});
