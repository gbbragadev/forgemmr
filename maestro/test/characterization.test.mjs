/**
 * Testes de CARACTERIZAÇÃO — congelam o comportamento ATUAL da engine (auditoria Modo A).
 *
 * Não julgam se o comportamento é bom: provam o que ele É hoje, para que a implementação
 * do plano de otimização (docs/optimization/) tenha um "antes" executável. Se um destes
 * testes quebrar depois de uma mudança, a mudança alterou comportamento observável —
 * intencional ou não, precisa ser justificada no PR.
 *
 * Tudo roda com o executor fake (dry-run, zero quota) num root temporário.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createEngineManager, validateP0Market } from "../engine.mjs";

/** Root temporário com o mínimo que a engine precisa: roster com team fake. */
function tmpRoot({ fallback = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-char-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  const players = [
    { id: "fake-1", face: "🧪", name: "Fake 1", cli: "fake", model: "default", modelLabel: "Fake", effort: "low", jobs: [], roles: [] },
  ];
  if (fallback) {
    players.push({ id: "fake-2", face: "🧪", name: "Fake 2", cli: "fake", model: "default", modelLabel: "Fake 2", effort: "low", jobs: [], roles: [] });
  }
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players,
      teams: {
        "dry-run": {
          emoji: "🧪",
          label: "fake executor",
          dispatch: { default: "fake-1" },
          fallbacks: fallback ? { "fake-1": ["fake-2"] } : {},
        },
      },
    }),
    "utf8"
  );
  return root;
}

function makeManager(root, logs = []) {
  return createEngineManager({ root, emitLog: (l) => logs.push(l), emitPipeline: () => {} });
}

