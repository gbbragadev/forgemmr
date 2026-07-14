# Forge Nexus + ai-memory — Design aprovado

**Data:** 2026-07-14

**Status:** aprovado pelo dono

**Branch de origem:** feat/gpt56-optimization

**Upstream:** https://github.com/akitaonrails/ai-memory

**Versão inicial:** v1.13.0

**Objeto da tag:** 39a1e2482348107751f5a40861238e97ca7eba8b

**Commit da release:** 94626aad1aa254901cdc6437c270894f5bb70340

## 1. Resumo executivo

O Maestro Control Center passa a se apresentar ao usuário como **Forge Nexus**:
uma central local, visual e sem terminal para controlar a pipeline, os agentes,
os gates, os erros e a memória operacional da fábrica.

O código do ai-memory será incorporado ao repositório como um git subtree em
integrations/ai-memory. O Forge continuará responsável pela experiência de
operação. O ai-memory será responsável pelo armazenamento, indexação, busca,
handoffs e consolidação da memória.

A integração é completa:

- briefing automático antes de cada job;
- captura estruturada de decisões, erros, verificações, handoffs e resultados;
- memória isolada por fábrica, app e run;
- nova área Memória no Forge Nexus;
- instalação, saúde, recuperação, atualização e importação pela interface;
- importação inicial do histórico com prévia e redaction;
- funcionamento fail-open: indisponibilidade da memória não interrompe a
  pipeline nem aprova gates.

## 2. Decisões aprovadas

1. O nome visível do produto será **Forge Nexus**.
2. Os nomes internos maestro, caminhos e comandos existentes permanecem na
   primeira entrega para evitar uma migração incompatível.
3. O ai-memory será incorporado como **git subtree**, não como submodule.
4. A versão inicial será a tag estável v1.13.0, e não o HEAD móvel do upstream.
5. O runtime será gerenciado automaticamente pelo Forge Nexus.
6. O usuário não precisará instalar Rust ou executar comandos.
7. A memória será isolada no ecossistema Forge.
8. O histórico existente será importado por um assistente com prévia.
9. A memória ajuda o agente, mas nunca substitui gates humanos.
10. A integração usa as superfícies públicas do ai-memory; modificações no
    subtree serão evitadas sempre que uma camada Forge puder resolver o caso.

## 3. Objetivos

- Fazer cada job começar com o contexto relevante e limitado.
- Impedir que erros já resolvidos voltem a consumir tentativas.
- Preservar decisões e handoffs entre agentes, providers, runs e restarts.
- Tornar a memória pesquisável e administrável sem terminal.
- Manter apps isolados para evitar contaminação de produto ou arquitetura.
- Mostrar fonte, idade e escopo de toda memória usada pelo agente.
- Continuar operando quando o serviço de memória estiver degradado.
- Preservar o modelo local-first, sem banco, fila ou serviço cloud novo.

## 4. Não objetivos

- Não vender ou publicar o Forge Nexus nesta entrega.
- Não compartilhar memória com outros projetos do computador.
- Não instalar hooks globais nos CLIs sem ação explícita do usuário.
- Não gravar prompts completos, raw logs ou segredos.
- Não usar memória para aprovar deploy, kill, billing ou outra ação irreversível.
- Não renomear fisicamente maestro/ nem remover comandos compatíveis.
- Não criar shell arbitrário no dashboard.
- Não introduzir um LLM pago por chamada como requisito da memória.
- Não modificar o core Rust quando uma adaptação externa for suficiente.

## 5. Alternativas consideradas

### 5.1 Sidecar externo sem fonte incorporada

Seria a alternativa com menor manutenção, mas não atende à escolha do dono de
integrar o projeto ao Forge e manter o código auditável no mesmo repositório.

### 5.2 Hooks e MCP somente

Exigiria configuração diferente em cada CLI e não daria ao Nexus controle
confiável sobre briefing, captura, estado degradado e recuperação.

### 5.3 Submodule

Manteria o histórico separado, mas um clone normal chegaria incompleto e
exigiria comandos adicionais. Isso contradiz a experiência zero-command.

