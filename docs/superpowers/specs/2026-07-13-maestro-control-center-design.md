# Design: Maestro Control Center zero-commands

**Data:** 2026-07-13
**Branch:** `feat/gpt56-optimization`
**Estado:** aprovado pelo dono
**Objetivo:** permitir que um operador controle a fábrica completa pelo navegador, sem precisar digitar comandos, preservando os gates humanos e as proteções do Forge.

## Resultado esperado

O Maestro em `127.0.0.1:8799` vira a central operacional da fábrica. A mesma interface cria pipelines, acompanha execução, responde decisões, muda o modo de controle, administra profiles/times/providers/blueprints, registra P4/P5, recupera falhas e expõe operações longas com progresso. O terminal continua disponível como fallback técnico, mas deixa de ser necessário no fluxo normal.

## Princípios

- **Local-first:** a central escuta somente em `127.0.0.1`; não há painel remoto nesta rodada.
- **Estado dirige a interface:** o servidor descreve as ações válidas para o snapshot atual. O navegador não replica a máquina de estados.
- **Sem shell genérico:** cada ação tem handler allowlisted, validação de schema e argumentos construídos no servidor.
- **Gates permanecem humanos:** deploy, kill, decisão de produto/design e outras ações contratuais continuam parando para uma escolha explícita.
- **Risco visível:** ações são classificadas como `safe`, `guarded`, `external` ou `destructive`.
- **Operação recuperável:** comandos longos viram operações consultáveis, idempotentes e auditadas.
- **Sem infraestrutura nova:** arquivos locais privados e escrita atômica; nenhuma dependência, banco, fila ou serviço externo.

## Arquitetura

### Servidor testável

`maestro/server.mjs` expõe `createMaestroServer({ root, host, port, engineManager, spawnImpl })`. A entrada executável apenas instancia essa função. Isso permite testes HTTP reais em porta efêmera, manager falso e spawn falso, sem afetar um Maestro já aberto na porta 8799.

### Snapshot de controle

`GET /api/control/snapshot` retorna uma visão única e versionada:

```json
{
  "version": "hash-do-estado",
  "generatedAt": "ISO-8601",
  "server": {},
  "providers": [],
  "profiles": [],
  "teams": [],
  "blueprints": [],
  "pipelines": [],
  "decisions": [],
  "lifecycle": [],
  "stats": {},
  "operations": [],
  "actions": []
}
```

Cada ação tem o contrato:

```json
{
  "id": "pipeline.start",
  "scope": "factory",
  "label": "Criar pipeline",
  "description": "...",
  "risk": "safe",
  "enabled": true,
  "blockedReason": null,
  "expectedEffect": "...",
  "fields": [
    { "name": "idea", "label": "Ideia", "type": "textarea", "required": true, "options": [] }
  ]
}
```

### Execução de ações

`POST /api/control/actions/execute` aceita somente:

```json
{
  "actionId": "pipeline.start",
  "appId": null,
  "input": {},
  "stateVersion": "hash-do-snapshot",
  "idempotencyKey": "uuid",
  "confirmation": null
}
```

O servidor rejeita ação desconhecida, campo extra, estado obsoleto e repetição conflitante. Ações longas devolvem uma operação. `GET /api/control/operations/:id` mostra estado, progresso, resultado e erro sanitizado. SSE acrescenta eventos `control`, `operation` e `notice`.

### Confirmações

`POST /api/control/confirmations` emite nonce de uso único, preso a `actionId`, `appId` e `stateVersion`, com validade de dois minutos. Riscos `external` e `destructive` exigem confirmação; a interface mostra efeito, destino e irreversibilidade antes de solicitar o nonce.

### Idempotência e auditoria

- `.control/operations.json`: mapa persistido por `idempotencyKey`, escrito de forma atômica e privada.
- `.control/audit.jsonl`: data, ação, escopo, risco, resultado e identificadores; entrada e erros passam pelo redactor.
- `.control/` fica ignorado pelo Git.
- Nenhum segredo, prompt bruto ou token aparece no snapshot, SSE ou auditoria.

## Modos de controle da pipeline

- `autopilot_to_gate` (padrão): encadeia jobs até um gate contratual ou bloqueio real.
- `guided`: pausa também nas fronteiras de fase para revisão do operador.
- `manual`: pausa após cada job.

