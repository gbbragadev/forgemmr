import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionCounts,
  listAttention,
} from "../operator/attention.mjs";
import {
  isActivePipeline,
  pipelineListSubtitle,
  pipelineRunModel,
  sortPipelinesForList,
} from "../operator/pipeline-view.mjs";

test("listAttention: empty snapshot → empty", () => {
  assert.deepEqual(listAttention(null), []);
  assert.deepEqual(listAttention({}), []);
});

test("listAttention: gates first, then blocked, then running", () => {
  const items = listAttention({
    decisions: [
      {
        appId: "demo-app",
        gateId: "ds-pick",
        prompt: "Escolha o design",
      },
    ],
    actions: [
      {
        id: "gate.decide",
        scope: "pipeline:demo-app",
        enabled: true,
        label: "Decidir gate",
      },
      {
        id: "p5.decide",
        scope: "pipeline:old",
        enabled: true,
        label: "P5",
        description: "kill/iterate/scale",
      },
    ],
    pipelines: [
      {
        appId: "demo-app",
        status: "paused_gate",
        currentJob: "DS-GEN",
      },
      {
        appId: "stuck-app",
        status: "blocked",
        blockReason: "rate limit cooldown 12m",
      },
      {
        appId: "live-app",
        status: "running",
        currentJob: "L1/B3",
        currentPlayer: "grok",
      },
    ],
  });

  assert.ok(items.length >= 3);
  assert.equal(items[0].kind, "gate");
  assert.equal(items[0].appId, "demo-app");
  assert.ok(items.some((i) => i.kind === "rate_limit" && i.appId === "stuck-app"));
  assert.ok(items.some((i) => i.kind === "running" && i.appId === "live-app"));
  assert.ok(items.some((i) => i.kind === "p4"));

  const counts = attentionCounts(items);
  assert.ok(counts.total >= 3);
  assert.ok(counts.gates >= 1);
});

test("pipeline-view sort and subtitle", () => {
  assert.equal(isActivePipeline({ status: "running" }), true);
  assert.equal(isActivePipeline({ status: "done" }), false);
  assert.equal(
    pipelineListSubtitle({ currentJob: "L1/B1", idea: "long idea text" }),
    "L1/B1"
  );
  const sorted = sortPipelinesForList([
    { appId: "z", status: "done" },
    { appId: "a", status: "running" },
    { appId: "m", status: "idle" },
  ]);
  assert.equal(sorted[0].appId, "a");
  assert.equal(sorted.at(-1).appId, "z");

  const model = pipelineRunModel(
    {
      pipelines: [{ appId: "x", status: "running" }],
      actions: [{ id: "x", scope: "pipeline:x" }],
      decisions: [{ appId: "x", gateId: "g" }],
    },
    "x"
  );
  assert.equal(model.pipeline.appId, "x");
  assert.equal(model.actions.length, 1);
  assert.equal(model.decisions.length, 1);
});
