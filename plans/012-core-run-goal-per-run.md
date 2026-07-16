# Plan 012: Escrever goal por run (fim da race em `.run-goal.txt`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/engine.mjs maestro/server.mjs maestro/test/`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Todas as pipelines concorrentes gravam o mesmo `maestro/.run-goal.txt`. Com N
apps no manager, o arquivo reflete o job aleatório que escreveu por último —
debug, memory tests e qualquer leitor externo veem o prompt errado.

## Current state

- `maestro/engine.mjs` ~1152-1157: cria `runDir` e ainda faz
  `writePrivateFile(path.join(root, "maestro", ".run-goal.txt"), prompt)`.
- `maestro/server.mjs:287`: ad-hoc `/api/run` usa o mesmo path fixo.
- Testes: `memory-engine.test.mjs` lê `.run-goal.txt`; `security-boundaries.test.mjs`
  asserta o pattern — **atualizar** esses testes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes afetados | `node --test maestro/test/memory-engine.test.mjs maestro/test/security-boundaries.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/engine.mjs`
- `maestro/server.mjs` (path por pid/timestamp se não houver runId)
- `maestro/test/memory-engine.test.mjs`
- `maestro/test/security-boundaries.test.mjs`

**Out of scope**:
- UI que mostre o goal file
- Remover writePrivateFile em geral

## Git workflow

- Branch: `advisor/012-run-goal-per-run`
- Commit: `fix(maestro): goal file por runId`

## Steps

### Step 1: engine

Onde já existe `runDir` para o job:
```js
writePrivateFile(path.join(runDir, "goal.txt"), prompt);
```
Opcional: manter symlink/cópia legada **não** — preferir só per-run.
Se algo externo depender do path fixo, escrever **também** no fixo é pior
(race). Só per-run.

### Step 2: server `/api/run`

Path: `path.join(__dirname, "runs", `adhoc-${Date.now()}`, "goal.txt")` ou
`maestro/.run-goals/<ts>.txt` com mkdir.

### Step 3: testes

- memory-engine: ler `goal.txt` do runDir criado (inspecionar como o teste
  monta root/engine).
- security-boundaries: assertar `goal.txt` no run dir **ou** que
  writePrivateFile é usado no path do run (não exigir o filename legado).

**Verify**: testes + `npm test`.

## Done criteria

- [ ] Nenhum write em `maestro/.run-goal.txt` no engine (grep zero)
- [ ] Testes atualizados passam
- [ ] `plans/README.md` DONE

## STOP conditions

- Ferramenta externa documentada no README depende de `.run-goal.txt` — se
  `rg "\.run-goal" README.md docs` achar contrato, STOP e reporte.

## Maintenance notes

- Reviewer: grep residual `.run-goal.txt`.
