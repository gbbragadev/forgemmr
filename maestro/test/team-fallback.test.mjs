import { test } from "node:test";
import assert from "node:assert/strict";
import { composeTeam } from "../engine.mjs";

const musicians = [
  { provider: "alpha", cli: "alpha", model: "a", modelLabel: "Alpha", effort: "low", roles: ["Estrategista"] },
  { provider: "beta", cli: "beta", model: "b", modelLabel: "Beta", effort: "low", roles: ["Engenheiro"] },
  { provider: "gamma", cli: "gamma", model: "c", modelLabel: "Gamma", effort: "low", roles: ["Designer"] },
];

test("composeTeam adiciona todos os colegas como fallbacks", () => {
  const { team, players } = composeTeam("Fallback", musicians);

  for (const player of players) {
    assert.ok(team.fallbacks[player.id].length > 0);
    assert.ok(!team.fallbacks[player.id].includes(player.id));
    assert.equal(new Set(team.fallbacks[player.id]).size, team.fallbacks[player.id].length);
  }
  assert.equal(team.dispatch.default, players[1].id);
});

test("composeTeam mantém fallback vazio para time solo", () => {
  const { team, players } = composeTeam("Solo", [musicians[1]]);

  assert.equal(team.dispatch.default, players[0].id);
  assert.deepEqual(team.fallbacks[players[0].id], []);
});

test("composeTeam preserva fallback de colisão antes da cadeia geral", () => {
  const { team, players } = composeTeam("Colisão", [
    musicians[1],
    { ...musicians[1], provider: "delta", model: "d", modelLabel: "Delta" },
    musicians[2],
  ]);

  assert.deepEqual(team.fallbacks[players[1].id], [players[0].id, players[2].id]);
});
