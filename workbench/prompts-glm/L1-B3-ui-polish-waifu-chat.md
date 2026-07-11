# Prompt GLM 5.2 MAX — L1/B3 UI polish (waifu-chat)

> Cole o bloco **PROMPT** abaixo no GLM 5.2 MAX (repo aberto em `C:\Dev\anime-forge`).  
> Grok / Codex **não** devem implementar este job — só handoff + este prompt.

---

## PROMPT

```
Você é um front-end senior mobile-first com gosto por UIs de app anime (dark, glow, hierarchy clara — sem AI slop genérico).

# Contexto
Repo monorepo: C:\Dev\anime-forge
App: apps/waifu-chat (Next.js 15 App Router)
Kernel UI: packages/ui (CharacterCard, ChatBubble, CreditBadge, PaywallModal)
Personas: 10 (v1+v2) via apps/waifu-chat/app.config.ts
Contrato agentes: AGENTS.md + workbench/ (claim L1/B3 se for fechar o job)

# Job (UMA iteração — só isto)
L1/B3 — UI polish mobile para waifu-chat:
1) Share card (exportável / screenshot-friendly)
2) Empty states melhores (grid + chat)
3) Polish visual mobile (touch targets, tipografia, safe spacing)

NÃO faça: billing real, capability image, refactor de AI/credits/API, redesign total do design system, novo app.

# Estado atual (ler antes de editar)
- apps/waifu-chat/src/components/WaifuChatApp.tsx
  - Grid de personas OU chat (useChat → /api/chat)
  - Empty chat: só texto "Mande a primeira mensagem…"
  - Sem share card
  - PaywallModal já existe em @anime-forge/ui
- apps/waifu-chat/src/app/globals.css — tokens .af-* (shell, hero, grid, panel, composer)
- packages/ui/src/* + packages/ui/src/styles.css — componentes shared
- appConfig.share.tiktokHookTemplates e appConfig.legal.disclaimer já existem
- Content hooks: docs/content-hooks-waifu-chat.md (copy de marketing; use como tom)

# Entregáveis concretos

## 1) Share card
- Componente (preferência: em apps/waifu-chat se for app-specific; só sobe p/ packages/ui se for reutilizável de verdade)
- Conteúdo mínimo:
  - Nome do app (WaifuChat)
  - Persona (displayName + accent color)
  - Snippet da última fala assistant (truncate ~120 chars) OU starter se ainda não houver msgs
  - Watermark discreto / “personagens originais”
  - Layout 9:16-friendly OU card 1:1 com borda glow (mobile first)
- UX: botão “Compartilhar” / “Card” no chat topbar ou abaixo do log
  - Preferir Web Share API se disponível + fallback copiar texto (hook de docs/content-hooks) ou download/print do card
  - Não precisa de backend de imagem se o card for HTML/CSS bem renderizável; se usar canvas/html-to-image, deixe dep opcional e falhe graceful

## 2) Empty states
- Grid (sem seleção): se personas.length === 0 (edge) e estado “escolha alguém” com hierarquia visual (ícone/ilustração CSS simples, não stock foto)
- Chat: empty state com
  - avatar/bolha com cor da persona
  - starter já vem como msg assistant — se messages só tem starter, tratar como “primeira impressão” (hint de sugestões de reply em chips: 3 prompts curtos PT-BR derivados do tom da persona, sem chamar API)
- Loading: substituir “…” por typing indicator acessível (aria-busy)
- Erro / 402: manter PaywallModal; mensagem de erro legível mobile (não inline style solto se puder virar classe)

## 3) Polish mobile
- Touch targets ≥ 44px em botões principais
- Composer sticky bottom em viewport mobile (sem quebrar desktop)
- Grid: minmax ok; cards com feedback pressed; tags legíveis
- Tipografia: contraste AA em texto muted sobre fundo dark
- Safe-area: padding-bottom env(safe-area-inset-bottom) no composer se sticky
- Sem quebrar SSR: "use client" só onde já precisa

# Restrições
- YAGNI / mínimo que fecha o job
- PT-BR na UI
- Personagens originais — copy não deve sugerir afiliação a estúdios
- Não commitar secrets; não pedir API keys
- Não alterar packages/ai nem lógica de créditos salvo ajuste visual do CreditBadge/Paywall

# VERIFY (obrigatório)
1. Claim em workbench/CLAIMS.md: A | glm | L1 | B3 | waifu-chat | <hora>
2. QUEUE: B3 Backlog → Doing → Done
3. npm run build (raiz) deve passar
4. Atualizar workbench/HANDOFF.md (last agent glm, next = L0/P0 ou o que restar)
5. Liberar claim

# Definition of Done
- [ ] Share card usável no mobile
- [ ] Empty states (grid + chat) não genéricos
- [ ] Composer/topbar confortáveis no telefone (~390px)
- [ ] build OK
- [ ] workbench coerente

# Estética alvo (direção, não kit novo)
Dark purple/pink glow já presente (--af-primary etc.). Visual “anime app 2025”:
hierarquia clara, pouco ruído, 1 accent por persona, motion sutil (150–250ms) se fácil.
Evitar: purple gradient genérico extra, emojis demais, glassmorphism exagerado, fonts novas sem necessidade.

Comece lendo os arquivos listados, implemente o mínimo, rode o build, feche o workbench.
```

---

## Como o Grok/Codex deve usar isto

1. Ao chegar em **L1/B3** (ou UI forte): **não codar** a UI.
2. Apontar o user para este arquivo (ou regenerar se o código mudou muito).
3. HANDOFF: `Next = user cola prompt no GLM 5.2 MAX` · notes `prompted-glm`.
4. Quando o user disser que GLM fechou: só **VERIFY** (build + workbench) se pedido.

## Alternativas free de model no app (irrelevante p/ este job)
- default: `deepseek/deepseek-v4-flash`
- free: `nvidia/nemotron-nano-9b-v2:free`
