# L1/B3 — Maestro Control Center sem terminal

## PROMPT

```text
Você é o GLM 5.2 MAX atuando como frontend senior de uma central operacional local. Implemente a interface completa, responsiva e acessível descrita abaixo. Este é um job visual e funcional cirúrgico: não redesenhe o backend e não altere arquivos fora da lista permitida.

# Contexto

Repo: C:\Dev\forge
Produto: ForgeMMR / Maestro Control Center
Interface local: http://127.0.0.1:8799
Stack: HTML, CSS e JavaScript ESM puros, sem dependências novas e sem framework.

O backend já existe e está testado. Ele expõe:

- GET /api/control/snapshot
- GET /api/token
- POST /api/control/confirmations
- POST /api/control/actions/execute
- GET /api/control/operations/:id
- GET /api/events (SSE)

Leia antes de editar:

- AGENTS.md
- docs/superpowers/specs/2026-07-13-maestro-control-center-design.md
- maestro/control/catalog.mjs
- maestro/control/snapshot.mjs
- maestro/test/control-center-ui.test.mjs

# Feedback literal do dono

"eu nao quero usar nada de comandos ta ligado ter tudo nessa central"

"gostaria que a pipeline completa fosse controlada por ele, desse pra fazer qualquer coisa sabe"

"bem ajustavel a cada caso de uso e cada erro ou decisao que pode acontecer"

# Objetivo de experiência

Em até 5 segundos, o dono deve entender o estado da fábrica, o que exige decisão e qual ação segura pode executar. Ele deve conseguir operar P0 a P5, administrar perfis/times/providers, responder gates, tratar erros e acompanhar resultados sem abrir terminal nem decorar comandos.

A central é um cockpit operacional, não uma landing page e não um terminal disfarçado.

# Arquitetura de informação obrigatória

Navegação persistente com sete destinos:

1. Visão geral — saúde do servidor, KPIs, decisões urgentes, pipelines em andamento e atalhos contextuais.
2. Nova pipeline — wizard orientado por etapas: ideia, blueprint, time/perfil e modo de controle; usa os ActionDescriptors reais.
3. Pipelines — lista e detalhe por app, progresso P0–P5, job atual, erro recente, modo e todas as ações habilitadas/bloqueadas.
4. Decisões — gates humanos com contexto, risco e escolhas; confirmação reforçada para efeito externo ou destrutivo.
5. Fábrica — perfis, times, providers, disponibilidade e login allowlisted; formulários derivados de descriptors.
6. Métricas — funil, P4, sinais reais e resultado por app; estados vazios honestos.
7. Atividade — operações e auditoria recente, com status pending/running/succeeded/failed e detalhe legível.

# Linguagem visual

Direção: sala de controle editorial/industrial, escura, calma e precisa. Alta densidade com hierarquia clara, sem parecer painel financeiro genérico.

Tokens base obrigatórios:

- background #11110f
- surface #171613
- ink #f4efe6
- accent #c46cff, usada com parcimônia para foco/seleção
- success #56d89b
- warning #f0bd57
- danger #ff6b6b

Use bordas quentes discretas, tipografia de sistema, números tabulares quando útil, ritmo consistente e contraste AA. Breakpoints explícitos em 375, 768, 1024 e 1440 px. Em mobile, navegação e ações devem continuar utilizáveis, com touch target mínimo de 44 px. Respeite prefers-reduced-motion.

# Estados obrigatórios

- carregando com estrutura estável;
- vazio com orientação contextual, sem inventar métricas;
- erro de rede com tentar novamente;
- estado stale (HTTP 409/code state_stale) recarrega snapshot e explica ao usuário;
- provider indisponível e action blocked exibem blockedReason;
- modal de confirmação para risk=external ou risk=destructive;
- feedback de operação em aria-live;
- reconexão SSE e atualização sem piscar a tela inteira.

# Formulários orientados pelo catálogo

Não codifique cada ação como endpoint separado. Renderize ActionDescriptor.fields de forma genérica e suporte pelo menos:

- text
- textarea
- select
- choice
- hidden
- checkbox
- number
- team-members (editor repetível de membros com provider/model/effort/role)

Exiba label, description, expectedEffect, risk, disabled e blockedReason. Envie somente o contrato fechado do backend:

{
  "actionId": "...",
  "scope": "...",
  "input": {},
  "stateVersion": "...",
  "idempotencyKey": "crypto.randomUUID()",
  "confirmation": null
}

Para ações externas/destrutivas, peça o nonce em /api/control/confirmations após confirmação explícita. Todas as requisições POST usam X-Maestro-Token obtido de /api/token.

# Segurança

- Nunca crie campo de shell, console, comando livre ou eval.
- Nunca use innerHTML com dados vindos do snapshot; use textContent e criação de DOM.
- Não exponha o token na tela/log.
- Não contorne action.disabled nem blockedReason.
- Não altere os limites de loopback, confirmação ou catálogo.

# Arquivos permitidos

- maestro/index.html
- maestro/control-center.css (novo)
- maestro/control-center.js (novo)

O teste maestro/test/control-center-ui.test.mjs já existe como contrato e NÃO pode ser editado. Não toque em backend, package.json, package-lock.json, workbench/QUEUE.md, workbench/HANDOFF.md, workbench/CLAIMS.md, apps/, docs/ ou qualquer outro arquivo.

# Anti-padrões

- purple slop e gradiente roxo cobrindo tudo;
- emoji como iconografia principal;
- grade infinita de cards iguais;
- wall of text;
- dashboard decorativo com números inventados;
- terminal embutido ou botão que exige saber comando;
- animação contínua, glow excessivo e blur pesado;
- desktop comprimido no celular;
- dependência, CDN, fonte remota ou ícone remoto.

# VERIFY

Execute:

node --test maestro/test/control-center-ui.test.mjs
npm test

Se um teste falhar, corrija apenas os três arquivos permitidos. Não enfraqueça testes e não modifique o backend.

# Definition of Done percebida

- Em 5 segundos dá para ver saúde, trabalho em curso e decisões pendentes.
- Uma nova pipeline nasce por wizard, sem conhecimento de CLI.
- Cada erro ou decisão oferece contexto e apenas as ações realmente válidas naquele estado.
- Toda a jornada P0–P5 e a administração da fábrica cabem na central.
- O mobile de 375 px é operável, não apenas renderizável.
- Nenhuma ação externa ou destrutiva acontece sem confirmação explícita.
- A interface é reconhecível como o cockpit do Forge, não como template de admin.

Comece lendo os arquivos listados, implemente somente os três arquivos permitidos e encerre depois dos testes.
```
