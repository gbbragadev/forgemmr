import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import {
  getOpenRouterApiKey,
  getOpenRouterModel,
  getProductAiProvider,
  getProductApiKey,
  getProductBaseUrl,
  getProductModel,
  openRouterKeyHint,
  productKeyHint,
  type ProductAiProvider,
  ZAI_BASE_URL,
  ZAI_DEFAULT_MODEL,
  ZAI_QUALITY_MODEL,
} from "./env";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ProductChatOptions = {
  provider?: ProductAiProvider;
  apiKey?: string;
  model?: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  maxHistory?: number;
  siteUrl?: string;
  siteName?: string;
};

/** @deprecated use ProductChatOptions */
export type OpenRouterChatOptions = ProductChatOptions;

export function createProductClient(opts: {
  provider?: ProductAiProvider;
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
}) {
  const provider = opts.provider ?? getProductAiProvider();
  const baseURL = getProductBaseUrl(provider);

  return createOpenAI({
    apiKey: opts.apiKey,
    baseURL,
    headers:
      provider === "openrouter"
        ? {
            ...(opts.siteUrl ? { "HTTP-Referer": opts.siteUrl } : {}),
            ...(opts.siteName ? { "X-Title": opts.siteName } : {}),
          }
        : {
            "Accept-Language": "en-US,en",
          },
  });
}

/** @deprecated use createProductClient */
export function createOpenRouterClient(opts: {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
}) {
  return createProductClient({ ...opts, provider: "openrouter" });
}

export function trimHistory(
  messages: ChatMessage[],
  maxHistory: number
): ChatMessage[] {
  const nonSystem = messages.filter((m) => m.role !== "system");
  if (nonSystem.length <= maxHistory) return nonSystem;
  return nonSystem.slice(-maxHistory);
}

export function streamProductChat(options: ProductChatOptions) {
  const {
    system,
    messages,
    maxTokens = 400,
    temperature = 0.8,
    maxHistory = 12,
    siteUrl,
    siteName,
  } = options;

  const provider = options.provider ?? getProductAiProvider();
  const apiKey = options.apiKey?.trim() || getProductApiKey(process.env, provider);
  const model = options.model?.trim() || getProductModel(process.env, provider);

  if (!apiKey) {
    throw new Error(productKeyHint(provider));
  }

  const client = createProductClient({
    provider,
    apiKey,
    siteUrl,
    siteName,
  });
  const history = trimHistory(messages, maxHistory) as CoreMessage[];

  return streamText({
    model: client.chat(model),
    system,
    messages: history,
    maxTokens,
    temperature,
  });
}

/** @deprecated use streamProductChat */
export function streamOpenRouterChat(options: ProductChatOptions) {
  return streamProductChat({ ...options, provider: options.provider ?? "openrouter" });
}

export {
  streamText,
  getOpenRouterApiKey,
  getOpenRouterModel,
  getProductAiProvider,
  getProductApiKey,
  getProductBaseUrl,
  getProductModel,
  openRouterKeyHint,
  productKeyHint,
  ZAI_BASE_URL,
  ZAI_DEFAULT_MODEL,
  ZAI_QUALITY_MODEL,
};
export type { ProductAiProvider };
