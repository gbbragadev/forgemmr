# Spike: sink de telemetria do Forge

**Data:** 2026-07-16 · **Plano:** 019 · **Status:** decisão pendente do dono

## Problema

A tese do produto é measure → kill|scale. Só o **doki-call** tem funnel
(`apps/doki-call/src/lib/telemetry.ts` + `/api/telemetry`). Em produção a rota
responde **503 `telemetry_sink_required`** de forma honesta. Os demais apps
shipados não emitem eventos. P4 no QUEUE continua 100% humano e sem dados.

## Eventos (doki hoje)

Inventário resumido: funil de interesse, checkout waitlist, uso de chat/créditos
(ver `track` no app). Dev grava JSONL local; prod exige sink configurado.

## Opções

| Opção | Prós | Contras | Custo |
|---|---|---|---|
| **1. CF KV / R2 JSONL** (recomendado) | Alinha com deploy CF Pages/Workers; zero SaaS novo | Query pobre; precisa job de agregação | Baixo |
| **2. Postgres único** | SQL para P4; multi-app | Ops, migrations, backup | Médio |
| **3. SaaS (PostHog etc.)** | UI pronta | Vendor, LGPD, key extra | Variável |

## Recomendação

**CF KV (ou R2 append) + helper `packages/telemetry` mínimo**, reexportando o
padrão do doki. Prod sem binding → continua 503. Dev → JSONL.

## Open questions (dono)

1. Binding KV por app ou conta única multi-app?
2. Retenção (7d / 30d / 90d)?
3. Eventos que **não** podem ir para cloud (PII)?

## PoC

**Deferred** até autorização de env/binding. Nenhum sink novo foi ligado nesta
passagem. Próximo código: extrair `track(event)` para package e 1 app piloto
(revisor ou doki).

## Relação com P4

Ver `docs/p4-measure-loop.md` (plano 020).
