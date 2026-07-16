# Plan 007: Corrigir prompts de job de `@anime-forge` / `C:\Dev\anime-forge` para `@forge` / `C:\Dev\forge`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- docs/prompts/`
> Se mudou, re-leia os arquivos listados em Scope antes de editar.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Os templates em `docs/prompts/` são o **contrato** colado no agente a cada job.
Vários ainda mandam `Repo: C:\Dev\anime-forge` e `npm run build -w @anime-forge/<id>`,
enquanto o monorepo real usa `C:\Dev\forge` e namespace `@forge` (profiles,
`package.json` workspaces, verify da engine). Isso faz B1/B4 falharem VERIFY ou
criarem packages com nome errado. Docs ativamente errados > docs ausentes.

## Current state

Verificado em `895cc63` (grep em `docs/prompts/`):

| Arquivo | Problema |
|---|---|
| `L1-B1-scaffold.md` | `C:\Dev\anime-forge`, `@anime-forge/<id>` |
| `L1-B4-wire-api.md` | repo path + `@anime-forge/ai` / credits |
| `L1-B2-personas.md`, `L1-B3-ui-polish.md`, `L1-B3-TEMPLATE.md`, `L1-B5-ship-check.md` | `Repo: C:\Dev\anime-forge` |
| `L0-NOVA-IDEIA.md`, `L0-P1-content-hooks.md`, `L0-P4-measure-kill.md` | repo path |
| `FEEDBACK-ITERATE.md` | repo + `@anime-forge/<<<id>>>` |
| `L2-handoff.md` | repo path |
| `NOVO-APP.md` | path + `@anime-forge` em vários itens |

Verdade do runtime:
- `profiles/*/profile.md` → `"namespace": "@forge"`
- packages → `@forge/ai`, `@forge/credits`, etc.
- engine verify → `npm run build -w ${profile.namespace}/${appId}`
- `L1-B3-ui-implement.md` já usa placeholders corretos em parte — use como referência de tom.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Achar resíduos | `rg "anime-forge" docs/prompts` | zero matches (ou só histórico em comentário proibido — preferir zero) |
| Achar scope errado | `rg "@anime-forge" docs/prompts` | zero matches |

## Scope

**In scope**:
- Todos os `docs/prompts/*.md` que contêm `anime-forge` ou `@anime-forge`
- Opcional se ainda errado: `docs/AGENT-PIPELINE.md` linha com path antigo (grep)

**Out of scope**:
- `docs/optimization/*` (histórico de auditoria)
- `plans/*` históricos
- Código da engine

## Git workflow

- Branch: `advisor/007-docs-prompts-namespace`
- Commit: `docs(prompts): alinhar namespace @forge e path C:\Dev\forge`

## Steps

### Step 1: Substituições mecânicas

Em todos os arquivos in-scope:

1. `C:\Dev\anime-forge` → `C:\Dev\forge`
2. `@anime-forge/` → `@forge/`
3. `@anime-forge` (sem slash residual) → `@forge`
4. Texto "anime-forge" como nome de pasta do monorepo → `forge`

Não alterar:
- URLs live legítimas tipo `gbbragadev.github.io/anime-forge/` se aparecerem como
  **exemplo de app publicado** (não como repo de trabalho). Se a linha for "Repo:",
  sempre `C:\Dev\forge`.

### Step 2: Verificar B1 e B4 manualmente

Abrir `L1-B1-scaffold.md` e `L1-B4-wire-api.md` e confirmar:
- VERIFY usa `@forge/<id>`
- packages `@forge/ai` e `@forge/credits`

**Verify**:
```
rg "anime-forge|@anime-forge" docs/prompts
```
→ no matches (ideal). Se sobrar só URL `github.io/anime-forge`, ok e documente no commit.

### Step 3: (Opcional) AGENT-PIPELINE path

Se `docs/AGENT-PIPELINE.md` ainda tiver `C:\Dev\anime-forge`, corrigir na mesma PR.

## Test plan

- Sem testes de código. Gate = grep zero em docs/prompts para o namespace errado.

## Done criteria

- [ ] `rg "@anime-forge" docs/prompts` → 0
- [ ] `rg "C:\\\\Dev\\\\anime-forge" docs/prompts` → 0
- [ ] `plans/README.md` status DONE

## STOP conditions

- Um prompt usa deliberadamente "anime-forge" como **nome de app de exemplo** e
  a substituição cega quebraria o sentido — pare e reporte o arquivo/linha.

## Maintenance notes

- Novos prompts devem copiar `L1-B3-ui-implement.md` / profile.namespace.
- Reviewer: diff só em docs/prompts.
