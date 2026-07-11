import {
  getProductAiProvider,
  getProductApiKey,
  productKeyHint,
  streamProductChat,
  type ChatMessage,
} from "@anime-forge/ai";
import { cookies } from "next/headers";
import { appConfig } from "../../../../app.config";
import {
  checkCredits,
  consumeCredit,
  CREDITS_COOKIE,
  parseCreditsCookie,
  serializeCredits,
} from "../../../lib/credits-cookie";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  personaId: string;
  messages: ChatMessage[];
};

export async function POST(req: Request) {
  const provider =
    (appConfig.ai.provider as "zai" | "openrouter") || getProductAiProvider();
  const apiKey = getProductApiKey(process.env, provider);
  if (!apiKey) {
    return Response.json({ error: productKeyHint(provider) }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const persona = appConfig.personas.find((p) => p.id === body.personaId);
  if (!persona) {
    return Response.json({ error: "Persona não encontrada" }, { status: 404 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages obrigatório" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const state = parseCreditsCookie(cookieStore.get(CREDITS_COOKIE)?.value);
  const pre = checkCredits(state);
  if (!pre.ok) {
    return Response.json(
      { error: "no_credits", paywall: true, remaining: 0 },
      { status: 402 }
    );
  }

  const { state: nextState } = consumeCredit(state);
  cookieStore.set(CREDITS_COOKIE, serializeCredits(nextState), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  try {
    const result = streamProductChat({
      provider,
      apiKey,
      model: appConfig.ai.model,
      system: persona.system,
      messages: body.messages,
      maxTokens: appConfig.ai.maxTokens,
      temperature: appConfig.ai.temperature,
      maxHistory: appConfig.ai.maxHistory,
      siteUrl: process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
      siteName: process.env.OPENROUTER_SITE_NAME ?? appConfig.name,
    });

    return result.toDataStreamResponse({
      headers: {
        "X-Credits-Remaining": String(
          Math.max(0, nextState.freePerDay - nextState.used)
        ),
        "X-AI-Provider": provider,
        "X-AI-Model": appConfig.ai.model,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    return Response.json({ error: message }, { status: 500 });
  }
}
