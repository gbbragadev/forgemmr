# Plan 002: Testar a lógica de créditos (@forge/credits) e ligar coverage nativo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ab9f479..HEAD -- packages/credits/ package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ab9f479`, 2026-07-16

## Why this matters

`@forge/credits` é a lógica de **dinheiro** dos apps: quota grátis diária, moedas
pagas e assinatura semanal, gateando chamadas pagas de IA. Está ligada em produção
(doki-call e waifu-chat importam em `src/app/api/credits/route.ts` e
`src/lib/credits-cookie.ts`) e tem **zero testes**. Bugs aqui cobram usuário errado
ou dão crédito grátis infinito. O pacote é puro (funções sem I/O), então testá-lo é
barato e de altíssimo valor. De quebra, este plano liga o coverage **nativo** do
node:test (`--experimental-test-coverage`) — zero dependência nova.

## Current state

- `packages/credits/src/index.ts` (103 linhas) — todo o pacote. Funções exportadas:
  `todayKey`, `createInitialState`, `normalizeDay`, `hasActiveWeekly`,
  `checkCredits`, `consumeCredit`, `freeRemaining`. Excerto real (hierarquia de
  fontes de crédito):
  ```ts
  export function checkCredits(state: CreditState, now = new Date()): CreditCheck {
    const s = normalizeDay(state, now);
    if (hasActiveWeekly(s, now)) {
      return { ok: true, remaining: 999, source: "weekly" };
    }
    const freeLeft = Math.max(0, s.freePerDay - s.used);
    if (freeLeft > 0) {
      return { ok: true, remaining: freeLeft, source: "free" };
    }
    if (s.coins > 0) {
      return { ok: true, remaining: s.coins, source: "coins" };
    }
    return { ok: false, reason: "no_credits", remaining: 0 };
  }
  ```
  E o boundary da semanal (estritamente `>`, expiração exata = inativa):
  ```ts
  export function hasActiveWeekly(state: CreditState, now = new Date()): boolean {
    if (!state.weeklyUntil) return false;
    return new Date(state.weeklyUntil).getTime() > now.getTime();
  }
  ```
- `packages/credits/package.json` — `"main": "./src/index.ts"` (TS direto, sem build),
  só script `typecheck`. Não existe pasta `test/`.
- Root `package.json:24` — script de teste atual:
  ```json
  "test": "node --test --test-concurrency=2 maestro/test/*.test.mjs"
  ```
- Node local: v24.14.0; CI (`.github/workflows/test.yml`): Node 24. Node ≥23.6 faz
  **type stripping por default** — um `.test.mjs` pode importar `../src/index.ts`
  diretamente (o index.ts usa só sintaxe apagável: types, sem enums).
- Convenções de teste do repo: `node:test` + `assert/strict`, nomes de teste em
  pt-BR descritivo. Exemplar: `maestro/test/p4-result.test.mjs` (testes puros de
  validação, sem I/O).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar deps | `npm install` | exit 0 |
| Testes (tudo) | `npm test` | `fail 0`; contagem sobe de 204 para 204+N |
| Só credits | `node --test packages/credits/test/` | todos passam |
| Coverage | `npm run test:coverage` | tabela de coverage impressa, exit 0 |
| Typecheck | `npm run typecheck --workspaces --if-present` | exit 0 |

## Scope

**In scope**:
- `packages/credits/test/index.test.mjs` (criar)
- `package.json` (raiz — só os scripts `test` e novo `test:coverage`)

**Out of scope** (NÃO tocar):
- `packages/credits/src/index.ts` — se um teste revelar comportamento estranho,
  é achado, não licença para mudar a lógica de dinheiro. Reporte (STOP).
- As rotas dos apps que consomem o pacote (`apps/*/src/app/api/credits/`).
- Qualquer arquivo em `maestro/`.

## Git workflow

- Branch: `advisor/002-credits-tests`
- Commit: `test(credits): cobre quota diária, moedas e semanal + coverage nativo`
- NÃO fazer push nem abrir PR.

## Steps

### Step 1: Criar `packages/credits/test/index.test.mjs`

