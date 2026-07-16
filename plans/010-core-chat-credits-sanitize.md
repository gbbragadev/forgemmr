# Plan 010: Chat apps — crédito pós-sucesso, sanitize de messages, zero paid fields no cookie

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- apps/waifu-chat apps/doki-call apps/pmoc-acceptance-gate packages/credits packages/ai`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (cookie semantics)
- **Depends on**: none
- **Category**: bug | security
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Três bugs no caminho de dinheiro/custo da API:

1. **waifu-chat** chama `consumeCredit` **antes** da IA; falha de provider queima
   cota free. doki/pmoc queimam depois do sucesso.
2. **waifu/doki** aceitam `messages` sem cap; pmoc tem `MAX_MSG=16` /
   `MAX_CONTENT=2000` — sem cap = DoS de custo no provider.
3. Cookie JSON **unsigned** honra `coins` e `weeklyUntil` do cliente → forja
   cota "paga" e gasta key real. Até haver billing/HMAC (plano 011), o server
   deve **ignorar** campos pagos e só confiar em `used`/`day` com clamp.

## Current state

**waifu-chat** `src/app/api/chat/route.ts:50-67` — consume antes do try/AI.

**doki-call** `src/app/api/chat/route.ts:122-125` — consume após reply OK
(comentário "only after a successful AI reply").

**pmoc** `src/app/api/chat/route.ts:40-74` — `sanitizeMessages` / caps.

**credits-cookie** (waifu e doki twins):
```ts
const parsed = JSON.parse(raw) as CreditState;
return normalizeDay({
  ...createInitialState(appConfig.monetization.freePerDay),
  ...parsed,
  freePerDay: appConfig.monetization.freePerDay,
});
```
`...parsed` reintroduz `coins` e `weeklyUntil` do cliente.

**packages/credits** — `checkCredits` honra weekly/coins se presentes no state.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Credits unit | `node --test packages/credits/test/*.test.mjs` | fail 0 |
| Typecheck apps | `npm run typecheck --workspaces --if-present` | exit 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `apps/waifu-chat/src/app/api/chat/route.ts`
- `apps/waifu-chat/src/lib/credits-cookie.ts`
- `apps/doki-call/src/app/api/chat/route.ts` (sanitize messages)
- `apps/doki-call/src/lib/credits-cookie.ts`
- `apps/pmoc-acceptance-gate/src/lib/credits-cookie.ts` se existir o mesmo spread
- Preferível: helper compartilhado em `packages/credits` ou `packages/ai` para
  `sanitizeChatMessages` e `parseGuestCreditsCookie` — **uma** implementação
- Testes em `packages/credits/test/` para parse seguro

**Out of scope**:
- HMAC assinado (plano **011**)
- Stripe/billing real
- revisor-cetico-de se API ainda stub

## Git workflow

- Branch: `advisor/010-chat-credits-sanitize`
- Commits: `fix(waifu-chat): queima crédito só após IA ok` ·
  `fix(credits): ignora coins/weekly do cookie guest` ·
  `fix(chat): sanitize messages compartilhado`

## Steps

### Step 1: parse cookie guest-safe

Em cada `parseCreditsCookie` (ou helper em `@forge/credits`):

```ts
// Só confiar em used/day do cliente; zerar paid fields
return normalizeDay({
  ...createInitialState(freePerDay),
  day: typeof parsed.day === "string" ? parsed.day : undefined,
  used: clampInt(parsed.used, 0, freePerDay), // never negative; cap at freePerDay
  coins: 0,
  weeklyUntil: null,
  freePerDay,
});
```

Se `day` inválido, usar `createInitialState`.

Adicionar testes em `packages/credits` se a lógica for para lá:
- cookie com `coins: 999` → coins 0
- cookie com `weeklyUntil` futuro → null
- cookie com `used: -5` → 0

### Step 2: waifu burn after success

Espelhar doki: precheck credits → chamar AI → **só então** consume + set cookie.
Se AI throw, não decrementar.

### Step 3: sanitize messages

Extrair de pmoc (ou copiar) para helper exportado:

```ts
export function sanitizeChatMessages(raw, { maxMsg = 16, maxContent = 2000 } = {}) {
  // role user|assistant only, slice -maxMsg, slice content, drop empty
}
```

Usar em waifu + doki (+ pmoc pode importar o mesmo e deletar local).

### Step 4: typecheck + tests

**Verify**: `npm run typecheck` · `npm test` · se apps tiverem test scripts, rodar.

## Test plan

- Unit credits: forgery coins/weekly ignored
- Unit sanitize: caps e roles
- Opcional: não há harness de route Next no monorepo — não inventar E2E pesado

## Done criteria

- [ ] waifu não consome crédito se AI falha
- [ ] coins/weekly do cookie guest forçados a 0/null no server
- [ ] waifu+doki limitam messages/content
- [ ] `npm test` + typecheck verdes
- [ ] `plans/README.md` DONE

## STOP conditions

- Algum app **já** em produção depende de `coins` no cookie como feature real
  (grep `coins` em apps) — se houver fluxo legítimo, STOP e reporte; não quebre
  sem HMAC (011).

## Maintenance notes

- 011 adiciona assinatura; este plano é o floor de segurança.
- Reviewer: comparar ordem consume waifu vs doki linha a linha.
