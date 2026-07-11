# Handoff — Anime Forge (ideia + o que foi feito)

**Data:** 2026-07-10  
**Repo:** `C:\Dev\anime-forge` · https://github.com/gbbragadev/anime-forge  
**Para:** qualquer agent (Claude / Codex / Grok / Gemini) ou humano retomando

---

## 1. Ideia original (por quê existe)

**Problema:** cada webapp nichado com IA (chat, foto, quiz…) virava semanas de boilerplate (auth, UI, créditos, deploy) e o usuário tem **várias subscriptions** (Claude, Codex, Grok, Gemini) que não se conversam.

**Solução:** factory **Anime Forge**

```
App = Tema nichado + Capability IA + Frontend + Monetização
```

- Vertical primeiro: **anime** (fit com conta IG orgânica de anime do primo ~15k — **não** pivotar a conta)
- Runtime de produto: OpenRouter / ZAI no **app** (env do sistema) — **não** é o motor do coding agent
- Coding agents: **só subscription** — estado no `workbench/`, troca de sub via L2 HANDOFF
- Loops: **L0** product · **L1** build · **L2** handoff multi-provedor

**Catálogo de ideias (ordem mental):**

| # | App | Capability | Status |
|---|-----|------------|--------|
| 1 | WaifuChat | chat + personas + free quota | MVP + smoke |
| 2 | AnimeQuiz | quiz estático shareable | **Shipped** GH Pages |
| 3 | Anime Me / haifu | image | só ideia — precisa P0 |
| 4 | Polaroid / photocard | image | ideia |
| 5 | Fanfic | chat long | ideia |

Conversa de origem (negócio/viral): web apps nichados + ads/coins + distribuição; K-pop saturado → foco anime com perfil do primo.

---

## 2. O que foi feito (produto)

### 2.1 Monorepo / kernel

- npm workspaces: `apps/*` + `packages/*`
- `packages/config` — `defineApp` + Zod
- `packages/ai` — OpenRouter (e resolução de env); chat streaming
- `packages/credits` — free/day, coins, weekly
- `packages/ui` — design system anime (cards, chat, paywall)
- `content/personas` — packs reutilizáveis

### 2.2 WaifuChat (`apps/waifu-chat`)

- Landing + grid de personas + chat streaming
- Free quota (cookie) + paywall mock
- API: `/api/chat`, `/api/credits`, `/api/health`
- Key de produto: **`OPEN_ROUTER_API_KEY` (Windows) → `OPENROUTER_API_KEY` (.env.local)** — agent **lê, não pede**
- Smoke OpenRouter ok (sessão anterior)
- UI polish via GLM (B3)

### 2.3 AnimeQuiz (`apps/anime-quiz`)

- L0/P0 scorecard GO → P1 hooks → B1 scaffold → B3 theme GLM → B5
- **Live:** https://gbbragadev.github.io/anime-forge/
- Path de ship: static export → **GitHub Pages**
- Hooks: `docs/content-hooks-anime-quiz.md`
- Scorecard: `docs/scorecard-anime-quiz.md`
- **P4 measure = humano** (postar + bio + 5–7 dias) — ainda na QUEUE

---

## 3. O que foi feito (harness multi-agente)

### 3.1 Contrato e loops

| Arquivo | Função |
|---------|--------|
| `AGENTS.md` | Contrato único todos os agents |
| `CLAUDE.md` / `GEMINI.md` | Shims de plataforma |
| `docs/AGENT-PIPELINE.md` | L0/L1/L2, gates, ship matrix, lições |
| `docs/PLAYBOOK.md` | Negócio + **§ Como setar outra ideia** |
| `docs/GUIA-VISUAL.html` | Guia visual (browser) |
| `workbench/QUEUE.md` · `HANDOFF.md` · `CLAIMS.md` | Estado multi-sub |
| `.agents/skills/ship-niche-app/` | Skill 1 iteração |

### 3.2 Motores (subscription only)

Claude Code · Codex · Grok · **Gemini** · GLM (B3 visual via prompt denso)

**Proibido como coding agent:** `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` paygo / OpenRouter “pensando pelo agent”.

### 3.3 Prompts por loop

- `docs/prompts/L0-P0-scorecard.md`, `L0-P1`, `L0-P4`
- **`docs/prompts/L0-NOVA-IDEIA.md`** — trocar de produto após Done
- `L1-B1` … `B5`, `L1-B3-TEMPLATE.md` (GLM)
- `NOVO-APP.md` — scaffold chat clone (após GO / decisão)
- `L2-handoff.md`

