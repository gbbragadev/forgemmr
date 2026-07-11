# Scorecard L0/P0 — Anime Quiz (personagem / arquétipo)

**Data:** 2026-07-10 · **Agent:** grok · **Job:** L0/P0  
**Ideia (PLAYBOOK #4):** Quiz de personagem/arquétipo anime → resultado shareable (card) + CTA app.

## Veredito

# **GO** (condicionado a content-first)

**Não scaffoldar L1 ainda.** Próximo step = **L0/P1** hooks do quiz (15 PT-BR) → testar bio/CTA → só então L1/B1 se houver sinal.

## Scorecard (PLAYBOOK)

| Critério | Peso | Nota (1–5) | Comentário |
|----------|------|------------|------------|
| Hook 1 frase + visual shareable | alto | **5** | “Descobri meu arquétipo anime em 30s” + card 9:16 = formato nativo TikTok/Reels |
| Capability já existe? | alto | **4** | MVP **sem** capability nova: banco JSON de perguntas + score client-side. AI (`chat`) opcional depois (explicação do resultado). **Não** precisa `image` no v1 |
| Custo API &lt; preço coin | alto | **5** | Quiz estático = **R$0** de API no free path; deepseek só se “modo IA” opcional |
| Fit audiência anime | alto | **5** | Quiz de personalidade é staple do nicho; reusa conta anime (não pivota) |
| Risco legal OK | alto | **4** | **GO só com arquétipos / originais** (kuudere, rival, idol…). **NO-GO** se “você é [personagem de obra X]” com IP |
| Tempo MVP | — | **5** | Clone shell waifu-chat + 1 flow quiz + share card (padrão B3) em poucas iterações L1 |

**Média ponderada (intuitiva): ~4,7/5 → GO.**

## 3 porquês (resumo)

1. **Share nativo** — resultado de quiz é o melhor hook orgânico depois de chat; card já validado no waifu-chat (B3).
2. **Kernel suficiente** — não inventa capability; monorepo + tokens UI + OpenRouter opcional; custo free path zero.
3. **Risco controlável** — com arquétipos originais / “estilo”, legal e brand safe; MVP em dias, não semanas.

## Riscos / condições do GO

| Risco | Mitigação |
|-------|-----------|
| Canibalizar atenção do WaifuChat | CTA unificado na bio; quiz como **segundo app**, não feature escondida no chat |
| IP / “você é Goku” | Resultados = **arquétipos** ou personas do pack forge; nunca nome de obra protegida como identidade |
| Super-app | App `anime-quiz` separado (`defineApp`), capability mínima (quiz local; chat opcional depois) |
| Build cedo demais | **Proibido L1/B1 até P1** (hooks + 5–7d measure se possível) |

## Escopo MVP (quando L1 liberar — só referência, **não codar agora**)

- 8–12 perguntas PT-BR, 4–6 arquétipos resultado
- Score client-side, share card 9:16
- Free unlimited ou soft limit (sem AI no caminho crítico)
- Sem billing real, sem image, sem App Store

## NO-GO se…

- Resultado for cosplay de personagem licenciado
- Dependência obrigatória de modelo caro no free
- Virar “20 features” no waifu-chat

## Próximo step (1 linha)

**GO → L0/P1:** 15 content hooks PT-BR do **anime-quiz** → `docs/content-hooks-anime-quiz.md` (sem código de app).

## Conteúdo sem código (se quisesse NO-GO parcial)

Mesmo com GO: validar 5 Reels “quiz no Stories / carrossel” **antes** de B1; se CTR/bio mortos → kill ideia, não scaffold.
