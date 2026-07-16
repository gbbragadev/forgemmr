# Plan 015: Pinar OpenNext e Wrangler no path Cloudflare Workers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/deploy.mjs apps/doki-call apps/pmoc-acceptance-gate apps/revisor-cetico-de`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (Vercel já removido — **não** reintroduzir vercel)
- **Category**: migration | deps
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

Pages usa `wrangler@4.108.0` pinado; o path Workers ainda faz
`npx --yes @opennextjs/cloudflare build` e `npx --yes wrangler …`, puxando
versões flutuantes no ship. Deploy não-reprodutível quebra P3 intermitente.

## Current state

- `maestro/deploy.mjs`: `const WRANGLER = "wrangler@4.108.0"` (Pages)
- Workers (~495-526): `npx --yes @opennextjs/cloudflare build`,
  `npx --yes wrangler secret put`, `npx --yes wrangler deploy`
- Apps chat (doki/pmoc/revisor) podem ter `wrangler` / `@opennextjs/cloudflare`
  em devDependencies — **ler** `apps/doki-call/package.json` e usar as mesmas
  versões no pin.

**Nota**: target `vercel` foi removido; se o código ainda tiver remapeamento
legado, não recriar deploy Vercel.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes deploy | `node --test maestro/test/deploy*.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/deploy.mjs`
- Testes se assertam strings de comando
- Opcional: alinhar devDependency do app se faltar pin

**Out of scope**:
- Deploy real na Cloudflare
- Adicionar pacote vercel

## Git workflow

- Branch: `advisor/015-pin-workers-cli`
- Commit: `fix(maestro): pina OpenNext/wrangler no deploy Workers`

## Steps

### Step 1: Constantes

```js
const WRANGLER = "wrangler@4.108.0";
const OPENNEXT_CF = "@opennextjs/cloudflare@1.20.1"; // ajuste à versão no lock/app
```

Confirme a versão real:
```
npm ls @opennextjs/cloudflare wrangler -w @forge/doki-call
```
Use a versão instalada, não invente.

### Step 2: Substituir

- `npx --yes @opennextjs/cloudflare build` → `npx --no-install ${OPENNEXT_CF} build`
  **ou** `npx --yes ${OPENNEXT_CF} build` se --no-install falhar sem local install.
  Preferência do repo (T-12): pin explícito na string do pacote.
- `wrangler secret put` / `wrangler deploy` → usar `${WRANGLER}` pinado igual Pages.

### Step 3: Testes

Se algum teste snapshota o comando, atualizar.

**Verify**: `npm test`.

## Done criteria

- [ ] Nenhum `npx --yes wrangler` sem versão no path Workers
- [ ] OpenNext pinado
- [ ] Suíte verde
- [ ] `plans/README.md` DONE

## STOP conditions

- Versão no lock incompatível com Next do app — reportar `npm ls` output.

## Maintenance notes

- Bumps de wrangler devem atualizar Pages **e** Workers juntos.
