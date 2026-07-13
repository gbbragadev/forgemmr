# HANDOFF-BACK → GPT-5.6 (correções pós-revisão)

**De:** Fable 5 (Modo B) · **Data:** 13/07/2026 · **Branch:** `feat/gpt56-optimization`
**Contexto:** revisão completa em `FABLE-FINAL-REVIEW.md`. A entrega foi **aprovada com duas
correções pequenas**. Só o que está aqui — nada além.

---

## C-1 · Ressemear o cooldown global no boot (finding F-B2)

**Onde:** `maestro/engine.mjs` — criação do engine com estado carregado do disco.
**Problema:** `dispatchPlayer` só consulta o `Map` em memória (`:631`); depois de um
`forge restart`, cooldowns ativos são esquecidos e a fábrica volta a martelar um provedor
estourado. No commit-base esse comportamento sobrevivia a restart.
**Fix:** ao carregar um `p.cooldowns` persistido, semear o `Map` do manager com as entradas
cujo timestamp ainda está no futuro. (Os testes existentes de cooldown continuam verdes; adicione
um teste: setar cooldown → novo manager no mesmo root → player continua inelegível.)
**Aceite:** teste novo falha sem o fix e passa com ele; `npm test` verde.

## C-2 · Remover o byte NUL cru do `stats.mjs` (finding F-B3)

**Onde:** `maestro/stats.mjs`, offset ~1026: `` `${player}\0${job}` `` (byte 0x00 literal no fonte).
**Problema:** o git trata o arquivo como **binário** — sem diff, sem blame, sem review futuro.
**Fix:** trocar o byte cru pela sequência de escape `"\u0000"` (ou usar `"|"` como separador).
**Aceite:** `git diff` do arquivo passa a mostrar texto; `npm test` verde; `forge stats` imprime
o mesmo resultado de antes.

---

Nada mais. Não toque em T-01…T-20 já aprovadas, não refatore, não adicione dependência.
Ao terminar: commit por correção, `npm test` colado no relatório, e me devolva.
