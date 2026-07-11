/**
 * Product AI credentials (WaifuChat / apps) — NOT coding-agent keys.
 *
 * Providers:
 * - zai (default): Z.AI / GLM OpenAI-compatible API
 * - openrouter: legacy / fallback
 *
 * Agents: read env only — never ask user to paste keys in chat.
 */

export type ProductAiProvider = "zai" | "openrouter";

export const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Free-tier flash — best default for high-volume persona chat (returns content reliably) */
export const ZAI_DEFAULT_MODEL = "glm-4.5-flash";

/** Stronger (paid) — set ZAI_MODEL=glm-5.2 if needed */
export const ZAI_QUALITY_MODEL = "glm-5.2";

export function getProductAiProvider(
  env: NodeJS.ProcessEnv = process.env
): ProductAiProvider {
  const raw = (
    env.PRODUCT_AI_PROVIDER ||
    env.AI_PROVIDER ||
    ""
  )
    .trim()
    .toLowerCase();

  if (raw === "openrouter" || raw === "or") return "openrouter";
  if (raw === "zai" || raw === "z.ai" || raw === "glm" || raw === "zhipu") {
    return "zai";
  }

  // Auto: prefer Z.AI if key present, else OpenRouter
  if (getZaiApiKey(env)) return "zai";
  if (getOpenRouterApiKey(env)) return "openrouter";
  return "zai";
}

export function getZaiApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const key =
    env.ZAI_API_KEY?.trim() ||
    env.Z_AI_API_KEY?.trim() ||
    env.GLM_API_KEY?.trim() ||
    undefined;
  return key || undefined;
}

export function getOpenRouterApiKey(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const key =
    env.OPEN_ROUTER_API_KEY?.trim() ||
    env.OPENROUTER_API_KEY?.trim() ||
    undefined;
  return key || undefined;
}

export function getProductApiKey(
  env: NodeJS.ProcessEnv = process.env,
  provider: ProductAiProvider = getProductAiProvider(env)
): string | undefined {
  if (provider === "zai") return getZaiApiKey(env);
  return getOpenRouterApiKey(env);
}

export function getProductModel(
  env: NodeJS.ProcessEnv = process.env,
  provider: ProductAiProvider = getProductAiProvider(env)
): string {
  if (provider === "zai") {
    return (
      env.ZAI_MODEL?.trim() ||
      env.GLM_MODEL?.trim() ||
      env.OPENROUTER_MODEL?.trim() || // allow override reuse
      ZAI_DEFAULT_MODEL
    );
  }
  return (
    env.OPENROUTER_MODEL?.trim() ||
    env.OPEN_ROUTER_MODEL?.trim() ||
    "deepseek/deepseek-v4-flash"
  );
}

/** @deprecated use getProductModel */
export function getOpenRouterModel(
  env: NodeJS.ProcessEnv = process.env,
  fallback = "deepseek/deepseek-v4-flash"
): string {
  return getProductModel(env) || fallback;
}

export function getProductBaseUrl(
  provider: ProductAiProvider = getProductAiProvider()
): string {
  return provider === "zai" ? ZAI_BASE_URL : OPENROUTER_BASE_URL;
}

export function productKeyHint(
  provider: ProductAiProvider = getProductAiProvider()
): string {
  if (provider === "zai") {
    return (
      "ZAI_API_KEY ausente. Defina no apps/<app>/.env.local ou env do sistema. " +
      "Docs: https://docs.z.ai/guides/overview/quick-start — só produto, não coding agent."
    );
  }
  return (
    "OPEN_ROUTER_API_KEY ausente no ambiente do processo. " +
    "Setar no Windows ou OPENROUTER_API_KEY em .env.local. Só produto — não coding agent."
  );
}

/** @deprecated use productKeyHint */
export function openRouterKeyHint(): string {
  return productKeyHint(getProductAiProvider());
}
