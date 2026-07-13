import { test } from "node:test";
import assert from "node:assert/strict";
import { validateP4Result } from "../p4-result.mjs";

const result = (appId, overrides = {}) => ({
  appId,
  measuredAt: "2026-07-20",
  daysLive: 7,
  visits: 120,
  activations: 48,
  ctaClicks: 15,
  conversions: 2,
  revenueBrl: 9.8,
  apiCostBrl: 1.2,
  verdict: "iterate",
  why: "há clique no CTA, mas a conversão ainda precisa de mais tráfego",
  channel: "Instagram orgânico",
  ...overrides,
});

test("dois resultados P4 de apps diferentes seguem o mesmo schema comparável", () => {
  const doki = result("doki-call");
  const deck = result("anima-deck", {
    visits: 300,
    activations: 140,
    ctaClicks: 42,
    conversions: 0,
    revenueBrl: 0,
    apiCostBrl: 0,
    verdict: "iterate",
    channel: "TikTok orgânico",
  });

  assert.deepEqual(validateP4Result(doki), { valid: true, errors: [] });
  assert.deepEqual(validateP4Result(deck), { valid: true, errors: [] });
  assert.deepEqual(Object.keys(doki), Object.keys(deck));
});

test("resultado P4 incompleto ou com verdict inválido reprova", () => {
  const invalid = result("doki-call", { verdict: "maybe" });
  delete invalid.channel;

  const validation = validateP4Result(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("channel ausente"));
  assert.ok(validation.errors.includes("verdict inválido"));
});
