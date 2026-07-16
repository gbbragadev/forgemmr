# Plan 019: Spike — sink de telemetria compartilhado (design + PoC mínimo)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- apps/doki-call/src/lib/telemetry.ts apps/doki-call/src/app/api/telemetry packages/`

## Status

- **Priority**: P3
- **Effort**: M (spike, **não** plataforma completa)
- **Risk**: MED
- **Depends on**: none (decisão de host é do dono — se não houver, documentar opções e parar)
- **Category**: direction
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

A tese do Forge é measure→kill|scale. Só doki-call tem funnel; produção responde
`503 telemetry_sink_required`. Sem sink, P4 é teatro. Este plano é **spike**:
escolher sink, extrair helper mínimo, provar 1 write em dev — **não** migrar
todos os apps.

## Current state

- `apps/doki-call/src/lib/telemetry.ts` + `api/telemetry/route.ts`
- Prod: 503 `telemetry_sink_required` (honesto)
- Dev: JSONL local
- Outros apps: sem telemetry

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build doki | `npm run build:doki` | exit 0 |
| Testes se houver | domain tests do app | fail 0 |

## Scope

**In scope**:
- Doc de decisão: `docs/telemetry-sink-decision.md` (criar)
- Opcional PoC: `packages/telemetry` **mínimo** OU mover helper de doki sem over-engineer
- **Não** conectar Stripe/Postgres a menos que o dono já tenha credencial e peça

**Out of scope**:
- Auto P4/P5 (plano 020)
- Dashboard analytics
- LGPD compliance full (mencionar perguntas no doc)

## Git workflow

- Branch: `advisor/019-telemetry-spike`
- Commit: `docs: spike telemetria + PoC opcional`

## Steps

### Step 1: Inventário (só leitura)

Resumir no doc:
- Eventos que doki emite hoje
- Comportamento dev vs prod
- Apps live na QUEUE (revisor, pmoc, doki, …)

### Step 2: Opções (1 página)

Comparar 3 opções **com custo**:
1. JSONL em R2/CF KV  
2. Postgres único  
3. SaaS (PostHog/Plausible self)

Recomendar **uma** default para o Forge (provavelmente CF KV/R2 alinhado ao deploy).

### Step 3: PoC opcional

Se o dono já tiver `TELEMETRY_SINK_URL` ou KV binding documentado no ambiente:
- extrair `track(event)` mínimo reutilizável
- manter 503 se não configurado

Se **não** houver env/autorização: **só o doc**, status DONE com nota "PoC deferred".

## Done criteria

- [ ] `docs/telemetry-sink-decision.md` existe com recomendação e open questions
- [ ] Build doki ainda exit 0 se código tocado
- [ ] `plans/README.md` DONE ou DONE (doc-only)

## STOP conditions

- Pedido implícito de "implementar analytics enterprise" — fora do spike; reportar.

## Maintenance notes

- 020 depende da decisão deste doc.
