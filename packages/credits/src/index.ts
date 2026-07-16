/**
 * Guest free-quota (cookie/localStorage friendly).
 * Server can re-check the same shape from a cookie JSON payload.
 *
 * Guest cookies are untrusted: use parseGuestCreditState (ignores coins/weekly)
 * or sealCredits/openCredits when CREDITS_COOKIE_SECRET is set.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

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

function clampInt(n: unknown, min: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : min;
  return Math.min(max, Math.max(min, v));
}

/**
 * Parse guest cookie JSON without trusting paid fields.
 * coins/weeklyUntil always zeroed until real billing + signed state.
 */
export function parseGuestCreditState(
  raw: string | undefined,
  freePerDay: number
): CreditState {
  const base = createInitialState(freePerDay);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<CreditState>;
    const day =
      typeof parsed.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.day)
        ? parsed.day
        : base.day;
    return normalizeDay({
      day,
      used: clampInt(parsed.used, 0, freePerDay),
      freePerDay,
      coins: 0,
      weeklyUntil: null,
    });
  } catch {
    return base;
  }
}

/** HMAC-SHA256 sealed cookie: base64url(json).base64url(sig) */
export function sealCredits(state: CreditState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function openCredits(
  token: string | undefined,
  secret: string,
  freePerDay: number
): CreditState {
  const fallback = createInitialState(freePerDay);
  if (!token || !secret) return fallback;
  const parts = token.split(".");
  if (parts.length !== 2) return fallback;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fallback;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CreditState;
    return normalizeDay({
      ...createInitialState(freePerDay),
      ...parsed,
      freePerDay,
      coins: clampInt(parsed.coins, 0, 1_000_000),
      weeklyUntil: parsed.weeklyUntil ?? null,
    });
  } catch {
    return fallback;
  }
}

/** Serialize for Set-Cookie: sealed if secret present, else plain guest JSON. */
export function serializeGuestCredits(state: CreditState, secret?: string | null): string {
  if (secret) return sealCredits(state, secret);
  // never persist forged paid fields
  return JSON.stringify({
    day: state.day,
    used: state.used,
    freePerDay: state.freePerDay,
    coins: 0,
    weeklyUntil: null,
  });
}

export function parseGuestCreditsCookie(
  raw: string | undefined,
  freePerDay: number,
  secret?: string | null
): CreditState {
  if (secret && raw && raw.includes(".")) {
    return openCredits(raw, secret, freePerDay);
  }
  return parseGuestCreditState(raw, freePerDay);
}

/** Cap chat messages for product AI routes (cost DoS guard). */
export function sanitizeChatMessages<T extends { role: string; content: string }>(
  raw: unknown,
  { maxMsg = 16, maxContent = 2000 }: { maxMsg?: number; maxContent?: number } = {}
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-maxMsg)
    .map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, maxContent),
    }))
    .filter((m) => String(m.content).trim().length > 0) as T[];
}
