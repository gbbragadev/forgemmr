import { defineApp, type Persona } from "@forge/config";
import archetypes from "../../content/personas/quiz-archetypes-v1.json";

const personas = archetypes as Persona[];

export const appConfig = defineApp({
  id: "anime-quiz",
  name: "AnimeQuiz",
  niche: "anime",
  locale: "pt-BR",
  capabilities: ["quiz"],
  ai: {
    provider: "openrouter",
    // não usado no free path estático; reservado se um dia tiver “explicar resultado”
    model:
      process.env.OPENROUTER_MODEL?.trim() ||
      process.env.OPEN_ROUTER_MODEL?.trim() ||
      "deepseek/deepseek-v4-flash",
    maxHistory: 4,
    maxTokens: 200,
    temperature: 0.7,
  },
  monetization: {
    freePerDay: 99,
    watermark: true,
    products: ["coins_s"],
  },
  legal: {
    disclaimer:
      "Entretenimento com arquétipos originais. Não afiliado a estúdios ou publishers. Resultado não é personagem de obra protegida.",
  },
  seo: {
    title: "AnimeQuiz — qual arquétipo anime é o seu?",
    description:
      "Quiz rápido em português: descubra seu arquétipo anime e compartilhe o card. Grátis.",
    ogImage: "/og.png",
  },
  share: {
    tiktokHookTemplates: [
      "Fiz o quiz de arquétipo anime e… 😳 #anime #quiz",
      "Resultado: {persona}. E o seu?",
      "30 segundos e o card já era printável",
    ],
  },
  personas,
});

export default appConfig;
