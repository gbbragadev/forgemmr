import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayKey,
  createInitialState,
  normalizeDay,
  hasActiveWeekly,
  checkCredits,
  consumeCredit,
  freeRemaining,
} from "../src/index.ts";

// Helper: create a date at UTC midnight for a given YYYY-MM-DD
const dateAtUTC = (day) => new Date(`${day}T00:00:00Z`);

// Helper: create a date at UTC noon for a given YYYY-MM-DD
const dateAtUTCNoon = (day) => new Date(`${day}T12:00:00Z`);

// ============================================================================
// 1. todayKey — retorna YYYY-MM-DD do dia UTC da data injetada
// ============================================================================
test("todayKey retorna formato YYYY-MM-DD a partir de uma data injetada", () => {
  const date = dateAtUTC("2026-07-16");
  const key = todayKey(date);
  assert.equal(key, "2026-07-16");
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});

test("todayKey com datas diferentes em UTC", () => {
  assert.equal(todayKey(dateAtUTC("2026-01-01")), "2026-01-01");
  assert.equal(todayKey(dateAtUTC("2026-12-31")), "2026-12-31");
  assert.equal(todayKey(dateAtUTC("2025-02-28")), "2025-02-28");
});

// ============================================================================
// 2. createInitialState — used=0, coins=0, weeklyUntil=null, day=hoje
// ============================================================================
test("createInitialState inicializa com valores corretos", () => {
  const state = createInitialState(10);
  assert.equal(state.used, 0);
  assert.equal(state.coins, 0);
  assert.equal(state.weeklyUntil, null);
  assert.equal(state.freePerDay, 10);
  assert.match(state.day, /^\d{4}-\d{2}-\d{2}$/);
});

test("createInitialState respeita o parâmetro freePerDay", () => {
  assert.equal(createInitialState(5).freePerDay, 5);
  assert.equal(createInitialState(20).freePerDay, 20);
  assert.equal(createInitialState(100).freePerDay, 100);
});

// ============================================================================
// 3. normalizeDay — mesmo dia: retorna MESMO objeto (identidade);
//    dia diferente: zera used, atualiza day, preserva coins/weeklyUntil
// ============================================================================
test("normalizeDay no mesmo dia retorna identidade do objeto", () => {
  const date = dateAtUTC("2026-07-16");
  const state = createInitialState(10);
  // Ajusta para o dia correto
  const stateToday = { ...state, day: "2026-07-16" };

  const normalized = normalizeDay(stateToday, date);
  assert.strictEqual(normalized, stateToday, "deve retornar o mesmo objeto");
});

test("normalizeDay em dia diferente zera used e atualiza day", () => {
  const state = {
    day: "2026-07-15",
    used: 8,
    freePerDay: 10,
    coins: 5,
    weeklyUntil: "2026-07-22T00:00:00Z",
  };

  const normalized = normalizeDay(state, dateAtUTC("2026-07-16"));

  assert.equal(normalized.day, "2026-07-16");
  assert.equal(normalized.used, 0, "used deve ser zerado");
  assert.equal(normalized.coins, 5, "coins deve ser preservado");
  assert.equal(
    normalized.weeklyUntil,
    "2026-07-22T00:00:00Z",
    "weeklyUntil deve ser preservado"
  );
  assert.notStrictEqual(normalized, state, "deve ser um novo objeto");
});

test("normalizeDay preserva coins quando muda de dia", () => {
  const state = { day: "2026-07-10", used: 10, freePerDay: 10, coins: 42, weeklyUntil: null };
  const normalized = normalizeDay(state, dateAtUTC("2026-07-16"));

  assert.equal(normalized.coins, 42);
});

// ============================================================================
// 4. hasActiveWeekly — null → false; futuro → true; passado → false;
//    expiração EXATAMENTE igual a now → false (comparação estrita >)
// ============================================================================
test("hasActiveWeekly retorna false quando weeklyUntil é null", () => {
  const state = { day: "2026-07-16", used: 0, freePerDay: 10, coins: 0, weeklyUntil: null };
  const now = dateAtUTC("2026-07-16");

  assert.equal(hasActiveWeekly(state, now), false);
});

