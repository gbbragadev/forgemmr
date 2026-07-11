# Anime Forge (Gemini)

> Gemini app / Gemini CLI / Google AI — mesmo contrato multi-agente.

## Instructions

**Primary: `AGENTS.md`** (loops L0 / L1 / L2).

Sempre:

1. `workbench/HANDOFF.md` + `QUEUE.md`
2. Claim em `CLAIMS.md`
3. Uma iteração do loop ativo
4. Atualizar handoff ao sair

## Platform

| Platform | Config | Como invocar |
|----------|--------|--------------|
| Gemini (sub Google) | `GEMINI.md` → `AGENTS.md` | app Gemini, Gemini CLI, ou colar `docs/prompts/` |
| Claude Code | `CLAUDE.md` | `/ship-niche-app` |
| Codex | `AGENTS.md` | `$ship-niche-app` |
| Grok | `AGENTS.md` | `docs/prompts/` |

## Subscription only

- Use a **conta Google / Gemini Advanced / AI Pro** (subscription ou cota inclusa).
- **Não** configure `GEMINI_API_KEY` / AI Studio pay-as-you-go só para o agent codar.
- OpenRouter do **produto** (`OPEN_ROUTER_API_KEY`) é outra carteira — o app pode usar modelo Gemini no OpenRouter; isso não é o coding agent.

## Jobs onde Gemini brilha (default)

| Job | Loop | Por quê |
|-----|------|---------|
| P0 Scorecard | L0 | barato, rápido |
| P1 Content hooks | L0 | volume de copy |
| B2 Personas | L1 | texto criativo PT-BR |
| B5 Ship check | L1 | checklist |
| L2 Handoff | L2 | quando Claude/Codex/Grok limitaram |

Para B1 scaffold / B4 API pesado, preferir **Codex** se disponível; Gemini pode assumir se for o único com cota.

## Frase mágica

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md.
Rode UMA iteração. Claim + HANDOFF no fim.
Ler OPEN_ROUTER_API_KEY da env do sistema — não pedir no chat.
```

## Commands (local)

```bash
cd C:\Dev\anime-forge
npm install
npm run dev
npm run build
# health: http://localhost:3000/api/health
```
