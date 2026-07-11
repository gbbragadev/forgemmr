/**
 * Guest free-quota (cookie/localStorage friendly).
 * Server can re-check the same shape from a cookie JSON payload.
 */

export type CreditState = {
  /** YYYY-MM-DD in local or UTC day key */
  day: string;
  used: number;
  freePerDay: number;
  /** paid coins balance (future billing) */
  coins: number;
  /** ISO weekly sub expiry if any */
  weeklyUntil?: string | null;
};

export type CreditCheck =
  | { ok: true; remaining: number; source: "free" | "coins" | "weekly" }
  | { ok: false; reason: "no_credits"; remaining: 0 };

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createInitialState(freePerDay: number): CreditState {
  return {
    day: todayKey(),
    used: 0,
    freePerDay,
    coins: 0,
    weeklyUntil: null,
  };
}

/** Roll day counter if the stored day is stale */
export function normalizeDay(state: CreditState, now = new Date()): CreditState {
  const day = todayKey(now);
  if (state.day === day) return state;
  return { ...state, day, used: 0 };
}

export function hasActiveWeekly(state: CreditState, now = new Date()): boolean {
  if (!state.weeklyUntil) return false;
  return new Date(state.weeklyUntil).getTime() > now.getTime();
}

export function checkCredits(state: CreditState, now = new Date()): CreditCheck {
  const s = normalizeDay(state, now);

  if (hasActiveWeekly(s, now)) {
    return { ok: true, remaining: 999, source: "weekly" };
  }

  const freeLeft = Math.max(0, s.freePerDay - s.used);
  if (freeLeft > 0) {
    return { ok: true, remaining: freeLeft, source: "free" };
  }

  if (s.coins > 0) {
    return { ok: true, remaining: s.coins, source: "coins" };
  }

  return { ok: false, reason: "no_credits", remaining: 0 };
}

export function consumeCredit(state: CreditState, now = new Date()): {
  state: CreditState;
  check: CreditCheck;
} {
  const s = normalizeDay(state, now);
  const check = checkCredits(s, now);

  if (!check.ok) {
    return { state: s, check };
  }

  if (check.source === "weekly") {
    return { state: s, check };
  }

  if (check.source === "free") {
    return {
      state: { ...s, used: s.used + 1 },
      check: {
        ok: true,
        remaining: Math.max(0, s.freePerDay - (s.used + 1)),
        source: "free",
      },
    };
  }

  // coins
  return {
    state: { ...s, coins: s.coins - 1 },
    check: { ok: true, remaining: s.coins - 1, source: "coins" },
  };
}

export function freeRemaining(state: CreditState, now = new Date()): number {
  const s = normalizeDay(state, now);
  if (hasActiveWeekly(s, now)) return 999;
  return Math.max(0, s.freePerDay - s.used);
}
