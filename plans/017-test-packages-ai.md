# Plan 017: Testes unitários para `@forge/ai` (env + trimHistory)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- packages/ai package.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Resolução de provider/key/model (`packages/ai/src/env.ts`) e `trimHistory`
definem se o chat de produto fala com Z.AI ou OpenRouter e quanto contexto manda.
`packages/credits` tem suíte; `@forge/ai` não. `npm test` na root **não** inclui
`packages/ai`.

## Current state

- `packages/ai/src/env.ts` — `getProductAiProvider`, keys multi-alias, models
- `packages/ai/src/index.ts` — `trimHistory`, `streamProductChat` (network)
- Root `package.json` test script:
  ```
  node --test ... maestro/test/*.test.mjs packages/credits/test/*.test.mjs
  ```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes ai | `node --test packages/ai/test/*.test.mjs` | fail 0 |
| Suíte root | `npm test` | inclui ai e fail 0 |

## Scope

**In scope**:
- `packages/ai/test/env.test.mjs` (criar dir+file)
- `package.json` script `test` / `test:coverage` para incluir o glob
- Não mockar rede: **não** testar streamProductChat real

**Out of scope**:
- Integração com Next routes
- Mudar defaults de model

## Git workflow

- Branch: `advisor/017-test-ai`
- Commit: `test(ai): cobre env provider/key e trimHistory`

## Steps

### Step 1: env tests (table-driven)

Com objeto `env` injetado (funções já aceitam `env` param):

1. `PRODUCT_AI_PROVIDER=openrouter` → openrouter  
2. key só `ZAI_API_KEY` → provider auto zai  
3. key só `OPEN_ROUTER_API_KEY` → openrouter  
4. aliases `GLM_API_KEY`, `OPENROUTER_API_KEY`  
5. `getProductModel` defaults  

### Step 2: trimHistory

- 20 msgs → max 12 retorna 12 últimas non-system  
- system messages filtradas  

Import de `../src/index.ts` ou `../src/env.ts` — se TS não roda no node:test,
verificar como credits importa (provavelmente `.ts` via type module?).  
`packages/credits` é `.ts` source? Check: credits is `.ts` compiled? Looking at package — likely `"type": "module"` and node runs `.ts`? Actually credits tests import from `../src/index.ts` — check.

If node can't import TS, use the same pattern as credits package.json exports.

### Step 3: Wire npm test

```json
"test": "node --test --test-concurrency=2 maestro/test/*.test.mjs packages/credits/test/*.test.mjs packages/ai/test/*.test.mjs",
```

**Verify**: `npm test`

## Done criteria

- [ ] ≥8 asserts em packages/ai
- [ ] Root test inclui o glob
- [ ] fail 0
- [ ] `plans/README.md` DONE

## STOP conditions

- Import TS falha no node — use o padrão exato de `packages/credits/test` (ler um arquivo de lá).

## Maintenance notes

- Novos aliases de env → estender tabela.
