# Anime Forge (Claude Code)

> Claude Code · Codex · Grok · Gemini — mesmo contrato.

## Instructions

**Primary: `AGENTS.md`** (loops L0 / L1 / L2).

Sempre:

1. `workbench/HANDOFF.md` + `QUEUE.md`
2. Claim em `CLAIMS.md`
3. Uma iteração do loop ativo
4. Atualizar handoff ao sair

## Platform

| Platform | Config | Skill |
|----------|--------|-------|
| Claude Code | CLAUDE.md → AGENTS.md | `/ship-niche-app` |
| Codex | AGENTS.md | `$ship-niche-app` |
| Grok | AGENTS.md | `docs/prompts/` |
| Gemini | GEMINI.md → AGENTS.md | app / CLI + `docs/prompts/` |

## Loops (resumo)

- **L0** product: score → content → build → ship → measure → kill|scale  
- **L1** build: claim → implement|**prompt GLM (B3)** → verify → fix  
- **L2** handoff: rate-limit → outro agente via HANDOFF  

Full: `docs/AGENT-PIPELINE.md` · B3 template: `docs/prompts/L1-B3-TEMPLATE.md`

## Commands

```bash
cd C:\Dev\forge
npm install
npm run dev        # waifu-chat
npm run dev:quiz   # anime-quiz
npm run build
npm run build:quiz
```
