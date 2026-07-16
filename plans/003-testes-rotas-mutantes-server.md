# Plan 003: Testar as rotas HTTP que mutam estado no maestro/server.mjs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ab9f479..HEAD -- maestro/server.mjs maestro/test/server-http.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (só adiciona testes; não toca código de produção)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ab9f479`, 2026-07-16

## Why this matters

O `maestro/server.mjs` (~1100 linhas, node:http puro na :8799) é a superfície de
controle da fábrica: decidir gates, mandar feedback, parar/retomar pipelines,
iniciar runs. Essas rotas **mutam estado durável** (pipelines, repos git, deploys),
mas só ~7 rotas têm teste (`server-http.test.mjs`). Uma regressão silenciosa numa
rota de decisão de gate trava a fábrica inteira ou executa a decisão errada. Este
plano cobre as rotas mutantes com testes de contrato usando o padrão fakeEngine já
existente — sem tocar código de produção.

## Current state

- `maestro/server.mjs` — servidor http puro; rotas testadas hoje (em
  `maestro/test/server-http.test.mjs`): boot sem porta fixa, `/api/run` básico e
  poucos outros. Rotas mutantes SEM teste (confirmar a lista exata no Step 1):
  `/api/pipeline/decide`, `/api/pipeline/feedback`, `/api/pipeline/resume`,
  `/api/pipeline/target`, `/api/stop`, e as rotas de memória
  (`/api/memory/import/*`).
- O padrão de teste existente (excerto REAL de `maestro/test/server-http.test.mjs`,
  linhas 1–40 — siga este padrão):
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { once } from "node:events";
  // ...
  import { createMaestroServer } from "../server.mjs";

  function fakeEngine() {
    const calls = [];
    const pipelines = {};
    return {
      calls,
      snapshot: () => pipelines,
      snapshotFor: () => null,
      start(input) { calls.push(input); /* ... */ },
      startFeedback: () => null,
      decide: () => null,
      stop: () => ({ ok: true }),
      resume: () => null,
      setTarget: () => ({ ok: true }),
      kill: () => ({ ok: true }),
      removeApp: () => ({ ok: true }),
    };
  }

  async function start(server) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address();
    return `http://127.0.0.1:${port}`;
  }
  ```
  O `createMaestroServer({ root, engineManager, spawnImpl })` aceita engine fake e
  root temporário (`mkdtempSync`) com `maestro/roster.json` mínimo — copie o setup
  do teste existente.
- `readBody` do server (linhas ~597-611): rejeita em JSON inválido; os handlers
  embrulham em try/catch — comportamento esperado em body malformado é resposta
  de erro, não crash.
- Convenções: node:test, assert/strict, nomes de teste em pt-BR, um `t.after` que
  fecha o server e remove o tmpdir.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar deps | `npm install` | exit 0 |
| Só este arquivo | `node --test maestro/test/server-http-mutations.test.mjs` | todos passam |
| Suíte completa | `npm test` | `fail 0` (~80-110s) |

## Scope

**In scope**:
- `maestro/test/server-http-mutations.test.mjs` (criar — arquivo NOVO; não editar
  o `server-http.test.mjs` existente além de ler como referência)

**Out of scope** (NÃO tocar):
- `maestro/server.mjs` — este plano NÃO muda produção. Se um teste expor bug real,
  reporte (STOP), não conserte.
- `maestro/test/server-http.test.mjs` (referência read-only)
- Rotas de streaming SSE (`/api/events` etc.) — timing-sensíveis, fora deste plano.

## Git workflow

- Branch: `advisor/003-server-mutation-tests`
- Commit: `test(maestro): cobre rotas HTTP mutantes do server`
- NÃO fazer push nem abrir PR.

## Steps

### Step 1: Enumerar as rotas mutantes reais

`grep -n "url.pathname === \"/api" maestro/server.mjs` e listar todas as rotas
POST que chamam métodos do engine (`decide`, `startFeedback`, `resume`,
`setTarget`, `stop`, `kill`, `removeApp`, `start`). Anote no teste (comentário
topo do arquivo) a lista com linha de origem. Leia o handler de CADA rota para
saber o shape exato do body esperado e da resposta.

**Verify**: lista com ≥6 rotas mutantes documentada no comentário do arquivo novo.

### Step 2: Criar o harness

Novo `maestro/test/server-http-mutations.test.mjs` copiando o setup do
`server-http.test.mjs` (fakeEngine + roster mínimo em tmpdir + `start(server)`).
Estenda o fakeEngine para REGISTRAR os argumentos de cada método
(`decide`, `startFeedback`, `resume`, `setTarget`, `stop`) num array `calls`
etiquetado por método, e devolver valores realistas (ex.: `decide` devolve um
snapshot fake ou `null` para gate inexistente — siga o que o handler espera,
descoberto no Step 1).

**Verify**: `node --test maestro/test/server-http-mutations.test.mjs` → harness
sobe e fecha sem leak (`t.after` fecha server + rm tmpdir).

### Step 3: Testes por rota (um `test()` por rota, mínimo)

Para cada rota mutante do Step 1:
1. POST com body válido → status esperado (200/4xx conforme handler) E o método
   certo do fakeEngine foi chamado com os argumentos do body (assert no `calls`).
2. POST com body JSON inválido (`"{oops"`) → resposta de erro (4xx/5xx conforme o
   handler real), servidor continua vivo (request seguinte funciona).
3. Para `decide`: gate inexistente → resposta de erro coerente (o que o handler
   devolve quando o engine retorna null).
4. Um teste de rota desconhecida: `POST /api/nao-existe` → 404.

**Verify**: `node --test maestro/test/server-http-mutations.test.mjs` → todos passam.

### Step 4: Suíte completa

**Verify**: `npm test` → `fail 0`, contagem sobe (novos testes incluídos pelo glob
`maestro/test/*.test.mjs` automaticamente).

## Test plan

O plano É o test plan. Padrão estrutural: `maestro/test/server-http.test.mjs`.
Cobertura mínima: ≥6 rotas mutantes × (caminho feliz + body inválido) + 404.

## Done criteria

- [ ] `maestro/test/server-http-mutations.test.mjs` existe, com a lista de rotas
      e linha de origem em comentário
- [ ] Cada rota mutante tem ≥2 testes (feliz + malformado); decide tem o caso de
      gate inexistente; 404 coberto
- [ ] Asserts verificam **os argumentos** passados ao engine, não só status code
- [ ] `npm test` → `fail 0`
- [ ] `git status`: só o arquivo novo

## STOP conditions

- Um teste expõe bug real no server (ex.: crash em body malformado, rota mutante
  sem resposta de erro) — NÃO corrija `server.mjs`; reporte a rota, o input e o
  comportamento observado.
- `createMaestroServer` exigir dependências de setup não descritas aqui que você
  não consiga inferir do teste existente em 2 tentativas.
- Excertos de "Current state" não baterem com o código atual.

## Maintenance notes

- Toda rota mutante NOVA no server.mjs deve ganhar teste aqui — revisor de PRs
  futuros: cobrar isso.
- Estes testes são pré-requisito de segurança para os planos 004 (hardening do
  server) e 005 (verify assíncrono) — rodá-los antes e depois dessas mudanças.
- Se as rotas de memória (`/api/memory/*`) exigirem um memoryService fake mais
  elaborado, é aceitável cobri-las num follow-up — anote em NOTES o que ficou fora.
