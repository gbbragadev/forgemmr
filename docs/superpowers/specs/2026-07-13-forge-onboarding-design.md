# Design: onboarding visual do Forge

**Data:** 2026-07-13  
**Branch:** `feat/gpt56-optimization`  
**Estado:** aprovado pelo dono  
**Objetivo:** ensinar um operador novo a usar o Forge com segurança e, sem trocar de material, revelar os recursos avançados necessários para operar a fábrica no dia a dia.

## Resultado esperado

Publicar uma página estática, responsiva e didática que leve alguém da primeira abertura do Forge até uma pipeline em dry-run no gate `p0-go`, explique como avançar com decisões humanas e sirva depois como referência operacional para times, feedback, deploy, métricas e recuperação.

A página será pública. Nenhum segredo, token, caminho pessoal, telefone ou dado privado será incluído.

## Audiência e progressão

A experiência terá duas camadas na mesma página:

1. **Primeiros 15 minutos:** visão mental do produto, pré-requisitos, setup, profile, time, dry-run, gates e primeiro app.
2. **Modo operador:** pipelines concorrentes, targets, feedback e redeploy, observabilidade, cooldown, recovery e comandos destrutivos.

O conteúdo básico ficará sempre visível. Detalhes avançados usarão expansão progressiva e uma navegação lateral para não transformar o primeiro contato num manual de avião.

## Arquitetura de informação

### 1. Abertura

- Promessa concreta: “da ideia ao app no ar, com humanos apenas nas decisões irreversíveis”.
- Dois CTAs: começar o percurso e abrir o mapa de comandos.
- Indicadores reais: três gates humanos, múltiplas pipelines, dry-run sem quota e targets estático/server.

### 2. Mapa da fábrica

Timeline horizontal no desktop e vertical no mobile:

`Ideia → P0 → FOUNDATION → DS-GEN → P1 → B1…B5 → P3 → P4 → P5`

Cada etapa explicará entrada, executor preferido, artefato produzido, verificação e possível gate.

### 3. Primeira execução segura

Checklist numerado com comandos copiáveis:

1. `npm install`
2. `npm run maestro:open`
3. `npm run forge -- profile init`
4. `npm run forge -- team`
5. `npm run forge -- new "minha ideia" --team dry-run --dry-run`
6. `npm run forge -- status`
7. decisão no gate `p0-go`

O tutorial explicará o que o operador deve ver após cada comando e como reconhecer que a porta aberta não é o Maestro correto.

### 4. Simulador de gates

Componente interativo local, sem backend, mostrando:

- `p0-go`: validar mercado e decidir GO/KILL;
- `b3-visual`: aprovar gosto e direção visual;
- `deploy`: autorizar publicação;
- efeitos de GO, KILL, RETRY e feedback;
- comandos equivalentes no terminal.

O simulador não executará comandos. Ele apenas ensina o efeito de cada decisão.

### 5. Escolha do time

Comparação visual entre `grok-solo`, `grok-glm-front`, `quality` e `dry-run`, incluindo quando usar, custo em quota, foco e fallback. O tutorial mostrará também `forge team` para composições próprias.

### 6. Mapa de comandos

Busca instantânea e filtros por intenção:

- começar: `profile`, `team`, `new`, `onboard`;
- acompanhar: `attach`, `status`, `stats`, `roster`;
- decidir: `decide`, `target`;
- iterar: `feedback`;
- recuperar: `stop`, `resume`, `restart`, `kill`;
- remover: `remove` com alerta destrutivo explícito.

Cada comando terá descrição curta, exemplo real e botão de copiar.

### 7. Operação avançada

- pipelines paralelas e isolamento por app;
- retries, rollback e fallback de player;
- cooldown global e sobrevivência a restart;
- como ler `forge stats` sem maquiar falhas;
- deploy estático versus server;
- feedback pós-publicação até o redeploy;
- arquivos autoritativos: `HANDOFF`, `QUEUE`, `CLAIMS` e estado persistido.

### 8. Playbook de recuperação

Árvore de decisão visual:

- job vivo e precisa pausar → `stop`;
- servidor precisa recarregar → `restart`;
- execução parada sem gate → `resume`;
- provedor em rate-limit → aguardar cooldown/fallback;
- run sem saída segura → `kill`;
- app deve ser apagado → revisar app-id, produção e só então `remove`.

### 9. Ship checklist

Checklist final com build, typecheck, testes, gate, target, URL, smoke e P4. A página deixará claro que build verde não substitui smoke HTTP/browser.

## Direção visual

- Tema escuro inspirado no Maestro, sem imitar um terminal em toda a página.
- Fundo carvão, texto marfim, violeta apenas como acento de ação, verde para sinais verificados e âmbar/vermelho para risco.
- Tipografia de leitura para explicações e mono apenas para comandos/estado.
- Hierarquia editorial forte: grandes números de etapa, linhas de fluxo e painéis de terminal com contraste alto.
- Sem gradiente azul/roxo genérico, blobs, cards repetitivos ou emojis decorativos.
- Motion curto para revelar etapas e simular gates, desativado por `prefers-reduced-motion`.

## Implementação

- Artefato publicado: `docs/forge-onboarding/index.html`.
- HTML, CSS e JavaScript estáticos; sem framework e sem dependência nova no projeto.
- Dados de comandos e etapas definidos em estruturas JavaScript locais para busca/filtro e para evitar markup duplicado.
- Funciona sem backend; clipboard tem fallback quando a API não estiver disponível.
- Links para arquivos do repositório usam a branch publicada quando fizer sentido.
- Conteúdo derivado de `README.md`, `docs/MAESTRO.md`, `docs/AGENT-PIPELINE.md` e da saída atual de `forge help`.

## Acessibilidade e responsividade

- HTML semântico, hierarquia de títulos única e landmarks.
- Navegação por teclado, foco visível e estados anunciados com `aria-live`.
- Contraste mínimo WCAG AA.
- Breakpoints validados em 375, 768, 1024 e 1440 px.
- Nenhuma informação dependerá apenas de cor ou animação.
- Terminal e tabelas terão overflow controlado no mobile.

## Verificação

1. Teste automatizado valida presença das seções críticas, comandos, alertas destrutivos, semântica e ausência de dados sensíveis.
2. Smoke local por HTTP confirma status 200 e assets carregados.
3. Screenshots em 375, 768 e 1440 px verificam overflow, legibilidade e hierarquia.
4. Interações testadas: navegação, busca, filtros, copiar comando, simulador de gates e expansões.
5. Após deploy, smoke da URL pública confirma status, título, conteúdo e ausência de página genérica do host.

## Versionamento e deploy

- Um commit para a especificação e um commit para implementação/fechamento.
- Push da branch `feat/gpt56-optimization` para `origin`.
- Deploy direto e isolado em Cloudflare Pages, com projeto próprio para o guia.
- Aceite mínimo: URL `*.pages.dev` funcional. Domínio em `gbbragadev.com` será configurado apenas se a credencial atual já tiver a permissão necessária, sem solicitar ou criar segredo.
- Nenhum app em produção será removido, reiniciado ou redeployado como efeito colateral.

## WhatsApp

Depois do smoke público, enviar para o número padrão do próprio Guilherme uma mensagem curta com:

- link do tutorial;
- resumo do que ele cobre;
- branch e commits;
- confirmação de deploy e smoke.

## Fora de escopo

- Autenticação, analytics, CMS ou coleta de dados.
- Execução real de comandos pelo navegador.
- Alteração do Maestro, engine, roster ou pipelines existentes.
- Mudança nos apps publicados.
- Novo domínio obrigatório, serviço externo ou dependência.