O estado persistido recebe `controlMode` e `controlPause`; a pausa usa `paused_control`. O manager expõe `setControlMode(appId, mode)` e `continuePipeline(appId)`. Nenhum modo elimina gates já existentes.

## Administração da fábrica

A área Factory oferece handlers explícitos para:

- listar, ativar, criar e importar profiles;
- listar e salvar times preservando o roster existente;
- listar blueprints e seus campos;
- diagnosticar providers instalados e login conhecido;
- abrir apenas fluxos de autenticação allowlisted com `shell: false`.

Codex, Claude e Grok usam seus CLIs de assinatura. Gemini aparece indisponível quando não está instalado. O navegador nunca escolhe binário, argumento ou caminho arbitrário.

## Ciclo P0–P5

- P0–P3 continuam refletindo o engine e os gates atuais.
- P4 possui formulário comparável ao schema de `p4-result.mjs` e grava `apps/<app>/docs/p4-result.json`.
- P5 persiste `maestro/lifecycle/<app>.json` com decisão `kill`, `iterate` ou `scale`.
- `kill` em P5 aposenta a aposta, mas não chama `removeApp` nem apaga produção.
- `iterate` inicia feedback; `scale` registra a decisão e oferece próximos passos explícitos.

## Experiência do operador

Navegação principal:

1. **Visão geral:** saúde do Maestro, pipelines, gates pendentes, providers e operações.
2. **Nova pipeline:** wizard de ideia, profile, blueprint/capability, time, target, dry-run e modo de controle.
3. **Pipelines:** cards e detalhe com timeline, job atual, logs, artefatos, recovery e ações válidas.
4. **Decisões:** fila única para gates, confirmações e P5.
5. **Fábrica:** profiles, times, providers e blueprints.
6. **Métricas:** P4, agregados reais de runs e lifecycle.
7. **Atividade:** operações, auditoria sanitizada e notices.

Formulários são renderizados a partir de `ActionDescriptor`. A UI trata `409 state_stale` recarregando o snapshot antes de permitir uma nova ação.

## Direção visual

- Fundo `#11110f`, superfície `#171613`, tinta `#f4efe6`.
- Violeta `#c46cff` para ação; verde `#56d89b` para sucesso; âmbar `#f0bd57` para atenção; vermelho `#ff6b6b` para perigo.
- Visual de sala de controle editorial, não um terminal disfarçado.
- Timeline e estado dominam a hierarquia; mono fica restrito a IDs, logs e métricas.
- Breakpoints 375, 768, 1024 e 1440 px; foco visível, WCAG AA, teclado e `prefers-reduced-motion`.

Antes do polish forte será versionado um brief denso em `workbench/prompts-glm/maestro-control-center.md`, conforme as regras do Forge.

## Segurança e limites

- Token de instalação continua obrigatório nas mutações e nunca é exposto fora da origem local.
- Sem CORS permissivo; headers anti-frame e anti-sniff.
- `remove` não faz parte do fluxo normal e, quando exposto, exige confirmação destrutiva presa ao app.
- Deploy e publicação exigem ação e confirmação explícitas; esta implementação não executa deploy.
- Sem reiniciar o servidor vivo durante desenvolvimento; os testes usam portas efêmeras.
- Sem alterar `package-lock.json`, roster do usuário ou pipelines existentes como efeito de setup.

## Verificação

1. Testes HTTP reais das rotas atuais e novas, com token, validação, estado obsoleto e idempotência.
2. Testes unitários para catálogo de ações, stores, control modes, P4/P5 e allowlists.
3. `npm test`, `npm run typecheck`, `npm run build:all` e `git diff --check` verdes.
4. QA de navegador em 375/768/1024/1440, sem overflow e com teclado.
5. Smoke local do launcher sem matar o Maestro já vivo.

## Fora de escopo

- Hospedar o painel na internet ou adicionar autenticação multiusuário.
- Trocar o engine, remover o CLI ou criar um terminal web.
- Adicionar banco, serviço de fila, dependência ou API paga por chamada.
- Publicar apps, fazer push ou deploy nesta rodada sem nova autorização.