Usar `node:test` + `assert/strict`, importando `import { ... } from "../src/index.ts"`
(extensão `.ts` explícita — type stripping do Node 24 resolve). Datas SEMPRE
injetadas via parâmetro `now` (as funções aceitam `now`/`date` — nunca depender do
relógio real). Casos mínimos (um `test()` por bullet, nomes em pt-BR):

1. `todayKey` — retorna `YYYY-MM-DD` do dia UTC da data injetada.
2. `createInitialState` — `used=0`, `coins=0`, `weeklyUntil=null`, `day` = hoje.
3. `normalizeDay` — mesmo dia: retorna o MESMO objeto (identidade); dia diferente:
   zera `used`, atualiza `day`, preserva `coins`/`weeklyUntil`.
4. `hasActiveWeekly` — `null`/ausente → false; futuro → true; passado → false;
   **expiração exatamente igual a `now` → false** (comparação estrita `>`).
5. `checkCredits` hierarquia — semanal ativa vence mesmo com free esgotado
   (`remaining: 999, source: "weekly"`); sem semanal e free disponível →
   `source: "free"` com remaining correto; free esgotado e `coins > 0` →
   `source: "coins"`; tudo esgotado → `{ ok: false, reason: "no_credits" }`.
6. `checkCredits` com rollover — estado de ontem com `used = freePerDay` volta a
   ter free hoje (normalizeDay interno).
7. `consumeCredit` — free: incrementa `used` e remaining cai 1; coins: decrementa
   `coins`; semanal: **não** muta nada (mesmo used/coins); sem créditos: retorna
   `check.ok === false` e estado inalterado; imutabilidade: o estado de entrada
   nunca é mutado (compare com cópia).
8. `freeRemaining` — com semanal → 999; sem → `freePerDay - used`, nunca negativo.

**Verify**: `node --test packages/credits/test/` → todos passam (≥12 asserts no total).

### Step 2: Integrar ao `npm test` e criar `test:coverage`

No `package.json` raiz:
```json
"test": "node --test --test-concurrency=2 maestro/test/*.test.mjs packages/credits/test/*.test.mjs",
"test:coverage": "node --test --test-concurrency=2 --experimental-test-coverage maestro/test/*.test.mjs packages/credits/test/*.test.mjs",
```

**Verify**: `npm test` → `fail 0`, contagem total > 204;
`npm run test:coverage` → imprime tabela de coverage e exit 0.

## Test plan

Este plano É o test plan (Step 1). Padrão estrutural:
`maestro/test/p4-result.test.mjs`. Verificação final: `npm test` completo
(inclui a suíte do maestro — garante que a mudança de glob não quebrou nada).

## Done criteria

- [ ] `packages/credits/test/index.test.mjs` existe e cobre os 8 grupos de casos
- [ ] `npm test` → `fail 0` e contagem total > 204
- [ ] `npm run test:coverage` → exit 0 com relatório; `index.ts` do credits aparece
      com coverage de linhas > 90%
- [ ] `npm run typecheck --workspaces --if-present` → exit 0
- [ ] `git status`: só os 2 arquivos in-scope alterados/criados

## STOP conditions

- O import de `../src/index.ts` falhar no `node --test` (indicaria Node < 23.6 ou
  sintaxe não-apagável no index.ts) — reporte a versão de node e o erro exato.
- Um teste revelar comportamento que parece bug na lógica de créditos (ex.:
  `consumeCredit` mutando o estado de entrada, remaining negativo) — NÃO conserte
  o src; reporte o caso como achado.
- O glob novo no script `test` não expandir no Windows — reporte o erro em vez de
  trocar por shell glob.
- Excertos de "Current state" não baterem com o código atual.

## Maintenance notes

- Quando o billing real (Stripe/Pix) chegar (roadmap README §9), estes testes são
  a rede de segurança da migração — o comportamento aqui descrito vira contrato.
- Se algum app passar a persistir créditos server-side, adicionar testes de
  concorrência (hoje o estado é cookie, single-writer).
- Revisor: conferir que os testes usam datas injetadas (zero `new Date()` sem
  argumento nos asserts críticos de boundary).
