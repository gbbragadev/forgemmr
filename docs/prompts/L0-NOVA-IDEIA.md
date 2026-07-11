# L0 — Setar outra ideia (app anterior terminou)

Use quando o build do app atual está **Done** (ship ok) e o user quer a próxima aposta.

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + workbench/QUEUE.md + docs/PLAYBOOK.md
(seção "Como setar outra ideia").

Loop: L0 — troca de produto

Tarefa (1 iteração — NÃO scaffold ainda):
1. Confirme que o app anterior está em Done de build (ex.: anime-quiz).
   Measure P4 humano pode permanecer no Backlog à parte — não misture com o app novo.
2. Libere CLAIMS se houver claim órfão.
3. Atualize QUEUE Backlog com:
   - [ ] **L0/P0** Scorecard: <app-id> — <frase>
4. Atualize HANDOFF:
   - Loop ativo = L0 nova ideia <app-id>
   - Next = P0 → (GO) P1 → B1 só depois
5. Rode o scorecard P0 da IDEIA abaixo (critérios PLAYBOOK).
   Salve docs/scorecard-<app-id>.md
6. Se GO: enfileire L0/P1 na QUEUE; diga o próximo prompt (L0-P1).
   Se NO-GO: explique e deixe Backlog limpo / outra ideia.
7. NÃO altere apps/ do produto anterior salvo o user pedir bugfix.
8. NÃO rode B1 nesta iteração.

IDEIA NOVA (app-id sugerido + descrição):
<<< cole aqui >>>

Fim: HANDOFF + QUEUE + claim liberado. Resuma GO/NO-GO em 5 linhas.
```

Ver também: `docs/prompts/L0-P0-scorecard.md` · `docs/PLAYBOOK.md`
