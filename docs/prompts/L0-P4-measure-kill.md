# L0 / P4–P5 — Measure → Kill|Scale (1 iteração)

```
Repo: C:\Dev\anime-forge
Leia HANDOFF + PLAYBOOK.
Loop: L0 · Steps P4 Measure + P5 Kill|Scale
Sem código salvo se for só decisão.

Dados (cole o que tiver):
- dias no ar / views / cliques bio / gerações / custo API / receita
- app id:

Saída:
1. Verdict: KILL | ITERATE (mais L1) | SCALE
2. 3 evidências
3. Se ITERATE/SCALE: jobs concretos para a QUEUE (L1/Bx ou L0)
4. Salve também `apps/<app-id>/docs/p4-result.json` neste schema fixo:
   `{ "appId": "...", "measuredAt": "YYYY-MM-DD", "daysLive": 0, "visits": 0, "activations": 0, "ctaClicks": 0, "conversions": 0, "revenueBrl": 0, "apiCostBrl": 0, "verdict": "kill|iterate|scale", "why": "uma frase", "channel": "origem do tráfego" }`
5. Não invente métricas: se um número não foi medido, registre 0 e explique em `why`.
6. Atualize QUEUE + HANDOFF
```
