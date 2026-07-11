import type { Persona } from "@anime-forge/config";

export type QuizOption = {
  id: string;
  label: string;
  /** EN (regra da casa: conteúdo bilíngue) */
  labelEn?: string;
  weights: Record<string, number>;
};

export type QuizQuestion = {
  id: string;
  text: string;
  textEn?: string;
  options: QuizOption[];
};

export type QuizBank = {
  id: string;
  title: string;
  titleEn?: string;
  locale: string;
  questions: QuizQuestion[];
};

export function emptyScores(archetypeIds: string[]): Record<string, number> {
  return Object.fromEntries(archetypeIds.map((id) => [id, 0]));
}

export function applyWeights(
  scores: Record<string, number>,
  weights: Record<string, number>
): Record<string, number> {
  const next = { ...scores };
  for (const [id, w] of Object.entries(weights)) {
    next[id] = (next[id] ?? 0) + w;
  }
  return next;
}

export function pickWinner(
  scores: Record<string, number>,
  archetypes: Persona[]
): Persona {
  let bestId = archetypes[0]?.id ?? "";
  let best = -1;
  for (const [id, score] of Object.entries(scores)) {
    if (score > best) {
      best = score;
      bestId = id;
    }
  }
  return (
    archetypes.find((a) => a.id === bestId) ??
    archetypes[0] ?? {
      id: "soft",
      displayName: "Coração Soft",
      tags: [],
      starter: "",
      system: "",
    }
  );
}
