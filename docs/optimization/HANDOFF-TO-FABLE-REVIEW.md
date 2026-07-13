# Handoff para revisão Fable — contrato GPT-5.6

**Data:** 2026-07-13  
**Branch:** `feat/gpt56-optimization`  
**Commit-base solicitado:** `0423528`  
**Base real de execução:** `240fd22`  
**Head funcional verificado:** `539afac`  
**Head entregue:** o commit de fechamento que contém este arquivo; resolver com `git rev-parse HEAD`  
**Publicação:** nenhum push, merge ou deploy executado

## Resultado

O contrato de otimização foi implementado por tarefas/commits lógicos. A matriz global executada antes do fechamento documental terminou com:

```text
npm test          → 97/97 PASS, 0 FAIL
npm run typecheck → 8 workspaces, exit 0
npm run build:all → 4 apps Next compilados; exit 0
```

Relatório detalhado: `docs/optimization/GPT56-VERIFICATION-REPORT.md`.

## Commits da branch desde `240fd22`

```text
90c6cfc T-14 CI de testes
113cddd T-01 build:all no Windows
c721af8 + 8d51386 + d4fc628 T-03 rate-limit
8c49a0f T-04 persistência atômica
b6a10c0 T-02 target gh-pages
2fbaa4b T-06 fallbacks
87bbe13 T-05 cooldown global
8bb8b4b + a01db93 T-07 causa da falha/TUI
ba1f0c0 T-08 mercado no P0
246a5af T-09 gate p1-signal
2fb1b07 registro T-13 (app: 32ba6df)
c465e82 registro T-10a (app: edc2298)
7285ef1 T-11 contexto como dado
e4406ea T-16 cache do improver
437156d T-15 artefatos substanciais
8f9f05f T-12 ferramentas de deploy
11462eb T-20 bordas de segurança
46f2cc8 T-10b resultado P4
539afac T-17 forge stats
```

## Arquivos tocados no repositório pai

```text
.github/workflows/test.yml
docs/PLAYBOOK.md
docs/optimization/GPT56-BASELINE.md
docs/optimization/GPT56-IMPLEMENTATION-PLAN.md
docs/optimization/GPT56-VERIFICATION-REPORT.md
docs/optimization/HANDOFF-TO-FABLE-REVIEW.md
docs/prompts/L0-P0-scorecard.md
docs/prompts/L0-P4-measure-kill.md
maestro/adapters.mjs
maestro/deploy.mjs
maestro/engine.mjs
maestro/fake-exec.mjs
maestro/forge.mjs
maestro/improver.mjs
maestro/p4-result.mjs
maestro/server.mjs
maestro/stats.mjs
maestro/test/*.test.mjs relacionados às tarefas
package.json
workbench/HANDOFF.md
workbench/QUEUE.md
workbench/CLAIMS.md
```

O DOKI//CALL tem Git próprio e recebeu dois commits locais não publicados:

- `32ba6df` — checkout fake-door honesto, sem entitlement sem PSP.
- `edc2298` — telemetria JSONL local; produção falha com 503 sem sink durável.

## O que não foi feito

1. **T-14 remoto:** workflow não foi observado no GitHub Actions porque não houve push autorizado.
2. **F-28/workflow legado:** fora do escopo conforme contrato; pode continuar vermelho.
3. **T-10a produção:** bloqueada sem KV/endpoint durável já existente e autorizado; nenhum serviço foi inventado.
4. **T-13 produção:** commits ficaram locais no repo do app; nenhum deploy/restart foi executado.
5. **T-18/T-19:** deferred pelo contrato; T-19 recebeu cobertura parcial pelas tarefas, mas deploy real permaneceu proibido.
6. **Revisão adversarial independente final:** este arquivo é o gate para a passada Fable/Modo B.

## Pontos para revisão adversarial

- **T-03:** confirmar que a detecção de rate-limit não voltou a classificar texto do agente como falha do provedor.
- **T-08/T-15:** verificar que o `fake-exec` foi tornado válido, não que os verificadores foram afrouxados.
- **T-11:** tentar escapar de `untrustedBlock()` com fences, `<<< >>>` e marcadores `INÍCIO/FIM` variados.
- **T-16:** confirmar que feedback novo invalida a chave do cache e que o erro de retry é sempre anexado após a reescrita.
- **T-20:** em Linux, confirmar `0600` real; no Windows os bits POSIX não são refletidos por `stat()`.
- **T-17:** os 16 attempts de Grok em L0/P1 são dados históricos reais; verificar se retries/fallbacks devem ser contados como attempts (decisão atual: sim).

## Dúvidas explícitas

- O Vercel não existe no lockfile; a implementação usa `npx --no-install vercel` e falha fechado. A revisão deve confirmar se o produto prefere adicionar/pinar a dependência em tarefa separada.
- A telemetria de produção precisa de decisão do dono sobre destino durável. O código não tenta filesystem serverless.
- O relatório usa `539afac` como head funcional verificado; o commit de fechamento posterior toca somente docs/workbench.
