"use client";

import { useMemo, useState } from "react";
import type { Persona } from "@forge/config";
import {
  applyWeights,
  emptyScores,
  pickWinner,
  type QuizBank,
} from "../lib/quiz";
import { useLocale, useT } from "../lib/i18n";

type Props = {
  quiz: QuizBank;
  archetypes: Persona[];
  appName: string;
  disclaimer: string;
  shareHooks: string[];
};

type Phase = "intro" | "quiz" | "result";

/* ---- decor original (SVG inline, zero asset/IP) ---- */

// silhueta de busto manga genérico (cabeça + cabelo pontudo + ombros), gradiente sakura→magenta
const SILHOUETTE = (
  <svg className="af-silhouette" viewBox="0 0 140 180" aria-hidden="true">
    <defs>
      <linearGradient id="afSil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffb7d5" />
        <stop offset="0.5" stopColor="#ff4d9a" />
        <stop offset="1" stopColor="#c44dff" />
      </linearGradient>
    </defs>
    <g fill="url(#afSil)">
      <ellipse cx="70" cy="50" rx="30" ry="33" />
      <path d="M40 54 L46 30 L52 49 L58 24 L64 47 L70 18 L76 47 L82 24 L88 49 L94 30 L100 54 C100 66 90 72 70 72 C50 72 40 66 40 54 Z" />
      <path d="M52 76 L88 76 L88 88 C104 92 116 108 118 130 L124 180 L16 180 L22 130 C24 108 36 92 52 88 Z" />
    </g>
  </svg>
);

// estrela de 4 pontas (sparkle "kirakira")
const SPARKLE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
      fill="currentColor"
    />
  </svg>
);

// ícone de share (upload)
const SHARE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

