# Plan 018: Cachear snapshot do Control Center (menos I/O no SSE)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/control/snapshot.mjs maestro/server.mjs maestro/control-center.js maestro/test/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (beneficia de rotação de runs no futuro; não bloquear)
- **Category**: perf
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Cada tick de log no SSE (debounce 220ms) pede snapshot completo: readdir de
`maestro/runs/pipeline-*.json`, lifecycle por app, catalog, JSON.stringify +
SHA-256. Com job longo + N viewers, o event loop compete com a engine. Cache
com invalidação por versão de pipeline reduz I/O sem mudar o contrato HTTP.

## Current state

- `maestro/control/snapshot.mjs` — `buildControlSnapshot` / `loadRuns` pesado
- `maestro/server.mjs` — endpoint `/api/control/snapshot`
- `maestro/control-center.js` ~1293 — `loadSnapshot` no SSE message
- `engine` emite `emitPipeline` em todo `save()`

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes control | `node --test maestro/test/control-snapshot.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/control/snapshot.mjs` (cache)
- `maestro/server.mjs` se precisar invalidar
- `maestro/test/control-snapshot.test.mjs` (estender)

**Out of scope**:
- Reescrever control-center UI
- Prune de runs (plano 019 opcional separado — se não existir, NÃO fazer aqui)
- Batch de SSE lines

## Git workflow

- Branch: `advisor/018-snapshot-cache`
- Commit: `perf(maestro): cache do control snapshot com invalidação`

## Steps

### Step 1: Version key

Derivar chave barata:
- Para cada engine: `status + currentJob + gates length + history length + updatedAt` se existir
- mtime max de `maestro/pipelines/*.json` e/ou `runs/pipeline-*.json` (só stat, não parse)

Se chave == lastKey e cache hit age < 2s, retornar cache (deep freeze / clone).

### Step 2: Invalidação

- `save()` / emitPipeline já muda estado — próxima key difere.
- TTL máximo 2–5s mesmo se key igual (segurança).

### Step 3: Testes

- Dois builds sem mudança de disco/engine mock → segundo não chama loadRuns
  (mock/spy ou contador injetável).
- Após mudar pipeline mock → cache miss.

**Verify**: testes control-snapshot + npm test.

## Done criteria

- [ ] Snapshot repetido em <TTL sem re-parse completo (provado no teste)
- [ ] Mudança de pipeline invalida
- [ ] Suíte verde
- [ ] `plans/README.md` DONE

## STOP conditions

- Snapshot precisa de dados wall-clock (clocks) que ficariam stale — se gate
  countdown depender de now a cada ms, cache só a parte pesada (runs list).

## Maintenance notes

- Reviewer: garantir que decisão de gate aparece em ≤TTL no UI.
