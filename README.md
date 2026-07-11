# Anime Forge

Factory de webapps nichados com IA (**Tema + IA + Frontend**).

Vertical: **anime**. Apps: **WaifuChat** (chat) · **AnimeQuiz** (quiz de arquétipo).

## Handoff (ideia + o que foi feito)

- **[`docs/HANDOFF-SESSAO.md`](docs/HANDOFF-SESSAO.md)** — estado canônico para retomar em qualquer agent  
- Workbench: [`workbench/HANDOFF.md`](workbench/HANDOFF.md)

## Guia visual (como usar corretamente)

- **Browser (recomendado):** [`docs/GUIA-VISUAL.html`](docs/GUIA-VISUAL.html)
- **Markdown:** [`docs/GUIA-VISUAL.md`](docs/GUIA-VISUAL.md)
- **Novo app com 1 prompt:** [`docs/prompts/NOVO-APP.md`](docs/prompts/NOVO-APP.md)

**Política:** agents = subscription · OpenRouter = env sistema (produto) · 1 sessão = 1 job · workbench = verdade multi-sub.

## Loops (multi-agente)

O processo é **cíclico**, não uma esteira única. Codex / Claude / Grok / **Gemini** rodam a **mesma** iteração.

```
L0 PRODUCT  score → content → build → ship → measure → kill|scale
L1 BUILD    claim → implement → verify → fix → handoff
L2 HANDOFF  rate-limit → HANDOFF.md → outro provedor → mesmo job
```

| Arquivo | Uso |
|---------|-----|
| `AGENTS.md` | contrato canônico (todos os agentes) |
| `CLAUDE.md` | shim Claude Code |
| `GEMINI.md` | shim Gemini (Google sub) |
| `docs/AGENT-PIPELINE.md` | loops + roteamento de limites |
| `docs/prompts/` | colar 1 prompt = 1 iteração |
| `workbench/` | QUEUE · HANDOFF · CLAIMS |
| `.agents/skills/ship-niche-app/` | `$` / `/ship-niche-app` |

**Frase mágica** (qualquer provedor):

```
Repo C:\Dev\anime-forge. Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md.
Rode UMA iteração do loop ativo (ou o job da QUEUE). Atualize HANDOFF/QUEUE/CLAIMS.
```

Troca de limite → cole `docs/prompts/L2-handoff.md`.

## Estrutura de código

```
apps/waifu-chat     → chat IA (OpenRouter / Z.AI)
apps/anime-quiz     → quiz arquétipo (estático, sem key no free path)
packages/ai         → streaming produto
packages/config     → defineApp (Zod) + capability quiz
packages/credits    → free/day + coins + weekly
packages/ui         → design system anime
content/personas    → packs + quiz-archetypes
content/quizzes     → bancos de perguntas
docs/PLAYBOOK.md    → L0 negócio
workbench/          → QUEUE · HANDOFF · prompts-glm
```

## Quick start

```bash
cd C:\Dev\anime-forge
npm install

# WaifuChat (IA — precisa key no Windows ou .env.local)
npm run dev          # http://localhost:3000
# GET /api/health

# AnimeQuiz (estático — sem key)
npm run dev:quiz     # http://localhost:3000 (só um app por porta)
npm run build:quiz
```

## Novo app (L1/B1)

1. Copiar `apps/waifu-chat` → `apps/<id>`
2. `app.config.ts` + personas
3. `package.json` name
4. `npm run build`

## Env (produto) — tabela canônica

| Key | Agent faz o quê? | Para quê |
|-----|------------------|----------|
| `ZAI_API_KEY` | Lê env / `.env.local` — **não pede** | Cérebro do app (Z.AI/GLM) — **default** |
| `ZAI_MODEL` | default `glm-4.5-flash` (free) | ou `glm-5.2` qualidade |
| `OPEN_ROUTER_API_KEY` | só se provider=openrouter | Fallback OpenRouter |
| `ANTHROPIC` / `OPENAI` / `GEMINI` pay-as-you-go | **Não** | Coding agent |

Docs Z.AI: https://docs.z.ai/guides/overview/quick-start

## Bernstein + Maestro HQ (opcional, visual)

Bernstein = orquestrador de CLIs. **Maestro** = cara + roster de modelos + HQ sem digitar.

| | |
|--|--|
| **HQ visual** | [`maestro/index.html`](maestro/index.html) |
| **1 clique** | [`scripts/start-maestro.ps1`](scripts/start-maestro.ps1) |
| **Modelos fixos** | [`maestro/roster.json`](maestro/roster.json) |
| Docs | [`docs/MAESTRO.md`](docs/MAESTRO.md) · [`docs/BERNSTEIN-EXPLICADO.md`](docs/BERNSTEIN-EXPLICADO.md) |

```powershell
# Preferido (abre cara + GUI de execução)
.\scripts\start-maestro.ps1

# Manual
bernstein gui serve   # http://127.0.0.1:8052/ui/
```

## Roadmap produto

- [x] Kernel + WaifuChat skeleton
- [x] Harness multi-agente em **loops**
- [x] Piloto Bernstein (thin keep)
- [ ] Billing Stripe + Pix
- [ ] Capability image / haifu
- [ ] CLI create-app
