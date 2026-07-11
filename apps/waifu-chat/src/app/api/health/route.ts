import {
  getProductAiProvider,
  getProductApiKey,
  getProductBaseUrl,
  getProductModel,
} from "@anime-forge/ai";

/** Smoke: confere provider/key do produto (sem vazar o valor). */
export async function GET() {
  const provider = getProductAiProvider();
  const key = getProductApiKey(process.env, provider);
  const model = getProductModel(process.env, provider);

  let source: string | null = null;
  if (provider === "zai") {
    if (process.env.ZAI_API_KEY?.trim()) source = "ZAI_API_KEY";
    else if (process.env.Z_AI_API_KEY?.trim()) source = "Z_AI_API_KEY";
    else if (process.env.GLM_API_KEY?.trim()) source = "GLM_API_KEY";
  } else {
    if (process.env.OPEN_ROUTER_API_KEY?.trim()) source = "OPEN_ROUTER_API_KEY";
    else if (process.env.OPENROUTER_API_KEY?.trim()) source = "OPENROUTER_API_KEY";
  }

  return Response.json({
    ok: Boolean(key),
    productAi: {
      provider,
      baseUrl: getProductBaseUrl(provider),
      configured: Boolean(key),
      source,
      model,
      keyLength: key?.length ?? 0,
    },
    // legacy shape for older checks
    openRouter: {
      configured: provider === "openrouter" && Boolean(key),
      source: provider === "openrouter" ? source : null,
      model: provider === "openrouter" ? model : null,
      keyLength: provider === "openrouter" ? key?.length ?? 0 : 0,
    },
    hint: key
      ? `Provider ${provider} ok — smoke de chat pode rodar (${model}).`
      : provider === "zai"
        ? "Defina ZAI_API_KEY em apps/waifu-chat/.env.local (https://docs.z.ai/guides/overview/quick-start)"
        : "Defina OPEN_ROUTER_API_KEY no Windows ou OPENROUTER_API_KEY no .env.local",
  });
}
