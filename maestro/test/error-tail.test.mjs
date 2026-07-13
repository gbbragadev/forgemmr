import { test } from "node:test";
import assert from "node:assert/strict";
import { latestFailureTail } from "../forge.mjs";

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
