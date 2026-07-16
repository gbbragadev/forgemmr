# Plan 020: Spike — fechar loop P4/P5 com dados (design + prefills)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/control/lifecycle.mjs maestro/engine.mjs docs/prompts/L0-P4-measure-kill.md maestro/p4-result.mjs`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/019-direction-telemetry-spike.md (decisão de sink; pode rodar design em paralelo se 019 for doc-only)
- **Category**: direction
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

`finish("done")` só empilha checkbox humano L0/P4 no QUEUE (às vezes
duplicado). Control Center já tem `recordP4` / `decideP5` e `p4-result.mjs`
valida schema. Falta o **caminho de dados** da telemetria → rascunho de P4 →
gate P5. Este plano desenha e, se trivial, implementa prefills a partir de
"sem dados" honesto.

## Current state

- `maestro/engine.mjs` finish → append QUEUE P4
- `maestro/control/lifecycle.mjs` — recordP4 / decideP5
- `maestro/p4-result.mjs` — schema
- `workbench/QUEUE.md` — várias linhas P4 humanas repetidas

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes p4 | `node --test maestro/test/*p4*.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- Doc: `docs/p4-measure-loop.md` (fluxo, estados, o que é auto vs humano)
- Opcional código: dedupe de linhas P4 no QUEUE ao finish; prefill
  `apps/<id>/docs/p4-result.json` com zeros + `verdict: "insufficient_data"`
  se sem telemetria
- Testes se código

**Out of scope**:
- Auto-kill sem humano
- Scraping de analytics de terceiros
- Implementar sink (019)

## Git workflow

- Branch: `advisor/020-p4-measure-loop`
- Commit: `docs+feat(maestro): desenho loop P4 e prefill sem dados`

## Steps

### Step 1: Design doc

Estados: shipped → measuring → p4_recorded → p5_kill|scale.  
Quem escreve o quê. Como telemetria (019) alimenta campos do schema
`p4-result.mjs`.

### Step 2: Código mínimo (se barato)

- Ao `finish("done")`, se já existe item P4 para o appId no QUEUE, não
  duplicar.
- Função `draftP4Result(appId)` escreve JSON com schema válido e métricas 0
  se arquivo não existe.

### Step 3: Testes

- Dedupe QUEUE
- draft schema passa validador `p4-result.mjs`

**Verify**: npm test

## Done criteria

- [ ] Doc de loop existe
- [ ] Sem duplicar P4 no QUEUE se implementado
- [ ] Suíte verde
- [ ] `plans/README.md` DONE

## STOP conditions

- Auto-decide P5 kill — **nunca** neste plano; se tentarem, STOP.

## Maintenance notes

- Humano sempre no kill|scale até telemetria madura.
