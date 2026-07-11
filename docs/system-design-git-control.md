# System Design — Git-control: repo-por-app + N pipelines concorrentes

> Registro do design **aprovado pelo dono em 11/jul/2026** (gate de design da Fase 2 do
> `HANDOFF-fix-onboarding-git-concurrency.md`). Não é proposta — é o contrato implementado.

## Decisão

**Repos aninhados (Opção A).** Cada `apps/<app>` tem `.git` próprio; a fábrica
(`C:\Dev\forge`) ignora `apps/*/` e nunca é tocada por um run. Apps continuam
**workspaces npm** (`@forge/<app>`, compartilham `packages/*` e o `node_modules` da raiz)
— o `.git` aninhado dá histórico/branch/remote independentes sem quebrar build/deps.

**Alternativa descartada:** worktrees sobre o monorepo — dá isolamento de working dir,
mas emaranha o histórico de N apps num repo só e não atende "cada app ter repo".

## Por que resolve a concorrência

O bloqueio real de rodar >1 pipeline era o working tree único da fábrica: todo run fazia
`git checkout -b pipeline/<app>` NA FÁBRICA (checkpoints, merge e ship idem). Dois runs
brigariam pelo mesmo tree. Com um repo por app, cada run dirige o **repo do próprio app**
→ N runs = N repos independentes, contenção zero.

## Modelo por fase (onde vivem os artefatos)

| Artefato | Antes | Agora |
|---|---|---|
| Código do app | `apps/<app>` (tracked na fábrica) | `apps/<app>` (repo próprio; fábrica ignora) |
| Scorecard/System design/etc. do run | `docs/*-<app>.md` (fábrica) | `apps/<app>/docs/` (repo do app) |
| Propostas DS-GEN | `maestro/proposals/<app>/` (gitignored) | idem (path por app → sem contenção) |
| Estado do run | `maestro/pipeline.json` (1 arquivo) | `maestro/pipelines/<app>.json` (1 por app) |
| Checkpoints/branch/merge | fábrica | repo do app (`pipeline/<app>` dentro dele) |

- `start()` cria `apps/<app>/` + `git init` + `.gitignore` + commit inicial **antes do P0**.
- `ensureCleanTree` valida o repo **do app** — sujeira na fábrica não bloqueia mais runs
  (mudança intencional: a fábrica não participa do run).
- A rota `/docs/` do server ganhou fallback para caminhos relativos ao ROOT (guard
  `insideDir(ROOT)` + whitelist `.md`/`.html`) para servir `apps/<app>/docs/*` nos gates.
- **Push só se houver remote**: `runShip` faz merge no `targetBranch` do repo do app e só
  faz `git push` se `git remote` (no app) não for vazio. Dar remote a um app é opt-in do
  dono (ex.: `gh repo create` + `git remote add`), nunca automático.

## Concorrência (engine)

- `pipelines: Map<appId, { pipeline, looping, child, profile }>` — mata os 4 singletons
  (`pipeline`, guard do advanceLoop, `child` do executor e o `profile` global).
- `profile` é **snapshot por run** (congelado no start): trocar o profile ativo no meio de
  um run não contamina o run em andamento; o próximo run pega o novo.
- `start()` barra apenas o **mesmo** appId já ativo. `decide/stop/resume(appId, …)` com
  fallback: appId omitido + exatamente 1 pipeline ativa → usa ela (compat CLI).
- Boot do server: varre `maestro/pipelines/*.json`; runs `running` renascem `stopped`
  (retomáveis), gates `paused_gate` preservados. `maestro/pipeline.json` legado é migrado.
- SSE: eventos `pipeline` carregam o **mapa** `{ [appId]: snapshot }`; logs prefixados
  com `[appId]`. Cockpit e TUI listam pipelines e operam sobre a selecionada.
- workbench (QUEUE/CLAIMS/HANDOFF): escritas fs sync no mesmo processo (serializadas);
  claims etiquetados por app.

## Migração dos apps existentes

`waifu-chat` e `anime-quiz`: `git init` + `.gitignore` + commit inicial em cada um;
na fábrica, `.gitignore` += `apps/*/` e `git rm -r --cached apps/`. O histórico antigo
desses apps permanece no log da fábrica (não é reescrito); o histórico novo vive no app.