// símbolo ◆ da ARCANA (gradiente cyan→magenta)
const ARCANA_DIAMOND = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="af-arcana-diamond">
    <defs>
      <linearGradient id="afArc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#22d3ee" />
        <stop offset="1" stopColor="#c44dff" />
      </linearGradient>
    </defs>
    <path d="M12 1 L23 12 L12 23 L1 12 Z" fill="url(#afArc)" />
  </svg>
);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AnimeQuizApp({
  quiz,
  archetypes,
  appName,
  disclaimer,
  shareHooks,
}: Props) {
  const ids = useMemo(() => archetypes.map((a) => a.id), [archetypes]);
  const [locale, setLocale] = useLocale();
  const t = useT(locale);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState(() => emptyScores(ids));
  const [result, setResult] = useState<Persona | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  // conteúdo localizado (fallback PT sempre)
  const en = locale === "en";
  const pName = (p: Persona) => (en && p.en ? p.en.displayName : p.displayName);
  const pStarter = (p: Persona) => (en && p.en ? p.en.starter : p.starter);
  const pTags = (p: Persona) => (en && p.en?.tags?.length ? p.en.tags : p.tags);

  const total = quiz.questions.length;
  const question = quiz.questions[index];
  const progress = phase === "quiz" ? ((index + 1) / total) * 100 : phase === "result" ? 100 : 0;

  function start() {
    setScores(emptyScores(ids));
    setIndex(0);
    setResult(null);
    setShareNote(null);
    setPhase("quiz");
  }

  function choose(weights: Record<string, number>) {
    const nextScores = applyWeights(scores, weights);
    setScores(nextScores);

    if (index + 1 >= total) {
      setResult(pickWinner(nextScores, archetypes));
      setPhase("result");
      return;
    }
    setIndex((i) => i + 1);
  }

  async function shareResult() {
    if (!result) return;
    const name = pName(result);
    const hook = en
      ? `My anime archetype on ${appName}: ${name}`
      : (shareHooks[0]?.replace("{persona}", name) ?? `Meu arquétipo no ${appName}: ${name}`);
    const text = [
      hook,
      pStarter(result),
      pTags(result).map((tg) => `#${tg.replace(/\s+/g, "")}`).join(" "),
      "#anime #quiz",
      t("linkInBio"),
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: appName, text });
        setShareNote(t("shared"));
        return;
      }
    } catch {
      /* user cancel / fallback */
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareNote(t("copied"));
    } catch {
      setShareNote(t("copyManual"));
    }
  }

  const header = (
    <header className="af-hero">
      <div className="af-hero-top">
        <span className="af-brandmark af-brandmark-sm">
          {ARCANA_DIAMOND}
          ARCANA
        </span>
        <div className="af-lang" role="group" aria-label="Idioma / Language">
          <button
            type="button"
            className={locale === "pt" ? "on" : ""}
            aria-pressed={locale === "pt"}
            onClick={() => setLocale("pt")}
          >
            PT
          </button>
          <button
            type="button"
            className={locale === "en" ? "on" : ""}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </div>
      <h1>{appName}</h1>
      <p>{t("heroSub")}</p>
    </header>
  );

  const seal = (
    <p className="af-seal-row">
      <span className="af-seal">by @otaku_sincero69</span>
    </p>
  );

  if (phase === "intro") {
    return (
      <>
        {header}
        <section className="af-panel af-quiz-intro">
          <span className="af-episode-badge af-mono-badge">
            <span className="af-dot" />
            {t("episodeBadge")}
          </span>
          <div className="af-manga-scene">
            <span className="af-sparkle" style={{ top: "4%", left: "12%", width: 18, height: 18 }}>
              {SPARKLE}
            </span>
            <span
              className="af-sparkle"
              style={{ top: "20%", right: "10%", width: 24, height: 24, animationDelay: "0.9s" }}
            >
              {SPARKLE}
            </span>
            <span
              className="af-sparkle"
              style={{ bottom: "12%", left: "6%", width: 14, height: 14, animationDelay: "1.6s" }}
            >
              {SPARKLE}
            </span>
            {SILHOUETTE}
          </div>
          <h2>{en && quiz.titleEn ? quiz.titleEn : quiz.title}</h2>
          <p className="af-lead">{t("lead")}</p>
          <div className="af-arch-preview" aria-label={t("possible")}>
            {archetypes.map((a) => (
              <div className="af-arch-chip" key={a.id} style={{ ["--chip" as string]: a.color }}>
                <span className="af-arch-dot">{pName(a).charAt(0)}</span>
                <span className="af-arch-name">{cap(a.id)}</span>
              </div>
            ))}
          </div>
          <button type="button" className="af-btn-primary" onClick={start}>
            {t("start")}
          </button>
        </section>
        {seal}
        <p className="af-disclaimer">{en ? t("disclaimerEn") : disclaimer}</p>
      </>
    );
  }

  if (phase === "result" && result) {
    return (
      <>
        {header}
        <div className="af-progress" aria-hidden>
          <div className="af-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <section
          className="af-result-card"
          style={{ ["--result-accent" as string]: result.color ?? "#c44dff" }}
        >
          <span className="af-corner af-corner-tl" />
          <span className="af-corner af-corner-tr" />
          <span className="af-corner af-corner-bl" />
          <span className="af-corner af-corner-br" />
          <span className="af-rec af-mono-badge" aria-hidden>
            <span className="af-rec-dot" /> REC
          </span>
          <div className="af-result-aura" aria-hidden />
          <div className="af-result-head">
            <div className="af-result-monogram">{pName(result).charAt(0)}</div>
            <p className="af-kicker af-mono-badge">{t("yourArchetype")}</p>
            <h2>{pName(result)}</h2>
          </div>
          <p className="af-result-blurb">{pStarter(result)}</p>
          <ul className="af-tags">
            {pTags(result).map((tg) => (
              <li key={tg}>{tg}</li>
            ))}
          </ul>
          <p className="af-timestamp af-mono-badge" aria-hidden>
            ◆ {new Date().getFullYear()} ▸ EP.01 ▸ {String(total).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </p>
          <p className="af-watermark">{t("watermark")}</p>
        </section>
        <div className="af-actions">
          <button type="button" className="af-btn-primary" onClick={shareResult}>
            {SHARE_ICON}
            {t("share")}
          </button>
          <button type="button" className="af-btn-ghost" onClick={start}>
            {t("redo")}
          </button>
        </div>
        {shareNote && <p className="af-share-note" role="status">{shareNote}</p>}
        {seal}
        <p className="af-disclaimer">{en ? t("disclaimerEn") : disclaimer}</p>
      </>
    );
  }

  if (!question) {
    return (
      <>
        {header}
        <section className="af-panel">
          <p>{t("emptyQuiz")}</p>
          <button type="button" className="af-btn-ghost" onClick={() => setPhase("intro")}>
            {t("back")}
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="af-topbar">
        <div className="af-scene-head">
          <span className="af-scene-label">{t("scene")}</span>
          <span className="af-scene-num">{String(index + 1).padStart(2, "0")}</span>
          <span className="af-scene-total">/ {String(total).padStart(2, "0")}</span>
        </div>
        <button type="button" className="af-btn-ghost af-btn-sm" onClick={() => setPhase("intro")}>
          {t("exit")}
        </button>
      </div>
      <div
        className="af-progress"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div className="af-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <section className="af-panel af-panel--scene">
        <h2 className="af-q">{en && question.textEn ? question.textEn : question.text}</h2>
        <div className="af-options" role="list">
          {question.options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              className="af-option"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => choose(opt.weights)}
            >
              <span className="af-option-mark">{String.fromCharCode(65 + i)}</span>
              <span className="af-option-label">{en && opt.labelEn ? opt.labelEn : opt.label}</span>
            </button>
          ))}
        </div>
      </section>
      <p className="af-disclaimer">{disclaimer}</p>
    </>
  );
}
