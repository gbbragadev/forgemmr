# Maestro Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development` task by task.

**Goal:** transformar o Maestro numa central local que controle a pipeline P0–P5 e a configuração da fábrica sem exigir terminal no fluxo normal.

**Architecture:** extrair o servidor para uma factory testável, introduzir um control plane state-driven com catálogo allowlisted, stores privados de operações/auditoria e uma UI modular que consome o snapshot. O engine mantém a autoridade sobre execução e gates.

**Tech Stack:** Node.js ESM, `node:http`, HTML/CSS/JavaScript sem framework, `node:test`, filesystem local atômico.

## Restrições globais

- Não adicionar dependência nem tocar em `package-lock.json`.
- Não executar push, deploy ou publicação nesta rodada sem nova autorização.
- Não reiniciar nem matar o Maestro vivo na porta 8799.
- Não aceitar shell, binário, argumento ou caminho arbitrário do navegador.
- Preservar gates, redaction, permissões privadas, concorrência por app e guards de Git.
- Usar RED → GREEN → refactor para cada comportamento.
- Um commit por tarefa significativa.

## Task 1 — Contrato e workbench

**Files:**
- Create: `docs/superpowers/specs/2026-07-13-maestro-control-center-design.md`
- Create: `docs/superpowers/plans/2026-07-13-maestro-control-center.md`
- Modify: `workbench/QUEUE.md`, `workbench/CLAIMS.md`

- [ ] Registrar a especificação aprovada.
- [ ] Registrar este plano.
- [ ] Mover `META/L1 Maestro Control Center` para Doing e criar claim.
- [ ] Rodar baseline `npm test` e registrar o total.
- [ ] Commit: `docs(forge): definir Maestro Control Center`.

## Task 2 — Servidor injetável e testes HTTP reais

**Files:**
- Modify: `maestro/server.mjs`
- Create: `maestro/test/server-http.test.mjs`

- [ ] Escrever teste que importa `createMaestroServer`, escuta em porta efêmera e exerce `/api/status`, `/api/token` e uma mutação protegida.
- [ ] Confirmar RED por export ausente.
- [ ] Extrair `createMaestroServer({ root, host, port, engineManager, spawnImpl })` sem mudar o entrypoint existente.
- [ ] Preservar todas as rotas e headers atuais.
- [ ] Confirmar teste alvo e `npm test` verdes.
- [ ] Commit: `refactor(maestro): tornar servidor HTTP testável`.

## Task 3 — Snapshot e catálogo de ações

**Files:**
- Create: `maestro/control/catalog.mjs`
- Create: `maestro/control/snapshot.mjs`
- Create: `maestro/control/store.mjs`
- Create: `maestro/test/control-snapshot.test.mjs`
- Modify: `maestro/server.mjs`, `.gitignore`

- [ ] Testar shapes de `ActionDescriptor`, versão estável e ausência de segredo.
- [ ] Implementar catálogo state-driven para pipeline, decisão, recovery e configuração.
- [ ] Implementar `GET /api/control/snapshot` com agregados reais e versão de estado.
- [ ] Criar store privado/atômico em `.control/` e ignorá-lo no Git.
- [ ] Confirmar alvo e suíte completa.
- [ ] Commit: `feat(maestro): expor snapshot do control plane`.

## Task 4 — Dispatcher seguro, confirmações e operações

**Files:**
- Create: `maestro/control/dispatcher.mjs`
- Create: `maestro/control/confirmations.mjs`
- Create: `maestro/control/audit.mjs`
- Create: `maestro/test/control-actions.test.mjs`
- Modify: `maestro/server.mjs`

- [ ] Testar ação desconhecida, campos extras, estado obsoleto, nonce preso ao contexto, expiração, repetição idempotente e auditoria sanitizada.
- [ ] Implementar `POST /api/control/confirmations`.
- [ ] Implementar `POST /api/control/actions/execute`.
- [ ] Implementar `GET /api/control/operations/:id` e eventos SSE de operação.
- [ ] Garantir que apenas handlers registrados sejam executados.
- [ ] Commit: `feat(maestro): executar ações seguras e auditáveis`.

## Task 5 — Modos de controle do engine

**Files:**
- Modify: `maestro/engine.mjs`
- Create: `maestro/test/control-mode.test.mjs`
- Modify: `maestro/control/catalog.mjs`, `maestro/control/dispatcher.mjs`

