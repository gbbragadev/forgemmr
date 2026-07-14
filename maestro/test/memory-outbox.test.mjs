import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryOutbox } from "../memory/outbox.mjs";
import { buildMemoryRecord } from "../memory/records.mjs";

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-outbox-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "outbox.jsonl");
}

test("outbox deduplica por sourceHash e sobrevive a restart", async (t) => {
  const file = fixture(t);
  const record = buildMemoryRecord({
    type: "outcome",
    appId: "probe",
    runId: "run-1",
    summary: "PASS",
    observedAt: "2026-07-14T12:00:00.000Z",
  });
  const first = createMemoryOutbox({ file });
  assert.equal(first.enqueue(record), true);
  assert.equal(first.enqueue(record), false);
  assert.equal(first.size(), 1);

  const restarted = createMemoryOutbox({ file });
  const written = [];
  const result = await restarted.drain(async (pending) => written.push(pending));

  assert.equal(result.sent, 1);
  assert.equal(restarted.size(), 0);
  assert.deepEqual(written.map((item) => item.sourceHash), [record.sourceHash]);
  assert.equal(fs.readFileSync(file, "utf8"), "");
});

test("falha é redigida, persistida e respeita backoff 1s, 2s, 5s e 15s", async (t) => {
  const file = fixture(t);
  let now = 1_000_000;
  const outbox = createMemoryOutbox({
    file,
    now: () => now,
    redact: (value) => value.replaceAll("secret-token", "[redacted]"),
  });
  outbox.enqueue(buildMemoryRecord({ type: "outcome", summary: "FAIL" }));

  for (const delay of [1_000, 2_000, 5_000, 15_000]) {
    const result = await outbox.drain(async () => {
      throw new Error("offline secret-token");
    });
    assert.equal(result.failed, 1);
    assert.equal(outbox.list()[0].nextAttemptAt, now + delay);
    assert.equal(JSON.stringify(outbox.list()).includes("secret-token"), false);
    assert.equal((await outbox.drain(async () => assert.fail("backoff não venceu"))).attempted, 0);
    now += delay;
  }
});

test("enqueue redige defensivamente antes de gravar JSONL privado", (t) => {
  const file = fixture(t);
  const outbox = createMemoryOutbox({
    file,
    redact: (value) => value.replaceAll("secret-token", "[redacted]"),
  });
  const record = {
    ...buildMemoryRecord({ type: "handoff", summary: "continuidade" }),
    summary: "continuidade secret-token",
  };
  outbox.enqueue(record);

  assert.equal(fs.readFileSync(file, "utf8").includes("secret-token"), false);
});
