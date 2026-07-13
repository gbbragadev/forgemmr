# GPT-5.6 Sol Ultra — baseline

**Data:** 2026-07-13  
**Branch de trabalho:** `feat/gpt56-optimization`  
**Commit-base real desta passagem:** `240fd22` (`master` em 2026-07-13)  
**Commit auditado pelo Fable:** `0423528`  
**Ambiente:** Windows 11 · Node `v24.14.0` · npm `11.9.0`

> `0423528` permanece a referência para provar que testes novos capturam os findings originais. A implementação parte de `240fd22`: entre esses pontos entraram documentos e testes de caracterização, não correções de produção das tarefas T-01..T-20.

## Working tree inicial

```text
## master...origin/master
 M package-lock.json
```

`package-lock.json` é uma alteração preexistente do usuário e fica fora de todos os commits desta passagem. A branch `feat/gpt56-optimization` foi criada sem stash, reset ou descarte.

Após as ferramentas de leitura, surgiram scratch dirs não versionados (`.claude/` e `.codebase-memory/`). Eles não fazem parte do produto nem serão adicionados aos commits das tarefas.

## Baseline de testes

### `npm test`

**Exit code:** `0` · **duração reportada pelo runner:** `13991.6588 ms`

```text
ℹ tests 63
ℹ suites 0
ℹ pass 63
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13991.6588
```

Os quatro testes de `maestro/test/characterization.test.mjs` passaram. O run emitiu warnings de normalização LF→CRLF em repositórios temporários e um `DEP0190` no teste do improver; não houve falha.

### `npm run typecheck`

**Exit code:** `0`

```text
> forge@0.1.0 typecheck
> npm run typecheck --workspaces --if-present

@forge/anima-deck   tsc --noEmit  PASS
@forge/anime-quiz   tsc --noEmit  PASS
@forge/doki-call    tsc --noEmit  PASS
@forge/waifu-chat   tsc --noEmit  PASS
@forge/ai           tsc --noEmit  PASS
@forge/config       tsc --noEmit  PASS
@forge/credits      tsc --noEmit  PASS
@forge/ui           tsc --noEmit  PASS
```

## Falha preexistente reproduzida

### `npm run build:all`

**Exit code:** `1`

```text
> forge@0.1.0 build:all
> npm run build -w @forge/waifu-chat ; npm run build -w @forge/anime-quiz ; npm run build -w @forge/doki-call

> @forge/waifu-chat@0.1.0 build
> next build ; npm run build ; npm run build

Invalid project directory provided, no such directory: C:\Dev\forge\apps\waifu-chat\;
npm error Lifecycle script `build` failed with error:
npm error code 1
```

A mesma falha ocorreu em `anime-quiz` e `doki-call`. Causa confirmada: no `cmd.exe`, `;` foi repassado ao script do workspace em vez de separar comandos. Esta é a T-01; não foi corrigida durante o baseline.

## Dry-run E2E sem quota e sem publicação

Comando:

```text
npm run forge -- new "gpt56 baseline probe" --team dry-run --dry-run
```

Estado observado por `npm run forge -- status gpt56-baseline-probe`:

```text
gpt56-baseline-probe · team dry-run · profile Anime Forge · aguardando decisão · DRY-RUN
  fase: FOUNDATION (1/9)
  gate p0-go: Scorecard pronto (apps/gpt56-baseline-probe/docs/scorecard.md).
```

Evidências:

- executor `fake`, sem uso de quota;
- repo isolado criado em `apps/gpt56-baseline-probe/.git`;
- scorecard criado;
- pipeline chegou a `paused_gate`/`p0-go`;
- nenhum deploy foi executado.

Limpeza executada exclusivamente no probe criado nesta sessão:

```text
npm run forge -- remove gpt56-baseline-probe --force
🗑 gpt56-baseline-probe removido — apps\gpt56-baseline-probe · maestro\pipelines\gpt56-baseline-probe.json
```

Os apps reais e o probe preexistente `audit-probe` não foram alterados.

## Falhas e limitações preexistentes relevantes

1. `build:all` falha no Windows (T-01).
2. O workflow legado `deploy-anime-quiz.yml` permanece operacionalmente quebrado após repo-por-app; T-14 adiciona CI de testes separado, mas não resolve F-28 sem decisão do dono.
3. `gh-pages` aceito pela engine não coincide com `gh-pages-path` no dispatcher (T-02); a correção valida o contrato local, não recupera por si só o workflow legado.
4. Analytics/billing/imagem/P4 não possuem fluxo operacional genérico; não serão tratados como prontos por documentação.
5. T-10a não tem destino persistente serverless universal já autorizado. O trabalho local pode ser implementável, mas produção fica bloqueada se nenhum destino durável existente for comprovado.
6. Nenhum deploy, cobrança, criação/rotação de credencial ou edição de `maestro/roster.json` está autorizado nesta passagem.