- [ ] Testar default `autopilot_to_gate`, pausa guided, pausa manual, persistência/restart e gates invariantes.
- [ ] Persistir `controlMode` e `controlPause`.
- [ ] Expor `setControlMode` e `continuePipeline` no manager.
- [ ] Adicionar ações state-driven correspondentes.
- [ ] Commit: `feat(forge): adicionar modos de controle da pipeline`.

## Task 6 — Administração de profiles, times, providers e blueprints

**Files:**
- Create: `maestro/control/factory-admin.mjs`
- Create: `maestro/test/factory-admin.test.mjs`
- Modify: `maestro/forge.mjs` ou extrair helpers compartilhados
- Modify: `maestro/control/catalog.mjs`, `maestro/control/dispatcher.mjs`

- [ ] Testar CRUD seguro de profile/time em root temporário.
- [ ] Testar catálogo de blueprints e diagnóstico de providers.
- [ ] Testar que login usa somente comandos allowlisted, `shell: false`, e provider ausente fica desabilitado.
- [ ] Reutilizar helpers existentes sem duplicar regras.
- [ ] Commit: `feat(maestro): administrar a fábrica pela central`.

## Task 7 — P4, P5, lifecycle e métricas

**Files:**
- Create: `maestro/control/lifecycle.mjs`
- Create: `maestro/test/control-lifecycle.test.mjs`
- Modify: `maestro/p4-result.mjs`, `maestro/control/catalog.mjs`, `maestro/control/dispatcher.mjs`

- [ ] Testar P4 válido/inválido, escrita atômica e comparação no snapshot.
- [ ] Testar P5 kill/iterate/scale e garantir que P5 kill nunca chama `removeApp`.
- [ ] Persistir lifecycle por app e integrar stats reais.
- [ ] Commit: `feat(maestro): controlar medida e decisão P5`.

## Task 8 — Brief visual e shell do dashboard

**Files:**
- Create: `workbench/prompts-glm/maestro-control-center.md`
- Replace: `maestro/index.html`
- Create: `maestro/control-center.css`
- Create: `maestro/control-center.js`
- Create: `maestro/test/control-center-ui.test.mjs`

- [ ] Escrever brief GLM denso antes da UI forte.
- [ ] Testar landmarks, navegação, regiões live, estados de risco e bindings críticos.
- [ ] Construir shell responsivo com as sete áreas aprovadas.
- [ ] Consumir somente o snapshot e `ActionDescriptor` para ações.
- [ ] Commit: `feat(maestro): criar dashboard visual do Control Center`.

## Task 9 — Fluxos operacionais zero-command

**Files:**
- Modify: `maestro/control-center.js`, `maestro/control-center.css`, `maestro/index.html`
- Modify: `maestro/test/control-center-ui.test.mjs`

- [ ] Testar wizard de nova pipeline, decisões, recovery, factory admin, P4/P5 e operação longa.
- [ ] Implementar formulários genéricos a partir do catálogo.
- [ ] Implementar confirmação contextual, tratamento de `state_stale`, notices e SSE.
- [ ] Garantir navegação por teclado e feedback de erro sem depender de cor.
- [ ] Commit: `feat(maestro): completar operação sem terminal`.

## Task 10 — Launcher e supervisor de um clique

**Files:**
- Create: `forge-control-center.cmd`
- Create: `maestro/supervisor.mjs`
- Create: `maestro/test/supervisor.test.mjs`
- Modify: `package.json`, `README.md`, `docs/MAESTRO.md`

- [ ] Testar detecção de instância existente, startup, health e abertura única do browser com adapters falsos.
- [ ] Manter `forge.cmd` inalterado como fallback CLI.
- [ ] Documentar duplo clique e recuperação pelo painel.
- [ ] Commit: `feat(maestro): abrir central com um clique`.

## Task 11 — Verificação e fechamento

**Files:**
- Modify: `workbench/HANDOFF.md`, `workbench/QUEUE.md`, `workbench/CLAIMS.md`
- Modify apenas se QA revelar defeito: arquivos do Control Center.

- [ ] Rodar `npm test`.
- [ ] Rodar `npm run typecheck`.
- [ ] Rodar `npm run build:all`.
- [ ] Rodar `git diff --check`.
- [ ] Fazer QA HTTP/browser em 375, 768, 1024 e 1440 sem tocar na porta 8799 viva.
- [ ] Fechar Doing, liberar claim e escrever handoff com evidência real.
- [ ] Não fazer push/deploy sem autorização nova.