test("hasActiveWeekly retorna true quando expiração está no futuro", () => {
  const state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: "2026-07-23T00:00:00Z",
  };
  const now = dateAtUTC("2026-07-16");

  assert.equal(hasActiveWeekly(state, now), true);
});

test("hasActiveWeekly retorna false quando expiração está no passado", () => {
  const state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: "2026-07-15T00:00:00Z",
  };
  const now = dateAtUTC("2026-07-16");

  assert.equal(hasActiveWeekly(state, now), false);
});

test("hasActiveWeekly retorna false quando expiração é EXATAMENTE igual a now (comparação estrita >)", () => {
  const expiryTime = "2026-07-16T12:00:00Z";
  const state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: expiryTime,
  };
  const now = dateAtUTCNoon("2026-07-16"); // Mesma hora

  assert.equal(hasActiveWeekly(state, now), false, "expiração exatamente agora deve ser inativa");
});

test("hasActiveWeekly retorna true 1ms antes da expiração", () => {
  const expiryTime = new Date("2026-07-16T12:00:00Z");
  const state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: expiryTime.toISOString(),
  };
  const nowOneMilliBefore = new Date(expiryTime.getTime() - 1);

  assert.equal(hasActiveWeekly(state, nowOneMilliBefore), true);
});

// ============================================================================
// 5. checkCredits hierarquia — semanal > free > coins > nada
// ============================================================================
test("checkCredits com semanal ativa retorna weekly mesmo com free esgotado", () => {
  const state = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: "2026-07-23T00:00:00Z",
  };
  const now = dateAtUTC("2026-07-16");

  const check = checkCredits(state, now);

  assert.equal(check.ok, true);
  assert.equal(check.source, "weekly");
  assert.equal(check.remaining, 999);
});

test("checkCredits sem semanal e free disponível retorna free", () => {
  const state = {
    day: "2026-07-16",
    used: 3,
    freePerDay: 10,
    coins: 5,
    weeklyUntil: null,
  };
  const now = dateAtUTC("2026-07-16");

  const check = checkCredits(state, now);

  assert.equal(check.ok, true);
  assert.equal(check.source, "free");
  assert.equal(check.remaining, 7); // 10 - 3
});

test("checkCredits com free esgotado e coins > 0 retorna coins", () => {
  const state = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 42,
    weeklyUntil: null,
  };
  const now = dateAtUTC("2026-07-16");

  const check = checkCredits(state, now);

  assert.equal(check.ok, true);
  assert.equal(check.source, "coins");
  assert.equal(check.remaining, 42);
});

test("checkCredits sem nenhum crédito retorna erro", () => {
  const state = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };
  const now = dateAtUTC("2026-07-16");

  const check = checkCredits(state, now);

  assert.equal(check.ok, false);
  assert.equal(check.reason, "no_credits");
  assert.equal(check.remaining, 0);
});

// ============================================================================
// 6. checkCredits com rollover — estado de ontem volta a ter free hoje
// ============================================================================
test("checkCredits em dia novo restaura free mesmo com used=freePerDay ontem", () => {
  const stateYesterday = {
    day: "2026-07-15",
    used: 10,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };
  const today = dateAtUTC("2026-07-16");

  const check = checkCredits(stateYesterday, today);

  assert.equal(check.ok, true);
  assert.equal(check.source, "free");
  assert.equal(check.remaining, 10, "should reset free quota for new day");
});

// ============================================================================
// 7. consumeCredit — free incrementa used; coins decrementa;
//    semanal não muta; sem créditos mantém inalterado;
//    imutabilidade: entrada nunca é mutada
// ============================================================================
test("consumeCredit com free disponível incrementa used e retorna novo estado", () => {
  const original = {
    day: "2026-07-16",
    used: 2,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const { state: newState, check } = consumeCredit(original, dateAtUTC("2026-07-16"));

  assert.equal(check.ok, true);
  assert.equal(check.source, "free");
  assert.equal(check.remaining, 7); // 10 - (2+1)
  assert.equal(newState.used, 3); // 2 + 1
  assert.notStrictEqual(newState, original, "must not mutate original");
});

test("consumeCredit com coins decrementa coins", () => {
  const original = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 15,
    weeklyUntil: null,
  };

  const { state: newState, check } = consumeCredit(original, dateAtUTC("2026-07-16"));

  assert.equal(check.ok, true);
  assert.equal(check.source, "coins");
  assert.equal(check.remaining, 14); // 15 - 1
  assert.equal(newState.coins, 14);
});