### 5.4 Git subtree — escolhida

O código está presente em um clone normal, pode ser auditado junto ao Forge e
continua sincronizável com o upstream. A licença MIT e o copyright do autor
serão preservados.

## 6. Arquitetura

~~~text
Usuário
  |
  v
Forge Nexus no navegador
  |
  v
Servidor local do Forge :8799
  |-- Control plane existente
  |-- Memory Gateway
  |     |-- leitura: API /api/v1
  |     |-- captura: lifecycle hooks /hook
  |     |-- operações semânticas: MCP
  |     '-- manutenção allowlisted: API administrativa
  |
  +--> Engine da pipeline
  |     |-- solicita briefing antes do job
  |     '-- emite resultado estruturado depois do job
  |
  '--> Runtime Manager
        '-- ai-memory local :49374
              |-- Markdown versionado em Git
              |-- SQLite + FTS5 derivados
              |-- observações e handoffs
              '-- backups e logs próprios
~~~

O navegador fala somente com o servidor do Forge. O token e a porta do
ai-memory não chegam ao JavaScript cliente.

O runtime inicia com --enable-web porque essa flag é o contrato upstream que
monta a API JSON de leitura em /api/v1. A UI nativa do ai-memory não será
exposta diretamente; o Forge Nexus usa apenas a API por trás do próprio proxy.

## 7. Organização no repositório

### 7.1 Fonte incorporada

- integrations/ai-memory/: subtree da tag v1.13.0.
- integrations/ai-memory/LICENSE: licença upstream preservada.
- THIRD_PARTY_NOTICES.md: atribuição, versão, commit e URL do upstream.
- docs/plans/: desenho e plano de atualização.

O fluxo de atualização deverá buscar uma tag explícita, mostrar o diff do
subtree, rodar as suítes Rust e Forge e registrar a nova versão. Nunca seguirá
main automaticamente.

### 7.2 Camada Forge

A implementação poderá ajustar nomes durante o plano, mas seguirá estas
responsabilidades:

- maestro/memory/runtime.mjs: localizar, instalar, iniciar, parar de forma
  segura, sondar e atualizar o executável.
- maestro/memory/gateway.mjs: cliente autenticado para as APIs públicas.
- maestro/memory/scopes.mjs: factory, apps e runs.
- maestro/memory/briefing.mjs: seleção, limites e formatação do contexto.
- maestro/memory/events.mjs: contrato dos eventos estruturados.
- maestro/memory/outbox.mjs: persistência e reenvio quando offline.
- maestro/memory/importer.mjs: descoberta, prévia, redaction e importação.
- maestro/memory/redaction.mjs: política adicional sobre o redator existente.
- maestro/memory/catalog.mjs: ações e schemas expostos ao control plane.

### 7.3 Dados locais

Código e dados não serão misturados:

- o subtree fica versionado no Forge;
- runtime, token, banco, wiki e logs ficam sob o diretório local do Forge Nexus,
  preferencialmente %LOCALAPPDATA%\ForgeNexus;
- a wiki do ai-memory mantém seu próprio histórico Git;
- o checkout do Forge não fica sujo durante a operação normal;
- o diretório de dados nunca será servido como arquivo estático.

## 8. Gerenciamento do runtime

### 8.1 Estado

O Runtime Manager expõe uma máquina de estados:

- unconfigured;
- installing;
- starting;
- healthy;
- degraded;
- recovering;
- update_available;
- migration_required;
- stopped.

### 8.2 Instalação zero-command

O código-fonte incorporado é a referência auditável. O executável será obtido
por uma destas fontes, na ordem:

1. artefato Forge produzido em CI a partir do subtree e acompanhado de SHA-256;
2. artefato oficial da mesma tag upstream, também com SHA-256;
3. build local somente quando Rust compatível já estiver disponível.

O Nexus não instalará Rust globalmente. Download, extração e troca de versão
usarão diretório temporário, verificação de checksum e rename atômico. A versão
anterior será mantida até o novo health check passar.

### 8.3 Processo

