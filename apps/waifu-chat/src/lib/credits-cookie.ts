import {
  checkCredits,
  consumeCredit,
  createInitialState,
  normalizeDay,
  type CreditState,
} from "@anime-forge/credits";
import { appConfig } from "../../app.config";

export const CREDITS_COOKIE = "af_credits";

export function parseCreditsCookie(raw: string | undefined): CreditState {
  if (!raw) {
    return createInitialState(appConfig.monetization.freePerDay);
  }
  try {
    const parsed = JSON.parse(raw) as CreditState;
    return normalizeDay({
      ...createInitialState(appConfig.monetization.freePerDay),
      ...parsed,
      freePerDay: appConfig.monetization.freePerDay,
    });
  } catch {
    return createInitialState(appConfig.monetization.freePerDay);
  }
}

export function serializeCredits(state: CreditState): string {
  return JSON.stringify(state);
}

export { checkCredits, consumeCredit };
