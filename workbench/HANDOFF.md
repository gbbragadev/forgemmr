# HANDOFF

## Loop ativo
**Standby entre produtos** — anime-quiz **shipped**; harness estável; **Forge Autopilot PRONTO**
— próxima aposta = `forge new "<ideia>"` (pipeline automática, você só decide gates)

## Last agent
claude (Fable) | 2026-07-10

## Handoff canônico (ideia + o que foi feito)
**Ler primeiro:** `docs/HANDOFF-SESSAO.md` · **Autopilot:** `docs/MAESTRO.md` § Forge Autopilot

## Last iteration — FORGE AUTOPILOT (2026-07-10)
- **Motor**: `maestro/engine.mjs` — pipeline ideia→P0→gate→P1→B1..B5→gate→ship com git
  checkpoints/rollback, retry ≤3, L2 automático em rate-limit (cooldown+fallback do team)
- **CLI**: `npm run forge -- new "<ideia>" --team grok-glm-front` → TUI full-screen
  (gates com teclas g/k/r/f); `forge decide|status|attach|stop|resume|roster`
- **Teams**: grok-solo · grok-glm-front (GLM headless no B3 — fim do copiar prompt) ·
  quality (Opus+Codex review) · dry-run
- **Fix histórico**: Grok headless = `grok -p` (posicional abria TUI → hang/ANSI). Smokes
  reais PASS: GLM-FORGE-OK, GROK-ADAPTER-OK. Dry-run E2E 2× PASS.
- **Deploy**: cf-pages → `<app>.gbbragadev.com` implementado; ⚠ CLOUDFLARE_API_TOKEN é
  read-only → gate entrega 3 passos p/ trocar por token com Pages:Edit + DNS:Edit

## Done (produto)
| App | Status |
|-----|--------|
| **waifu-chat** | MVP + smoke OpenRouter + UI B3 GLM |
| **anime-quiz** | P0→B5 + **live** https://gbbragadev.github.io/anime-forge/ |

## Done (harness)
- Loops L0/L1/L2 multi-sub (Claude/Codex/Grok/Gemini + GLM B3)
- workbench QUEUE/HANDOFF/CLAIMS
- Guia visual, PLAYBOOK, ship matrix, content-first gates
- OpenRouter: `OPEN_ROUTER_API_KEY` env sistema (não pedir no chat)

## Next
1. **E2E real do autopilot**: `npm run forge -- new "<ideia nova>" --team grok-glm-front`
   e decidir os 3 gates (P0 GO/KILL · visual pós-B3 · deploy)
2. **Humano P4** anime-quiz: hooks + bio → URL Pages (5–7d) — `docs/content-hooks-anime-quiz.md`
3. **Token Cloudflare**: trocar p/ Pages:Edit + DNS:Edit → deploy automático em
   `<app>.gbbragadev.com` (sem isso, gate de deploy dá passos manuais)

## Blockers
- P4 measure = humano
- Deploy automático cf-pages = token CF read-only (3 passos no gate)
- Vercel server deploy = token

## Links
- Handoff sessão: `docs/HANDOFF-SESSAO.md`
- Quiz: https://gbbragadev.github.io/anime-forge/
- Repo: https://github.com/gbbragadev/anime-forge
- Pipeline: `docs/AGENT-PIPELINE.md`
- Trocar ideia: `docs/PLAYBOOK.md` + `docs/prompts/L0-NOVA-IDEIA.md`