- bind exclusivo em 127.0.0.1;
- porta padrão 49374, com detecção de conflito;
- token aleatório criado pelo Forge e fornecido ao processo por ambiente;
- ambiente do processo construído por allowlist; credenciais de providers e
  outros projetos não são herdadas automaticamente;
- spawn com shell false, janela oculta no Windows e argumentos allowlisted;
- PID e metadados da instância gerenciada persistidos;
- nunca encerrar um processo desconhecido apenas porque ocupa a porta;
- se já houver ai-memory legítimo e compatível, o Nexus mostrará o conflito e
  oferecerá adoção explícita ou outra porta.

## 9. Escopos

O workspace lógico será forge.

| Escopo | Projeto lógico | Conteúdo |
|---|---|---|
| fábrica | factory | regras e padrões gerais |
| app | app-<appId> | produto, arquitetura, deploy e aprendizados |
| run | metadado runId | tentativas, evidências e resultado da execução |
| handoff | factory ou app | continuidade entre jobs e agentes |

O engine sempre envia workspace e project explicitamente. Não dependerá do
cwd para separar apps, porque o Forge contém o repositório da fábrica e
repositórios de app com fronteiras próprias.

Busca cruzada entre apps não ocorre por padrão. Quando útil, o usuário poderá
ativá-la explicitamente na tela e verá quais projetos serão consultados.

## 10. Modelo de memória

Os registros Forge terão tipos explícitos:

- decision;
- error-resolution;
- verification;
- handoff;
- product-learning;
- rule;
- outcome.

Campos mínimos:

| Campo | Uso |
|---|---|
| schemaVersion | evolução do contrato |
| type | tipo listado acima |
| workspace/project | isolamento |
| appId/runId/job | rastreabilidade da pipeline |
| actor/player/provider | origem operacional |
| summary | conteúdo curto e redigido |
| evidenceRefs | caminhos, commits, comandos ou IDs |
| outcome/status | pass, fail, blocked, decided |
| sourceHash | idempotência e deduplicação |
| createdAt/observedAt | idade e ordenação |
| sensitivity | public, internal ou restricted |

As páginas semânticas continuam no formato canônico do ai-memory. Os campos
Forge entram como frontmatter e observações estruturadas, não como tabelas
SQLite abertas diretamente pelo Node.

## 11. Ciclo de um job

### 11.1 Antes da execução

1. Resolver factory, app, run, job e player.
2. Consultar briefing com timeout curto.
3. Limitar quantidade, tamanho e idade conforme o tipo de job.
4. Excluir memória superseded, conflitante ou de outro app.
5. Redigir novamente a resposta defensivamente.
6. Injetar por untrustedBlock com fonte e data visíveis.

O briefing não poderá ultrapassar o orçamento definido para o prompt. O limite
inicial recomendado é oito itens e 12 KiB totais, ajustável por profile.

### 11.2 Durante a execução

O engine mantém eventos pequenos em memória. Não envia stdout bruto nem cada
token do agente. Tentativas registram somente:

- classe do erro;
- trecho final já redigido e limitado;
- player/provider;
- exit code;
- verify que falhou;
- ação de recovery escolhida.

### 11.3 Depois da execução

Após verify, o engine emite um evento idempotente com resumo, evidência e
resultado. Decisões de gate são memorizadas somente depois de efetivamente
registradas pelo control plane.

Se o ai-memory não responder, o evento vai para a outbox privada e a pipeline
segue. O reenvio preserva a chave de idempotência para não criar duplicatas.

## 12. Handoffs e regras

- Handoffs continuam existindo no workbench; a memória é índice e continuidade,
  não substituta da evidência versionada.
- Uma observação de agente nunca vira rule automaticamente.
- O usuário pode promover uma decisão a regra permanente na interface.
- Toda rule mostra origem, autor, data, escopo e opção de supersede.
- Conflitos aparecem lado a lado e não são silenciosamente resolvidos por LLM.
- Gate humano continua sendo a autoridade para deploy, kill, billing, domínio,
  credencial e escolhas de design.

## 13. Importação inicial

### 13.1 Fontes permitidas

