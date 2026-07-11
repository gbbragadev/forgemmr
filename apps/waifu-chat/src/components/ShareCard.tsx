"use client";

import type { CSSProperties } from "react";
import type { Persona } from "@forge/config";

type Props = {
  open: boolean;
  persona: Persona;
  appName: string;
  /** Última fala do assistant, ou o starter quando ainda não houver conversa. */
  message: string;
  /** Template de hook (ex.: "Conversei com {persona} e…"). Opcional. */
  hook?: string;
  onClose: () => void;
};

function truncate(s: string, n = 120): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1).trimEnd()}…` : clean;
}

// ponytail: card é HTML/CSS screenshot-friendly; sem dep de canvas/html-to-image.
// navigator.share(texto) + clipboard fallback cobrem o compartilhamento real.
export function ShareCard({ open, persona, appName, message, hook, onClose }: Props) {
  if (!open) return null;

  const snippet = truncate(message);
  const text = hook
    ? `${hook.replace("{persona}", persona.displayName)}\n\n"${snippet}" — ${persona.displayName} · ${appName}`
    : `Conversando com ${persona.displayName} no ${appName}.\n\n"${snippet}"`;

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: appName, text });
        return;
      }
    } catch {
      return; // usuário cancelou o sheet
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Texto copiado! Cole onde quiser — ou tire print do card acima.");
    } catch {
      alert(text);
    }
  }

  const cardStyle = { "--af-p": persona.color ?? "#ff4d9a" } as CSSProperties;

  return (
    <div className="af-sc-overlay" role="dialog" aria-modal="true" aria-label="Compartilhar conversa">
      <button type="button" className="af-sc-close" onClick={onClose} aria-label="Fechar">
        ✕
      </button>

      <div className="af-sc-card" style={cardStyle}>
        <div>
          <div className="af-sc-brand">{appName}</div>
          <div className="af-sc-persona">
            <span className="af-sc-avatar" aria-hidden="true">
              {persona.displayName.slice(0, 1)}
            </span>
            <span className="af-sc-name">{persona.displayName}</span>
          </div>
          <p className="af-sc-snippet">&ldquo;{snippet}&rdquo;</p>
        </div>
        <div className="af-sc-watermark">personagens originais · anime</div>
      </div>

      <div className="af-sc-actions">
        <button type="button" className="af-sc-primary" onClick={share}>
          Compartilhar
        </button>
        <button type="button" className="af-sc-ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="af-sc-hint">Dica: tire um print do card para Reels / TikTok.</p>
    </div>
  );
}
