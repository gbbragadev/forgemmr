import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { aggregateRuns, formatStats } from "../stats.mjs";

const runs = [
  {
    appId: "app-a",
    status: "done",
    startedAt: "2026-07-13T10:00:00.000Z",
    endedAt: "2026-07-13T10:30:00.000Z",
    history: [
      { job: "L1/B3", playerId: "glm", pass: true, startedAt: "2026-07-13T10:00:00.000Z", endedAt: "2026-07-13T10:10:00.000Z" },
      { job: "L1/B3", playerId: "grok", pass: false, startedAt: "2026-07-13T10:10:00.000Z", endedAt: "2026-07-13T10:20:00.000Z" },
    ],
    gates: [],
  },
  {
    appId: "app-b",
    status: "killed",
    startedAt: "2026-07-13T11:00:00.000Z",
    endedAt: "2026-07-13T11:20:00.000Z",
    history: [
      { job: "L0/P0", playerId: "grok", pass: true, startedAt: "2026-07-13T11:00:00.000Z", endedAt: "2026-07-13T11:05:00.000Z" },
    ],
    gates: [{ id: "p0-go", decision: "kill", feedback: "comprador não confirmado" }],
  },
];

test("stats agrega PASS por player/job, duração por job/app e causa de morte", () => {
  const stats = aggregateRuns(runs);

  assert.deepEqual(stats.passRates, [
    { player: "glm", job: "L1/B3", passes: 1, attempts: 1, rate: 100 },
    { player: "grok", job: "L0/P0", passes: 1, attempts: 1, rate: 100 },
    { player: "grok", job: "L1/B3", passes: 0, attempts: 1, rate: 0 },
  ]);
  assert.deepEqual(stats.jobDurations.find((row) => row.job === "L1/B3"), {
    job: "L1/B3",
    runs: 2,
    averageSeconds: 600,
  });
  assert.deepEqual(stats.appDurations, [
    { app: "app-a", runs: 1, averageSeconds: 1800 },
    { app: "app-b", runs: 1, averageSeconds: 1200 },
  ]);
  assert.deepEqual(stats.deaths, [
    { app: "app-b", gate: "p0-go", cause: "comprador não confirmado" },
  ]);
});

test("formatStats imprime as três seções mesmo sem dados", () => {
  const output = formatStats(aggregateRuns([]));
  assert.match(output, /PASS por player e job/);
  assert.match(output, /Duração média por job e app/);
  assert.match(output, /Mortes por app/);
  assert.match(output, /sem dados/);
});

test("stats.mjs permanece texto sem byte NUL cru", () => {
  const source = fs.readFileSync(new URL("../stats.mjs", import.meta.url));
  assert.equal(source.includes(0), false);
});
