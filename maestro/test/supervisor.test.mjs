import test from "node:test";
import assert from "node:assert/strict";

import { ensureControlCenter } from "../supervisor.mjs";

test("supervisor reutiliza Maestro saudável e abre o browser uma única vez", async () => {
  let starts = 0;
  let opens = 0;
  let probes = 0;

  const result = await ensureControlCenter({
    url: "http://127.0.0.1:8799",
    probeHealth: async () => { probes += 1; return true; },
    startServer: () => { starts += 1; },
    openBrowser: () => { opens += 1; },
    wait: async () => {},
  });

  assert.deepEqual(result, { url: "http://127.0.0.1:8799", reused: true, started: false });
  assert.equal(probes, 1);
  assert.equal(starts, 0);
  assert.equal(opens, 1);
});

test("supervisor inicia uma instância, espera health e só então abre o browser", async () => {
  const health = [false, false, true];
  let starts = 0;
  let opens = 0;
  let waits = 0;

  const result = await ensureControlCenter({
    url: "http://127.0.0.1:8799",
    probeHealth: async () => health.shift() ?? true,
    startServer: () => { starts += 1; },
    openBrowser: () => { opens += 1; },
    wait: async () => { waits += 1; },
    maxAttempts: 5,
  });

  assert.deepEqual(result, { url: "http://127.0.0.1:8799", reused: false, started: true });
  assert.equal(starts, 1);
  assert.equal(waits, 2);
  assert.equal(opens, 1);
});

test("supervisor falha fechado quando a porta não vira um Control Center saudável", async () => {
  let starts = 0;
  let opens = 0;

  await assert.rejects(
    ensureControlCenter({
      url: "http://127.0.0.1:8799",
      probeHealth: async () => false,
      startServer: () => { starts += 1; },
      openBrowser: () => { opens += 1; },
      wait: async () => {},
      maxAttempts: 2,
    }),
    /não respondeu como Maestro Control Center/i,
  );
  assert.equal(starts, 1);
  assert.equal(opens, 0);
});
