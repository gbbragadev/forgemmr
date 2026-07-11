"use client";

import { useEffect, useState } from "react";
import { getLocale, setLocale as persistLocale, t, type Dict, type Locale } from "@anime-forge/config";

/** strings de UI do quiz — PT default, EN alternate */
export const STRINGS = {
  episodeBadge: { pt: "EP. 01 · QUIZ DE ARQUÉTIPO", en: "EP. 01 · ARCHETYPE QUIZ" },
  heroSub: {
    pt: "Descubra seu arquétipo anime em poucos cliques. Resultado shareable — personagens e arquétipos originais.",
    en: "Find your anime archetype in a few taps. Shareable result — original characters and archetypes.",
  },
  lead: {
    pt: "Respostas honestas, resultado na hora. No fim sai um card pra printar e compartilhar — você pode ser um destes ↓",
    en: "Honest answers, instant result. You get a printable, shareable card — you might be one of these ↓",
  },
  start: { pt: "Começar o arco", en: "Start your arc" },
  scene: { pt: "CENA", en: "SCENE" },
  exit: { pt: "Sair", en: "Exit" },
  yourArchetype: { pt: "Seu arquétipo", en: "Your archetype" },
  share: { pt: "Compartilhar card", en: "Share card" },
  redo: { pt: "Refazer o arco", en: "Redo the arc" },
  shared: { pt: "Compartilhado!", en: "Shared!" },
  copied: { pt: "Texto copiado — cola no Stories/TikTok.", en: "Copied — paste it on Stories/TikTok." },
  copyManual: { pt: "Copie manualmente o resultado e poste.", en: "Copy the result manually and post it." },
  emptyQuiz: { pt: "Quiz sem perguntas. Verifique o banco JSON.", en: "Quiz has no questions. Check the JSON bank." },
  back: { pt: "Voltar", en: "Back" },
  possible: { pt: "Seus possíveis arquétipos", en: "Your possible archetypes" },
  linkInBio: { pt: "link na bio", en: "link in bio" },
  watermark: { pt: "ARCANA · ARQUÉTIPOS ORIGINAIS", en: "ARCANA · ORIGINAL ARCHETYPES" },
  disclaimerEn: {
    pt: "", // não usado — PT vem do app.config (fonte única)
    en: "Entertainment with original archetypes. Not affiliated with any studio or publisher. Results are not characters from protected works.",
  },
} satisfies Dict;

export type StringKey = keyof typeof STRINGS;

/** hook: locale persistido em localStorage (anime-forge-lang) */
export function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>("pt");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const set = (l: Locale) => {
    persistLocale(l);
    setLocaleState(l);
  };
  return [locale, set];
}

export function useT(locale: Locale) {
  return (key: StringKey) => t(STRINGS, key, locale);
}
