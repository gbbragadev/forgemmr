# Plan 016: Testes de caracterização para `workbench.mjs`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/workbench.mjs maestro/test/`

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

QUEUE/CLAIMS/HANDOFF são o contrato L2 humano↔agente. `workbench.mjs` faz
read-modify-write best-effort e **não tem testes**. Regressões só aparecem
quando o dono não consegue retomar. Characterization trava o comportamento
antes de qualquer lock futuro.

## Current state

Exports em `maestro/workbench.mjs`:
- `queueStart`, `queueDone`, `claimSet`, `claimFree`, `handoffUpdate`, `purgeApp`
- `write` sincroniza com colapso de newlines
- Erros engolidos em `catch`

Engine chama em dezenas de sites; não precisa mockar engine — teste unitário
com tmpdir e fixtures de markdown mínimos.

Padrão de teste: `maestro/test/*.test.mjs` com `node:test` + `node:assert/strict`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Novo arquivo | `node --test maestro/test/workbench.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/test/workbench.test.mjs` (criar)
- `maestro/workbench.mjs` **só** se bug óbvio bloquear teste (mínimo)

**Out of scope**:
- File locking / mutex (dívida separada; pode ser follow-up)
- Reescrever QUEUE.md real do repo

## Git workflow

- Branch: `advisor/016-test-workbench`
- Commit: `test(maestro): caracteriza workbench QUEUE/CLAIMS/HANDOFF`

## Steps

### Step 1: Fixture

tmpdir com:
```
workbench/QUEUE.md  — headings ## Doing / ## Done / ## Backlog
workbench/CLAIMS.md — tabela com row livre `| — | — | ... | livre |`
workbench/HANDOFF.md — esqueleto mínimo
```

`paths = { root: tmp }`

### Step 2: Casos

1. `queueStart` adiciona linha em Doing  
2. `queueDone` remove Doing e adiciona Done com player  
3. `claimSet` substitui FREE_ROW  
4. `claimFree` limpa claim do appId  
5. Dois `queueStart` sequenciais de apps diferentes — ambas linhas presentes  
6. `purgeApp` (ler implementação) remove rastro do app  

### Step 3

**Verify**: `node --test maestro/test/workbench.test.mjs` · `npm test`

## Done criteria

- [ ] Arquivo de teste existe com ≥5 asserts
- [ ] Suíte verde
- [ ] `plans/README.md` DONE

## STOP conditions

- Formato real de CLAIMS.md no repo divergiu do FREE_ROW no código — alinhar
  fixture ao código atual, não "corrigir" o markdown de produção.

## Maintenance notes

- Lock futuro deve manter estes testes verdes.
