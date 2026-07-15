import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createRunEventStore } from "../control/run-events.mjs";

test("run events persist sequence and can replay one pipeline after a cursor", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-run-events-"));
  try {
    const store = createRunEventStore({ root, redact: (value) => String(value).replaceAll("secret", "[redacted]") });
    const first = store.append({ appId: "app-a", runId: "run-a", job: "L0/P0", attempt: 1, playerId: "grok", line: "starting secret" });
    const second = store.append({ appId: "app-b", runId: "run-b", job: "L1/B1", attempt: 2, playerId: "codex", line: "building" });
    const third = store.append({ appId: "app-a", runId: "run-a", job: "L0/P0", attempt: 1, playerId: "grok", line: "done" });

    assert.deepEqual([first.sequence, second.sequence, third.sequence], [1, 2, 3]);
    assert.equal(first.line.includes("secret"), false);
    assert.deepEqual(store.list({ appId: "app-a", after: 1 }).map((event) => event.sequence), [3]);
    assert.deepEqual(store.list({ runId: "run-b" }).map((event) => event.sequence), [2]);

    const restored = createRunEventStore({ root });
    assert.equal(restored.append({ appId: "app-a", runId: "run-a", line: "again" }).sequence, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run events reject ambiguous ids and cap retained history", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-run-events-cap-"));
  try {
    const store = createRunEventStore({ root, maxEvents: 3 });
    assert.throws(() => store.append({ appId: "../escape", runId: "run", line: "x" }), /appId/);
    for (let index = 0; index < 5; index++) store.append({ appId: "app", runId: "run", line: `line ${index}` });
    assert.deepEqual(store.list({}).map((event) => event.sequence), [3, 4, 5]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
