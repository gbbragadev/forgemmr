# Plan 011: Cookie de créditos com HMAC server-side (guest)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- packages/credits apps/waifu-chat apps/doki-call apps/pmoc-acceptance-gate`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/010-core-chat-credits-sanitize.md (guest-safe parse + caps)
- **Category**: security
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

O plano 010 zera `coins`/`weekly` e clampa `used`, mas um cliente ainda pode
resetar `used: 0` a cada request se o cookie for reescrito pelo browser
(sem httpOnly bypass — o Set-Cookie é server, mas requests manuais com Cookie
header forjado recomeçam o dia). HMAC (ou sealed cookie) amarra o estado ao
servidor: tamper → rejeita e recria free tier.

## Current state

- Cookie `httpOnly` + JSON plaintext em `parseCreditsCookie` / `serializeCredits`.
- Sem `CREDITS_COOKIE_SECRET` / similar no `.env.example`.
- `@forge/credits` é pure functions, bom lugar para `signCreditState` /
  `verifyCreditState`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Credits tests | `node --test packages/credits/test/*.test.mjs` | fail 0 |
| Typecheck | `npm run typecheck --workspaces --if-present` | exit 0 |

## Scope

**In scope**:
- `packages/credits/src/index.ts` (+ export)
- `packages/credits/test/*.test.mjs`
- adapters cookie em waifu/doki/pmoc
- `.env.example` — documentar `CREDITS_COOKIE_SECRET` (sem valor real)

**Out of scope**:
- Login de usuário / Stripe
- Rotacionar secrets em produção (só instruir no README do app se existir)

## Git workflow

- Branch: `advisor/011-credits-hmac`
- Commit: `feat(credits): assina cookie guest com HMAC`

## Steps

### Step 1: API de assinatura

```ts
// payload = base64url(JSON) + "." + base64url(hmac-sha256)
export function sealCredits(state: CreditState, secret: string): string
export function openCredits(token: string, secret: string, freePerDay: number): CreditState
```

- Se secret ausente em **production** (`NODE_ENV=production` ou
  `VERCEL_ENV`/`CF_PAGES`): log warn e tratar como 010 (guest-safe unsigned)
  **ou** fail-closed — preferir: dev permite unsigned; prod exige secret.
- Decisão do plano: **prod exige secret**; dev sem secret usa guest-safe
  unsigned do 010 (documentar).

### Step 2: Wire apps

- `serializeCredits` → `sealCredits(state, secret)`
- `parseCreditsCookie` → `openCredits` / fallback createInitialState se inválido

Secret: `process.env.CREDITS_COOKIE_SECRET`.

### Step 3: Testes

- roundtrip seal/open
- tamper no payload → initial state
- missing secret behavior as documented

**Verify**: `node --test packages/credits/test/*.test.mjs` · typecheck

## Done criteria

- [ ] Cookie assinado quando secret presente
- [ ] Tamper não restaura used/coins
- [ ] `.env.example` documenta a var
- [ ] Testes verdes
- [ ] `plans/README.md` DONE

## STOP conditions

- Edge runtime sem `node:crypto` em alguma rota — se `runtime = "edge"`, STOP;
  apps atuais usam `nodejs`.

## Maintenance notes

- Rotação de secret invalida cookies (usuários ganham free day de novo) — ok.
- Billing real deve migrar para ledger server-side e aposentar cookie como SoT.
