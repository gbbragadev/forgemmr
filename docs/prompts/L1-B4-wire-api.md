# L1 / B4 — Wire AI / API / credits (1 iteração)

```
Repo: C:\Dev\forge
Loop: L1 · Job: B4 Wire API
Claim: app routes + packages/ai|credits se necessário.

Tarefa:
Garantir chat (ou capability do job) via OpenRouter no server,
free quota, paywall 402, sem vazar API key.
Usar @forge/ai e @forge/credits.
VERIFY: build; GET /api/health (lê OPEN_ROUTER_API_KEY do sistema sozinho); 1 smoke stream se ok.

Não fazer billing Stripe nesta iteração salvo job explícito.
**Não peça a key no chat** — o app/agent leem a env do Windows.
Se health falhar: HANDOFF pedindo setar OPEN_ROUTER_API_KEY no sistema (sem colar secret).
Nunca pedir keys de coding agent.
App: <<< >>>
Fim: HANDOFF (incluir se smoke real passou) + QUEUE + claim.
```
