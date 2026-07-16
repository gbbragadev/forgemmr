# Plan 014: Remover sleep fixo de 800ms do fake-exec

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/fake-exec.mjs maestro/test/`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Cada job dry-run/fake espera 800ms sem benefício de correção. Pipelines E2E de
teste com dezenas de jobs multiplicam dezenas de segundos na suíte.

## Current state

`maestro/fake-exec.mjs` ~55:
```js
await sleep(800);
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Subconjunto rápido | `node --test maestro/test/control-mode.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 (idealmente mais rápida) |

## Scope

**In scope**:
- `maestro/fake-exec.mjs`
- Testes se hardcoded 800

**Out of scope**:
- Timeouts reais de executor

## Git workflow

- Branch: `advisor/014-fake-exec-delay`
- Commit: `perf(test): fake-exec delay configurável default 0`

## Steps

### Step 1

```js
const delayMs = Number(process.env.FORGE_FAKE_DELAY_MS ?? 0);
if (Number.isFinite(delayMs) && delayMs > 0) await sleep(delayMs);
```

Documentar em comentário de 1 linha no topo do fake-exec.

### Step 2

Rodar um teste multi-job e a suíte.

**Verify**: `npm test` fail 0.

## Done criteria

- [ ] Default delay 0
- [ ] Env opt-in
- [ ] Suíte verde
- [ ] `plans/README.md` DONE

## STOP conditions

- Teste flaky depende do 800ms (raro) — se falhar timing, use delay 50 no teste
  específico via env, não no default global.

## Maintenance notes

- Reviewer: default deve ser 0.