test("consumeCredit com semanal ativa não muta estado de créditos", () => {
  const original = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 5,
    weeklyUntil: "2026-07-23T00:00:00Z",
  };

  const { state: newState, check } = consumeCredit(original, dateAtUTC("2026-07-16"));

  assert.equal(check.ok, true);
  assert.equal(check.source, "weekly");
  assert.equal(check.remaining, 999);
  assert.equal(newState.used, 10, "used deve ser preservado");
  assert.equal(newState.coins, 5, "coins deve ser preservado");
});

test("consumeCredit sem créditos retorna estado inalterado", () => {
  const original = {
    day: "2026-07-16",
    used: 10,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const { state: newState, check } = consumeCredit(original, dateAtUTC("2026-07-16"));

  assert.equal(check.ok, false);
  assert.equal(check.reason, "no_credits");
  // A função normaliza o dia mas retorna o resultado normalizado
  assert.deepEqual(newState.used, original.used);
  assert.deepEqual(newState.coins, original.coins);
});

test("consumeCredit nunca muta o estado de entrada original", () => {
  const original = {
    day: "2026-07-16",
    used: 5,
    freePerDay: 10,
    coins: 20,
    weeklyUntil: "2026-07-23T00:00:00Z",
  };
  const copy = JSON.parse(JSON.stringify(original));

  consumeCredit(original, dateAtUTC("2026-07-16"));

  assert.deepEqual(original, copy, "entrada original não deve ser modificada");
});

test("consumeCredit free múltiplas vezes mantém integridade", () => {
  let state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 5,
    coins: 0,
    weeklyUntil: null,
  };

  for (let i = 0; i < 5; i++) {
    const { state: newState, check } = consumeCredit(state, dateAtUTC("2026-07-16"));
    assert.equal(check.ok, true);
    state = newState;
  }

  // Sexta tentativa deve falhar
  const { check: lastCheck } = consumeCredit(state, dateAtUTC("2026-07-16"));
  assert.equal(lastCheck.ok, false);
  assert.equal(lastCheck.reason, "no_credits");
});

// ============================================================================
// 8. freeRemaining — com semanal → 999; sem → freePerDay - used, nunca negativo
// ============================================================================
test("freeRemaining com semanal ativa retorna 999", () => {
  const state = {
    day: "2026-07-16",
    used: 5,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: "2026-07-23T00:00:00Z",
  };

  const remaining = freeRemaining(state, dateAtUTC("2026-07-16"));

  assert.equal(remaining, 999);
});

test("freeRemaining sem semanal retorna freePerDay - used", () => {
  const state = {
    day: "2026-07-16",
    used: 3,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const remaining = freeRemaining(state, dateAtUTC("2026-07-16"));

  assert.equal(remaining, 7); // 10 - 3
});

test("freeRemaining nunca retorna negativo", () => {
  const state = {
    day: "2026-07-16",
    used: 15,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const remaining = freeRemaining(state, dateAtUTC("2026-07-16"));

  assert.equal(remaining, 0);
});

test("freeRemaining com used=0 retorna freePerDay", () => {
  const state = {
    day: "2026-07-16",
    used: 0,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const remaining = freeRemaining(state, dateAtUTC("2026-07-16"));

  assert.equal(remaining, 10);
});

test("freeRemaining em dia novo restaura quota", () => {
  const stateYesterday = {
    day: "2026-07-15",
    used: 10,
    freePerDay: 10,
    coins: 0,
    weeklyUntil: null,
  };

  const remaining = freeRemaining(stateYesterday, dateAtUTC("2026-07-16"));

  assert.equal(remaining, 10, "quota deve ser restaurada no novo dia");
});
