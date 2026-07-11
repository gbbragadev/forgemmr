# L1 / B5 — Ship check (1 iteração)

```
Repo: C:\Dev\anime-forge
Loop: L1 · Job: B5 Ship check
App: <<< waifu-chat | anime-quiz | … >>>
Claim curto.

Checklist (marque PASS / FAIL / N-A com razão):

Build
- [ ] npm run build  (chat)  OU  npm run build:quiz  (static)
- [ ] Typecheck implícito no next build

Produto / legal
- [ ] disclaimer legal na UI
- [ ] .env.example documenta vars relevantes
- [ ] free quota 402/paywall se app TEM créditos; senão N-A (quiz estático)

API (só se capability chat)
- [ ] GET /api/health — key lida da env (NÃO pedir no chat)
- [ ] 1 msg stream se health.ok; senão HANDOFF “setar key no Windows”

Static / quiz
- [ ] score/fluxo core smoke (JSON válido + winner coerente se aplicável)
- [ ] N-A health/key se free path sem AI

Ship readiness
- [ ] HANDOFF Next: P3 deploy path OU P4 measure se já tem URL
- [ ] Porta dev documentada (evitar confusão Docker :3001)

Corrija só quebras reais (ponytail).
Reporte tabela PASS/FAIL/N-A.
Fim: HANDOFF + QUEUE + claim.
```
