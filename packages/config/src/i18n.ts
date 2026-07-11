/**
 * i18n mínimo da factory — client-only, zero deps (regra da casa: todo app PT-BR + EN).
 * Apps estáticos (output: "export") não têm middleware: o toggle vive no client
 * e persiste em localStorage. PT-BR é o default/SEO; EN é alternate.
 */

export type Locale = "pt" | "en";

const STORAGE_KEY = "anime-forge-lang";

export function getLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "pt";
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

/** dicionário: { chave: { pt: "...", en: "..." } } */
export type Dict<K extends string = string> = Record<K, { pt: string; en: string }>;

export function t<K extends string>(dict: Dict<K>, key: K, locale: Locale): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[locale] ?? entry.pt;
}