### 3.4 Lições de produção (não esquecer)

1. **B1** = funcional (visual seco ~4/10 OK)  
2. **B3** = prompt GLM **denso** (~7.5/10), não one-liner  
3. Content-first: **P0 → P1** antes de B1 (exceto “pode decidir e seguir”)  
4. Ship: static → GH Pages · server → Vercel + token  
5. Porta :3001 Docker ≠ Next  
6. Uma sessão = 1 job (ou chain com gates explícitos)

### 3.5 Esta rodada (handoff “outra ideia” docs)

- Seção **Como setar outra ideia** no PLAYBOOK + pipeline + guia visual  
- Prompt `L0-NOVA-IDEIA.md`  
- Atalhos em AGENTS + skill (`outra ideia` / `próximo app`)  
- QUEUE com placeholder P0 da próxima ideia  

---

## 4. Estado agora

| Item | Estado |
|------|--------|
| Loop ativo | Meta/harness estável; produtos: quiz shipped, chat MVP |
| Claims | Livres |
| Build quiz | **Done** + URL Pages |
| Measure quiz | **Pendente humano** (P4) |
| Próximo produto | **Não escolhido** — placeholder `L0/P0` na QUEUE |
| Deploy waifu-chat Vercel | Opcional, precisa token |
| Git | Há mudanças locais uncommitted (docs/harness/maestro) — ver `git status` |

---

## 5. Próximos passos (ordem sugerida)

### A) Humano (quiz)

1. Postar hooks de `docs/content-hooks-anime-quiz.md`  
2. Bio → https://gbbragadev.github.io/anime-forge/  
3. 5–7 dias → `docs/prompts/L0-P4-measure-kill.md` (KILL / ITERATE / SCALE)

### B) Próxima ideia de app

1. Colar ideia em `docs/prompts/L0-NOVA-IDEIA.md` **ou**  
2. Preencher QUEUE: `L0/P0 Scorecard: <id> — <frase>`  
3. Scorecard → se GO: P1 hooks → B1 (não pular P0)

### C) Opcional infra

- Commit/push docs se quiser versionar o harness  
- Vercel + env para waifu-chat se for hostear chat  
- Maestro polish: ver `docs/HANDOFF-MAESTRO-NEXT.md` (trilha separada)

---

## 6. Frases mágicas

### Continuar o harness / próximo job

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md.
Rode UMA iteração do job livre. Atualize HANDOFF/QUEUE/CLAIMS.
Subscription only. OPEN_ROUTER_API_KEY = env sistema (não pedir).
```

### Setar outra ideia

```
Repo: C:\Dev\anime-forge
Leia docs/PLAYBOOK.md (Como setar outra ideia) + docs/prompts/L0-NOVA-IDEIA.md.
Anime-quiz FECHADO em build (só P4 measure humano à parte).
Rode L0/P0 da ideia nova. Atualize HANDOFF + QUEUE.
IDEIA NOVA: <<< >>>
```

---

## 7. Mapa rápido de arquivos

```
C:\Dev\anime-forge\
  AGENTS.md, CLAUDE.md, GEMINI.md
  apps/waifu-chat, apps/anime-quiz
  packages/{ai,config,credits,ui}
  content/personas/
  docs/
    HANDOFF-SESSAO.md     ← este arquivo
    PLAYBOOK.md           ← negócio + trocar ideia
    AGENT-PIPELINE.md     ← loops
    GUIA-VISUAL.html      ← abrir no browser
    prompts/L0-NOVA-IDEIA.md
  workbench/QUEUE.md, HANDOFF.md, CLAIMS.md
  .agents/skills/ship-niche-app/
```

---

## 8. Recap em 5 linhas

1. **Ideia:** factory de webapps anime (Tema+IA+Front) + pipeline multi-sub em loops.  
2. **Entregue:** monorepo, WaifuChat MVP, AnimeQuiz live na Pages, harness completo.  
3. **Política:** agent = sub; OpenRouter/ZAI = produto via env (sem pedir key no chat).  
4. **Agora:** measure quiz (humano) **ou** P0 da próxima ideia.  
5. **Não fazer:** reescrever o quiz como “próximo app”; abrir L0 novo com L1 vermelho; B1 sem P0.