async function waitFor(cond, timeoutMs = 30000, label = "condição") {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout esperando ${label}`);
}

const gitApp = (root, appId, args) =>
  execFileSync("git", args, { cwd: path.join(root, "apps", appId), encoding: "utf8" }).trim();

/**
 * CARACTERIZAÇÃO 1 — T-08 muda a estrutura exigida, não a decisão humana.
 *
 * NO-GO sem Mercado agora reprova; NO-GO completo continua elegível ao gate p0-go.
 */
test("caracterização: NO-GO sem Mercado reprova, mas NO-GO completo segue ao gate humano", async () => {
  assert.equal(validateP0Market("# Scorecard\n\n**NO-GO**\n\nTipo: static\n").pass, false);
  assert.equal(validateP0Market(`# Scorecard\n\n**NO-GO**\n\n## Mercado\n- **Comprador:** moderadores de comunidades de anime locais\n- **Canal:** grupos públicos de Discord\n- **Preço-alvo:** R$ 9,90/mês para organizar eventos\n- **Recorrência:** agenda semanal exige divulgação recorrente\n`).pass, true);

  const root = tmpRoot();
  try {
    const mgr = makeManager(root);
    mgr.start({ idea: "ideia ruim que deveria morrer", team: "dry-run", capability: "static", appId: "nogo-app" });
    await waitFor(() => mgr.snapshot()["nogo-app"].status === "paused_gate", 30000, "gate p0-go");
    assert.equal(mgr.snapshot()["nogo-app"].gates.find((g) => !g.decision).id, "p0-go");
    mgr.decide("nogo-app", "p0-go", "kill");
    assert.equal(mgr.snapshot()["nogo-app"].status, "killed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * CARACTERIZAÇÃO 2 — falha do executor esgota as 3 tentativas do player e faz rollback.
 *
 * FORGE_FAKE_FAIL no prompt (via ideia) → fake-exec sai 1 → verify falha → 3 tentativas →
 * player excluído → sem fallback no team → BLOCKED com gate retry|kill. Prova o contrato
 * "verify objetivo + retry ≤3 + rollback" e o estado terminal que o dono encontra.
 */
test("caracterização: 3 falhas do único player → rollback + BLOCKED com gate retry|kill", async () => {
  const root = tmpRoot();
  const logs = [];
  const mgr = makeManager(root, logs);
  mgr.start({ idea: "app que falha FORGE_FAKE_FAIL sempre", team: "dry-run", capability: "static", appId: "fail-app" });

  await waitFor(() => mgr.snapshot()["fail-app"].status === "blocked", 40000, "pipeline blocked");

  const snap = mgr.snapshot()["fail-app"];
  const tentativas = snap.history.filter((h) => h.job === "L0/P0");
  assert.equal(tentativas.length, 3, "exatamente 3 tentativas (maxAttemptsPerPlayer)");
  assert.ok(tentativas.every((h) => h.pass === false), "todas falharam no verify");

  const gate = snap.gates.find((g) => !g.decision);
  assert.equal(gate.id, "blocked-L0-P0");
  assert.deepEqual(gate.choices, ["retry", "kill"]);
  assert.ok(logs.some((l) => l.includes("rollback")), "rollback foi executado ao esgotar o player");

  // T-07: o motivo continua gravado no disco e o snapshot devolve apenas seu sufixo seguro.
  const disco = JSON.parse(fs.readFileSync(path.join(root, "maestro", "pipelines", "fail-app.json"), "utf8"));
  assert.ok(disco.history.some((h) => h.errorTail), "errorTail existe no estado durável");
  for (let i = 0; i < snap.history.length; i++) {
    const persistedTail = disco.history[i].errorTail;
    const snapshotTail = snap.history[i].errorTail;
    if (!persistedTail) assert.equal(snapshotTail, undefined, "entrada sem tail permanece igual");
    else {
      assert.ok(snapshotTail.length <= 500, "snapshot limita errorTail a 500 caracteres");
      assert.ok(persistedTail.endsWith(snapshotTail), "snapshot preserva o sufixo persistido");
    }
  }

  disco.history.at(-1).errorTail = "x".repeat(600);
  fs.writeFileSync(path.join(root, "maestro", "pipelines", "fail-app.json"), JSON.stringify(disco), "utf8");
  assert.equal(makeManager(root).snapshot()["fail-app"].history.at(-1).errorTail, "x".repeat(500), "truncamento é exatamente o sufixo de 500 caracteres");
});

/**
 * CARACTERIZAÇÃO 3 — o harness de teste NÃO ALCANÇA o caminho destrutivo do rate-limit.
 *
 * `detectRateLimit` é aplicada ao TAIL (a saída do processo do executor, engine.mjs:777 —
 * últimos 8 KB de stdout+stderr), não ao prompt. O `fake-exec` imprime só "▶ fake-exec: job=…",
 * nunca ecoa o trabalho — então, no dry-run, o texto do agente jamais chega ao tail e o L2 nunca
 * dispara, por mais que a ideia fale de "rate limit 429".
 *
 * É por isso que o falso positivo do F-03 sobreviveu: nenhum teste conseguia vê-lo. Este teste
 * congela essa cegueira. A T-03 do contrato acrescenta um FORGE_FAKE_ECHO ao fake-exec justamente
 * para tornar o cenário testável — quando isso existir, este teste passa a ser o "antes".
 */
test("caracterização: no dry-run o texto do agente nunca chega ao tail, então o L2 não dispara", async () => {
  const root = tmpRoot({ fallback: true });
  const logs = [];
  const mgr = makeManager(root, logs);
  mgr.start({ idea: "app cujo texto menciona rate limit 429 no enunciado", team: "dry-run", capability: "static", appId: "rl-app" });

  await waitFor(() => mgr.snapshot()["rl-app"].status === "paused_gate" || mgr.snapshot()["rl-app"].status === "blocked", 40000, "run avançou");

  const snap = mgr.snapshot()["rl-app"];
  assert.equal(snap.status, "paused_gate", "o run chega ao gate: nada de rate-limit aconteceu");
  assert.deepEqual(Object.keys(snap.cooldowns || {}), [], "nenhum cooldown — o fake não ecoa o goal");
  assert.ok(!logs.some((l) => l.includes("rate-limit")), "o engine nunca classificou como rate-limit");

  mgr.decide("rl-app", "p0-go", "kill");
});

/**
 * CARACTERIZAÇÃO 4 — o estado por app é persistido a cada save() e sobrevive a "restart".
 *
 * save() escreve o JSON inteiro com writeFileSync (não-atômico: sem tmp+rename). O teste
 * congela o contrato observável — o arquivo existe, é JSON válido e um manager novo o recarrega
 * — que é o que a Onda 1 do plano precisa preservar ao tornar a escrita atômica.
 */
test("caracterização: maestro/pipelines/<app>.json é a fonte durável e um manager novo o recarrega", async () => {
  const root = tmpRoot();
  const mgr = makeManager(root);
  mgr.start({ idea: "app durável para caracterizar persistência", team: "dry-run", capability: "static", appId: "persist-char" });
  await waitFor(() => mgr.snapshot()["persist-char"].status === "paused_gate", 30000, "gate");

  const file = path.join(root, "maestro", "pipelines", "persist-char.json");
  const raw = fs.readFileSync(file, "utf8");
  const state = JSON.parse(raw);

  assert.equal(state.appId, "persist-char");
  assert.equal(state.status, "paused_gate");
  assert.ok(state.git.checkpoints.length >= 1, "checkpoint do P0 registrado");
  assert.ok(state.history.length >= 1, "history registrado");

  // manager novo (restart do server) reconstrói do disco, com o gate ainda pendente
  const mgr2 = makeManager(root);
  const snap2 = mgr2.snapshot()["persist-char"];
  assert.equal(snap2.status, "paused_gate");
  assert.equal(snap2.gates.find((g) => !g.decision).id, "p0-go");

  // e o repo do app tem o checkpoint commitado (git por app)
  const log = gitApp(root, "persist-char", ["log", "--oneline"]);
  assert.ok(log.includes("L0/P0 PASS"), "checkpoint commitado no repo do app");

  mgr2.decide("persist-char", "p0-go", "kill");
  assert.equal(mgr2.snapshot()["persist-char"].status, "killed");
});
