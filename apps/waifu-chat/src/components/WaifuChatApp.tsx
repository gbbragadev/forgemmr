"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import type { Persona } from "@forge/config";
import {
  CharacterCard,
  ChatBubble,
  CreditBadge,
  PaywallModal,
} from "@forge/ui";
import { ShareCard } from "./ShareCard";

type Props = {
  personas: Persona[];
  freePerDay: number;
  disclaimer: string;
  appName: string;
  shareHooks: string[];
};

// ponytail: chips derivados do tom via tags (schema não tem `tone`, e sem chamada de API).
const TONE_REPLIES: Record<string, string[]> = {
  gentil: ["Oi… posso te contar um segredo?", "Como foi seu dia?", "Quer conversar um pouco?"],
  tsundere: ["Por que você age assim?", "Me prova que se importa.", "Qual seu ponto fraco?"],
  rival: ["Por que tão sério hoje?", "O que te faz tão confiante?", "Me conta seu maior desafio."],
  cyber: ["O que esse lugar esconde?", "Me conta algo que ninguém sabe.", "Por que me deixou ficar?"],
  misterioso: ["Quem é você de verdade?", "O que você vê em mim?", "Me surpreenda."],
  idol: ["Me faz companhia hoje?", "Qual seu maior sonho de fã?", "Me ensina uma gíria sua?"],
  energética: ["Bora conversar agora!", "Qual sua animação favorita?", "Me conta algo fofo!"],
  sábia: ["O que está pesando em você?", "Me dá um conselho de vida.", "Como você mantém a calma?"],
  mentor: ["Pode me orientar?", "O que devo decidir agora?", "Me conta uma lição sua."],
  confiante: ["Por que tão cheio de si?", "Me conta uma história sua.", "O que você quer de verdade?"],
};

function replySuggestions(p: Persona): string[] {
  const t = p.tags.join(" ").toLowerCase();
  for (const key of Object.keys(TONE_REPLIES)) {
    if (t.includes(key)) return TONE_REPLIES[key];
  }
  return ["Oi! Tudo bem?", "Me conta sobre você.", "Sobre o que vamos conversar?"];
}

export function WaifuChatApp({ personas, freePerDay, disclaimer, appName, shareHooks }: Props) {
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(freePerDay);
  const [paywall, setPaywall] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const persona = useMemo(
    () => personas.find((p) => p.id === personaId) ?? null,
    [personas, personaId]
  );

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return;
      const data = (await res.json()) as { remaining: number };
      setRemaining(data.remaining);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  const { messages, input, setInput, handleSubmit, isLoading, setMessages, error } =
    useChat({
      api: "/api/chat",
      body: { personaId },
      onError: (err) => {
        if (err.message.includes("402") || err.message.toLowerCase().includes("credit")) {
          setPaywall(true);
        }
      },
      onFinish: () => {
        void refreshCredits();
      },
      onResponse: async (res) => {
        if (res.status === 402) {
          setPaywall(true);
          return;
        }
        const header = res.headers.get("X-Credits-Remaining");
        if (header != null) setRemaining(Number(header));
      },
    });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return persona?.starter ?? "";
  }, [messages, persona]);

  const shareHook = useMemo(
    () => shareHooks.find((h) => h.includes("{persona}")) ?? shareHooks[0],
    [shareHooks]
  );

  function selectPersona(id: string) {
    setPersonaId(id);
    const p = personas.find((x) => x.id === id);
    setMessages(
      p
        ? [
            {
              id: "starter",
              role: "assistant",
              content: p.starter,
            },
          ]
        : []
    );
  }

  function backToGrid() {
    setPersonaId(null);
    setMessages([]);
    setInput("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!personaId || !input.trim() || isLoading) return;

    // preflight credits
    const cred = await fetch("/api/credits");
    if (cred.ok) {
      const data = (await cred.json()) as { remaining: number };
      setRemaining(data.remaining);
      if (data.remaining <= 0) {
        setPaywall(true);
        return;
      }
    }

    handleSubmit(e);
  }

  if (!persona) {
    return (
      <>
        <div className="af-topbar">
          <strong>Escolha quem vai te responder</strong>
          <CreditBadge remaining={remaining} freePerDay={freePerDay} />
        </div>
        {personas.length === 0 ? (
          <div className="af-grid-empty">
            <div className="af-grid-empty-icon" aria-hidden="true">
              ♡
            </div>
            <strong>Nenhum personagem ainda</strong>
            <span>Em breve mais arquétipos. Volta logo!</span>
          </div>
        ) : (
          <div className="af-grid">
            {personas.map((p) => (
              <CharacterCard
                key={p.id}
                name={p.displayName}
                tags={p.tags}
                color={p.color}
                onClick={() => selectPersona(p.id)}
              />
            ))}
          </div>
        )}
        <p className="af-disclaimer">{disclaimer}</p>
        <PaywallModal open={paywall} onClose={() => setPaywall(false)} />
      </>
    );
  }

  return (
    <>
      <div className="af-topbar">
        <button
          type="button"
          className="af-back"
          onClick={backToGrid}
          aria-label="Voltar aos personagens"
        >
          ← Personagens
        </button>
        <div className="af-topbar-name">{persona.displayName}</div>
        <div className="af-topbar-right">
          <button
            type="button"
            className="af-icon-btn"
            onClick={() => setShareOpen(true)}
            aria-label="Compartilhar conversa"
            title="Compartilhar"
          >
            ↗
          </button>
          <CreditBadge remaining={remaining} freePerDay={freePerDay} />
        </div>
      </div>

      <section className="af-panel">
        <div className="af-chat-log" ref={logRef}>
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role === "user" ? "user" : "assistant"}
              accent={persona.color}
            >
              {m.content}
            </ChatBubble>
          ))}
          {isLoading && (
            <div
              className="af-typing"
              role="status"
              aria-busy="true"
              aria-label={`${persona.displayName} está digitando`}
            >
              <span style={{ background: persona.color }} />
              <span style={{ background: persona.color }} />
              <span style={{ background: persona.color }} />
            </div>
          )}
          {!isLoading && messages.length <= 1 && (
            <div className="af-chips" role="list" aria-label="Sugestões de resposta">
              {replySuggestions(persona).map((s) => (
                <button key={s} type="button" className="af-chip" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="af-composer" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Fale com ${persona.displayName}…`}
            disabled={isLoading}
            maxLength={500}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            Enviar
          </button>
        </form>

        {error && (
          <p className="af-error" role="alert">
            {error.message.includes("402") ? "Sem créditos. Abra o paywall." : error.message}
          </p>
        )}
      </section>

      <p className="af-disclaimer">{disclaimer}</p>
      <PaywallModal open={paywall} onClose={() => setPaywall(false)} />
      <ShareCard
        open={shareOpen}
        persona={persona}
        appName={appName}
        message={lastAssistant}
        hook={shareHook}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
