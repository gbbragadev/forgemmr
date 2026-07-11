import { cookies } from "next/headers";
import { freeRemaining } from "@forge/credits";
import { appConfig } from "../../../../app.config";
import {
  CREDITS_COOKIE,
  parseCreditsCookie,
  serializeCredits,
} from "../../../lib/credits-cookie";

export async function GET() {
  const cookieStore = await cookies();
  const state = parseCreditsCookie(cookieStore.get(CREDITS_COOKIE)?.value);

  // ensure cookie exists for new guests
  if (!cookieStore.get(CREDITS_COOKIE)) {
    cookieStore.set(CREDITS_COOKIE, serializeCredits(state), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return Response.json({
    remaining: freeRemaining(state),
    freePerDay: appConfig.monetization.freePerDay,
    used: state.used,
    day: state.day,
  });
}
