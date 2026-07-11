import { defineApp, type Persona } from "@anime-forge/config";
import packV1 from "../../content/personas/waifu-pack-v1.json";
import packV2 from "../../content/personas/waifu-pack-v2.json";

const personas = [...(packV1 as Persona[]), ...(packV2 as Persona[])];

export const appConfig = defineApp({
  id: "waifu-chat",
  name: "WaifuChat",
  niche: "anime",
  locale: "pt-BR",
  capabilities: ["chat"],
  ai: {
    // Z.AI / GLM — https://docs.z.ai/guides/overview/quick-start
    // default free flash (chat viral); quality: ZAI_MODEL=glm-5.2
    provider: "zai",
    model:
      process.env.ZAI_MODEL?.trim() ||
      process.env.GLM_MODEL?.trim() ||
      process.env.OPENROUTER_MODEL?.trim() ||
      "glm-4.5-flash",
    maxHistory: 12,
    maxTokens: 400,
    temperature: 0.85,
  },
  monetization: {
    freePerDay: 2,
    watermark: true,
    products: ["coins_s", "coins_m", "weekly"],
  },
  legal: {
    disclaimer:
      "Entretenimento com personagens originais / arquétipos. Não afiliado a estúdios ou publishers.",
  },
  seo: {
    title: "WaifuChat — converse com personagens de anime (IA)",
    description:
      "Escolha um personagem estilo anime e converse em português. Grátis com limite diário.",
    ogImage: "/og.png",
  },
  share: {
    tiktokHookTemplates: [
      "Ela me respondeu isso 😳 #anime #ia",
      "Conversei com {persona} e…",
      "Meu personagem favorito me deu conselho de vida",
    ],
  },
  personas,
});

export default appConfig;