- documentação Markdown versionada;
- workbench/HANDOFF.md e entradas finalizadas relevantes;
- histórico de commits, usando metadados e mensagem;
- pipelines, gates e resultados objetivos do engine;
- relatórios de verificação;
- handoffs antigos explicitamente selecionados.

### 13.2 Exclusões

- .env e variantes;
- tokens e credenciais;
- maestro/.token e arquivos privados;
- raw logs;
- prompts externos completos;
- node_modules, builds e caches;
- conteúdo binário;
- dados de outro projeto;
- entradas que falhem na redaction ou na classificação de sensibilidade.

### 13.3 Assistente visual

O fluxo será:

1. descobrir;
2. classificar;
3. redigir;
4. deduplicar;
5. mostrar prévia e motivo;
6. permitir aceitar, editar ou ignorar;
7. importar em lotes resumíveis;
8. mostrar relatório e itens rejeitados.

O importador guarda checkpoint e sourceHash. Repetir a operação é seguro.

## 14. Interface do Forge Nexus

A identidade visível muda de Maestro Control Center para Forge Nexus. A
primeira fase mantém URLs, nomes de arquivo e variáveis antigas como aliases.

A navegação ganha a área **Memória**, com:

- saúde e versão;
- instalação e atualização;
- busca FTS5 e por relações; reranking semântico somente quando um provider
  compatível for configurado explicitamente;
- filtros por app, run, job, agente, tipo e período;
- briefing que o próximo job receberá;
- linha do tempo;
- regras;
- erros resolvidos;
- handoffs;
- importação;
- outbox;
- backup, reconstrução e recuperação.

Cada pipeline ganha um painel contextual com:

- memórias usadas no último job;
- memória proposta pelo job atual;
- conflitos e itens desatualizados;
- fonte exata;
- promoção para regra;
- exclusão ou supersede com confirmação.

Falhas usam ações compreensíveis: Tentar novamente, Reconstruir índice,
Continuar sem memória, Restaurar versão anterior ou Ver detalhes. A interface
não instrui o usuário a abrir o terminal.

## 15. APIs do Forge

O servidor exporá somente contratos próprios, por exemplo:

- GET /api/memory/status;
- GET /api/memory/overview;
- GET /api/memory/search;
- GET /api/memory/briefing;
- GET /api/memory/pages/...;
- POST /api/memory/setup;
- POST /api/memory/import/preview;
- POST /api/memory/import/apply;
- POST /api/memory/actions.

Todas passam pelo token e pelas proteções same-origin existentes do Forge.
Mutations usam o dispatcher, operação idempotente, nonce de confirmação quando
destrutivas e auditoria redigida.

O gateway mantém uma base URL interna fixa e validada. Não haverá proxy HTTP
aberto nem URL arbitrária fornecida pelo browser.

## 16. Segurança

1. Loopback por padrão e sem CORS aberto.
2. Token do ai-memory armazenado por writePrivateFile/openPrivateFile ou
   equivalente com ACL apropriada.
3. Token nunca incluído em snapshot, SSE, log, audit payload ou frontend.
4. Redaction antes da outbox e antes do envio ao ai-memory.
5. Conteúdo recuperado tratado como não confiável e envelopado.
6. Limites de bytes, itens, tempo e profundidade em todas as consultas.
7. Paths de página validados contra traversal.
8. Operações administrativas allowlisted.
9. Nenhum spawn com shell true.
10. Checksum e versão obrigatórios para runtime.
11. Upgrade com rollback se health ou migração falhar.
12. Licença e copyright upstream preservados.
13. Zero-LLM é o modo inicial; nenhum provider, chave ou OAuth é herdado ou
    ativado sem ação explícita na central.

## 17. Falhas e recuperação

| Falha | Comportamento |
|---|---|
| serviço offline | briefing vazio, outbox e pipeline continua |
| timeout | cancelar request; não atrasar o job indefinidamente |
| token inválido | degraded; não regenerar destrutivamente |
| porta ocupada | não matar processo; oferecer adoção ou outra porta |
| índice SQLite corrompido | reconstruir a partir da wiki após confirmação |
| wiki inconsistente | preservar arquivos, reportar e oferecer restore |
| upgrade falhou | manter ou restaurar runtime anterior |
| outbox repetida | sourceHash impede duplicação |
| memória conflitante | mostrar conflito; não eleger verdade sozinho |
| import interrompido | retomar do checkpoint |

