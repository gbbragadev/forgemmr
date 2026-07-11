import { z } from "zod";

export const aiConfigSchema = z.object({
  /** Product LLM: zai (GLM) default | openrouter fallback */
  provider: z.enum(["zai", "openrouter"]).default("zai"),
  model: z.string().min(1),
  maxHistory: z.number().int().min(1).max(50).default(12),
  maxTokens: z.number().int().min(50).max(4000).default(400),
  temperature: z.number().min(0).max(2).default(0.8),
});

export const monetizationSchema = z.object({
  freePerDay: z.number().int().min(0).default(2),
  watermark: z.boolean().default(true),
  products: z.array(z.string()).default(["coins_s", "coins_m", "weekly"]),
});

export const personaSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  tags: z.array(z.string()).default([]),
  system: z.string().min(1),
  starter: z.string().min(1),
  avatar: z.string().optional(),
  color: z.string().optional(),
  /** conteúdo EN (regra da casa: apps bilíngues PT-BR + EN) */
  en: z
    .object({
      displayName: z.string().min(1),
      tags: z.array(z.string()).default([]),
      starter: z.string().min(1),
    })
    .optional(),
});

export const appConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  niche: z.string().default("anime"),
  locale: z.string().default("pt-BR"),
  capabilities: z
    .array(z.enum(["chat", "image", "face-swap", "gallery", "quiz"]))
    .min(1),
  ai: aiConfigSchema,
  monetization: monetizationSchema,
  legal: z.object({
    disclaimer: z.string(),
  }),
  seo: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
  }),
  share: z
    .object({
      tiktokHookTemplates: z.array(z.string()).default([]),
    })
    .default({ tiktokHookTemplates: [] }),
  personas: z.array(personaSchema).min(1),
});

export type AiConfig = z.infer<typeof aiConfigSchema>;
export type MonetizationConfig = z.infer<typeof monetizationSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export function defineApp(config: AppConfig): AppConfig {
  return appConfigSchema.parse(config);
}

export * from "./i18n";
