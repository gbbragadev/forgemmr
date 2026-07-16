# Plan 013: Alinhar lint root com CI e rodar typecheck no CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- package.json .github/workflows/test.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW–MED (typecheck pode revelar erros latentes)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

CI roda `lint --workspaces` mas o script root `npm run lint` só linta
`@forge/waifu-chat`. CI **não** roda `typecheck`, embora o monorepo tenha
`npm run typecheck`. Agentes e humanos confiam no script root e no CI verde
com sinais diferentes.

## Current state

`package.json`:
```json
"lint": "npm run lint -w @forge/waifu-chat",
"typecheck": "npm run typecheck --workspaces --if-present",
```

`.github/workflows/test.yml`:
```yaml
- run: npm run lint --workspaces --if-present
- run: npm test
# sem typecheck
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint workspaces | `npm run lint --workspaces --if-present` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `package.json` scripts
- `.github/workflows/test.yml`
- Fixes **mínimos** de type error se typecheck falhar em packages/apps
  (só o necessário para exit 0)

**Out of scope**:
- ESLint monorepo novo / prettier
- Mudar node version

## Git workflow

- Branch: `advisor/013-dx-lint-typecheck`
- Commit: `ci: typecheck no workflow; lint root = workspaces`

## Steps

### Step 1: package.json

```json
"lint": "npm run lint --workspaces --if-present",
"lint:waifu": "npm run lint -w @forge/waifu-chat",
```

### Step 2: CI

Após lint, antes ou depois de test:
```yaml
- run: npm run typecheck
```

### Step 3: Rodar local

```
npm run lint
npm run typecheck
npm test
```

Se typecheck falhar: corrigir erros reais com diff mínimo; se for erro pré-existente
grande em app morto, STOP e liste os erros (não desligar typecheck).

## Done criteria

- [ ] `npm run lint` == workspaces
- [ ] CI tem step typecheck
- [ ] lint + typecheck + test exit 0 local
- [ ] `plans/README.md` DONE

## STOP conditions

- Typecheck revela >20 erros não trivialmente relacionados — reportar lista,
  não desabilitar o step.

## Maintenance notes

- Reviewer: diff de CI e package.json scripts.