## 18. Observabilidade

O snapshot do Nexus incluirá somente:

- estado e versão do runtime;
- latência e último health;
- workspace/projetos conhecidos;
- total de páginas;
- outbox pendente;
- último briefing;
- último backup;
- última importação;
- erros redigidos;
- atualização disponível.

Cada job registra quantas memórias foram consideradas, usadas e descartadas,
sem copiar o conteúdo para logs.

## 19. Testes

### 19.1 Unitários

- resolução de escopo;
- limites de briefing;
- deduplicação por sourceHash;
- redaction e classificação;
- serialização dos sete tipos;
- validação de paths e base URL;
- outbox e backoff;
- manifest e checksum do runtime.

### 19.2 Contrato

Um servidor falso do ai-memory cobre:

- auth;
- health;
- overview;
- search;
- briefing;
- hook/captura;
- MCP necessário;
- erros 400, 401, 403, 404 e 500;
- timeout e resposta inválida.

### 19.3 Integração

- memória anterior entra no prompt protegido;
- job verificado gera memória estruturada;
- dois apps não enxergam a memória um do outro;
- retry registra solução sem raw log;
- restart drena a outbox;
- gate memorizado não é autoaprovado;
- importação repetida não duplica;
- reconstrução restaura a busca;
- pipeline passa com o serviço desligado.

### 19.4 Interface

- setup e importação sem terminal;
- busca, filtros, briefing e fontes;
- estados healthy/degraded/recovering;
- confirmação destrutiva;
- navegação por teclado;
- 375, 768, 1024 e 1440 px sem overflow;
- zero erros no console.

### 19.5 Verificação global

- npm test;
- npm run typecheck;
- npm run build:all;
- testes Rust relevantes no subtree;
- smoke real do runtime em loopback;
- smoke de pipeline com e sem memória;
- scan de segredos no diff e nos dados importados de teste.

## 20. Sequência de entrega

1. Incorporar subtree, licença, notice e manifest.
2. Criar Runtime Manager com testes e health real.
3. Criar Memory Gateway e servidor falso de contrato.
4. Implementar escopos, briefing, eventos e outbox.
5. Integrar o ciclo do engine sem mudar gates.
6. Expor status e ações no control plane.
7. Renomear a identidade visível para Forge Nexus.
8. Construir a área Memória e o painel contextual.
9. Implementar importador com prévia.
10. Executar verificação global e escrever handoff adversarial.

Cada passo será um commit pequeno e reversível. O plano detalhado deverá
colocar testes antes da implementação e manter a suíte verde ao fim de cada
commit.

## 21. Critérios de aceite

- Um clone normal contém o código do ai-memory.
- Duplo clique no launcher abre o Forge Nexus.
- A tela instala e inicia o runtime sem comandos e sem instalar Rust.
- A importação inicial apresenta prévia e não grava segredos.
- Um job recebe briefing relevante do app correto.
- Um job concluído gera memória rastreável e deduplicada.
- Restart preserva a memória e drena eventos pendentes.
- Dois apps permanecem isolados.
- Busca, regras, handoffs e recuperação funcionam pelo navegador.
- Serviço desligado não bloqueia a pipeline.
- Gates humanos continuam invariantes.
- Nenhum token chega ao browser ou aos logs.
- Upgrade verifica checksum e faz rollback em falha.
- Licença MIT e autoria de Fabio Akita permanecem visíveis.
- Testes Node, Rust, typecheck, builds e smokes ficam verdes.

## 22. Autoridade e próximos passos

Este documento autoriza a escrita de um plano de implementação. Ele não
autoriza push, deploy, publicação, mudança de credencial, instalação global de
hooks nem execução de operações destrutivas.

Depois da revisão deste design:

1. escrever o plano por tarefas e commits;
2. revisar o plano contra esta especificação;
3. solicitar aprovação do plano;
4. implementar em iterações verificadas.
