# Spike: loop P4 measure → P5 kill|scale

**Data:** 2026-07-16 · **Plano:** 020 · **Depende de:** telemetria (019)

## Estados

```
shipped → measuring → p4_recorded → p5_kill | p5_scale
```

| Estado | Quem escreve | Artefato |
|---|---|---|
| shipped | engine `finish("done")` | QUEUE item L0/P4 (humano) |
| measuring | telemetria (019) | eventos no sink |
| p4_recorded | dono ou prefill | `apps/<id>/docs/p4-result.json` (schema `maestro/p4-result.mjs`) |
| p5_* | dono no Control Center | lifecycle `decideP5` |

## Regras

1. **Nunca auto-kill.** P5 kill|scale é sempre gate humano.
2. Sem telemetria: prefill honesto com métricas 0 e
   `verdict: "insufficient_data"` (não inventar conversão).
3. Dedupe: um appId não deve acumular N linhas P4 idênticas no QUEUE
   (implementação futura no `finish`).

## Fluxo desejado (alvo)

1. P3 ship OK → QUEUE: **uma** linha P4 por app.
2. Após N dias (configurável, default 7): Control Center oferece
   "Rascunhar P4" a partir do sink (ou zeros).
3. Dono edita/confirma → `recordP4`.
4. Gate P5: kill | scale | wait.

## Implementado nesta passagem

- Design doc (este arquivo).
- Código de dedupe/prefill: **não** forçado (evita mudar engine sem telemetria).

## Próximo código (quando 019 tiver sink)

- `draftP4Result(appId)` lendo eventos agregados.
- `finish("done")` checa se já existe P4 para o app no QUEUE antes de append.
