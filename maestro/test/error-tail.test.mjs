import { test } from "node:test";
import assert from "node:assert/strict";
import { latestFailureTail, tuiLogRows } from "../forge.mjs";

test("latestFailureTail escolhe a falha mais recente com tail e preserva três linhas finais", () => {
  const result = latestFailureTail([
    { job: "L0/P0", pass: false, errorTail: "antiga" },
    { job: "L1/B1", pass: true, errorTail: "não mostrar" },
    { job: "L1/B2", pass: false },
    { job: "L1/B3", pass: false, errorTail: "primeira\n\nsegunda\nterceira\nquarta\n" },
  ]);

  assert.deepEqual(result, { job: "L1/B3", lines: ["segunda", "terceira", "quarta"] });
});

test("latestFailureTail ignora passes e falhas sem tail", () => {
  assert.equal(latestFailureTail([{ job: "L0/P0", pass: true, errorTail: "não" }, { job: "L1/B1", pass: false }]), null);
});

test("tuiLogRows reserva label e linhas finais dentro de capacidade pequena", () => {
  assert.deepEqual(tuiLogRows(["log antigo", "log recente"], [{ job: "L1/B3", pass: false, errorTail: "uma\nduas\ntrês" }], 3), ["✗ B3", "  duas", "  três"]);
});

test("tuiLogRows preserva log disponível, label e três linhas finais", () => {
  assert.deepEqual(tuiLogRows(["log antigo", "log recente"], [{ job: "L1/B3", pass: false, errorTail: "uma\nduas\ntrês" }], 5), ["log recente", "✗ B3", "  uma", "  duas", "  três"]);
});

test("tuiLogRows limita logs sem falha e aceita capacidade zero", () => {
  assert.deepEqual(tuiLogRows(["um", "dois"], [], 0), []);
  assert.deepEqual(tuiLogRows(["um", "dois", "três"], [], 2), ["dois", "três"]);
});
