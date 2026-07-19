# HANDOFF — ETAPA 1 Discovery Studio

> Estado preparado em 2026-07-19. Este documento é o ponto de entrada autoritativo da próxima sessão.

## Resultado desejado

Transformar a atual **ETAPA 1 · ROOM** em um espaço de investigação que ajude Guilherme a sair de uma ideia vaga para poucas hipóteses bem estruturadas, com ramificações, pesquisa rastreável, memória útil e mapa visual — sem confundir geração de LLM com validação real.

A experiência principal continua simples:

```text
forgenexus
> digite a ideia
Enter
```

Depois disso, ações opcionais aprofundam a room:

```text
:explore   → alternativas com linhagem e restrições
:research  → perguntas, buscas, fontes e candidatos de evidência
:map       → canvas visual do estado canônico
```

## Decisão de produto

O Forge deve ter duas superfícies complementares, não uma pseudo-GUI no terminal:

1. **TUI prompt-first:** conversa, streaming, comandos curtos, progresso e navegação por teclado como Codex/Claude Code.
2. **Discovery Canvas web:** árvore de ideias, fontes, mapa e detalhes realmente clicáveis, com equivalência de teclado.

O terminal não deve sugerir clique. O canvas não vira uma segunda fonte de verdade: ele renderiza o `DiscoveryWorkspace` e dispara ações do mesmo catálogo.

## Estado atual verificado

- `maestro/tui/src/app.tsx` agora possui composer real: digitar mostra o texto e `Enter` envia sem `Tab` ou paleta.
- Se não houver room, a primeira mensagem executa `room.create` e `chat.send` em sequência, usando Codex como executor padrão instalado.
- `↑`/`↓` trocam rooms e `←`/`→` trocam teses sem ciclo de focos mortos.
- `?` explica que a TUI é keyboard-first; `Ctrl+N` cria outra room; `Ctrl+U` limpa o prompt.
- Formulários usam `↑`/`↓` para campo e `←`/`→` para opção; submissão duplicada é bloqueada.
- Teses agora são filtradas pela room e a tese selecionada tem marcador visível.
- O launcher `scripts/forgenexus.mjs` compara o fingerprint do código carregado com o código em disco e reinicia um Maestro obsoleto somente quando não há operação ativa.
- Maestro local foi atualizado: snapshot expõe `server.pid`, `server.startedAt` e `server.sourceFingerprint`.
- Tutorial HTML/Markdown e quatro PNGs foram atualizados para o fluxo “digite + Enter”.
- Verificações desta sessão: TUI `19/19`, build TypeScript da TUI PASS, direcionados do servidor `10/10`, fingerprint e snapshot live PASS.

## Diagnóstico que motivou a mudança

A TUI anterior parecia interativa, mas o `mensagem ›` era apenas texto estático. O modo normal descartava caracteres e `Enter`; `Tab` levava a três focos sem handlers; setas só funcionavam em `navigation`; os símbolos de ação pareciam botões, mas não existia mouse. Três agentes reproduziram o mesmo bloqueio de forma independente.

A correção prompt-first resolve o bloqueio imediato. A ETAPA 1 maior resolve o problema de produto: hoje a room guarda uma conversa linear, mas não oferece exploração de alternativas, pesquisa estruturada, proveniência, memória recuperável ou síntese visual.

## Análise dos quatro repositórios

Snapshot observado em 2026-07-19. Fixar estas revisões para qualquer spike; não acompanhar `main` silenciosamente.

| Projeto | O que oferece | Licença | Decisão |
|---|---|---|---|
| [STORM](https://github.com/stanford-oval/storm/tree/fb951af7744dab086e34962e9bc6fe878e145f83) | perspectivas, perguntas de acompanhamento, busca, citações, outline e mind map | MIT | adaptar contratos e fluxo; sidecar apenas para benchmark |
| [ai-brainstorm](https://github.com/mikecreighton/ai-brainstorm/tree/8bff488cdb823eecdcebfefaff870cdca7e34e72) | árvore de ideias, diretivas criativas, restrições, avaliação e checkpoint | MIT | portar seletivamente para TypeScript; não usar o motor Python |
| [Khoj](https://github.com/khoj-ai/khoj/tree/1e30154d1070c7b132f389638c008b490be1481b) | pesquisa em web/docs, fontes, memória, cancelamento, agentes e RAG | AGPL-3.0 | referência clean-room; não copiar nem embutir |
| [DeepDiagram](https://github.com/LingyiChen-AI/DeepDiagram/tree/b37398463b6ed169019d9eb4a89cae5abfcc1e02) | chat + canvas, branching, SSE, renderers e exportação | AGPL-3.0 | referência visual clean-room; não copiar backend/frontend |

### STORM

Valor principal: transformar um tópico em perspectivas, lacunas, perguntas, queries e informações citáveis. O contrato `Information` preserva URL, título, snippets, pergunta e query; no Forge isso deve virar `EvidenceCandidate`, nunca evidência verificada. O Co-STORM também demonstra moderador, especialistas e mapa vivo.

Não trazer: geração de artigo, UI Streamlit, persistência em diretórios, LiteLLM, embeddings/API keys ou dezenas de buscas automáticas. A stack Python/DSPy é pesada e conflita com executores subscription-only. O projeto é popular, mas se declara alpha e não possui suíte de testes abrangente.

Referências: [engine](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/knowledge_storm/storm_wiki/engine.py), [curadoria](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/knowledge_storm/storm_wiki/modules/knowledge_curation.py), [personas](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/knowledge_storm/storm_wiki/modules/persona_generator.py), [KnowledgeBase](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/knowledge_storm/dataclass.py), [licença MIT](https://github.com/stanford-oval/storm/blob/fb951af7744dab086e34962e9bc6fe878e145f83/LICENSE).

### ai-brainstorm

Valor principal: linhagem explícita e operadores criativos como inversão de premissas, mudança de perspectiva, mistura conceitual e integração de ecossistema. Restrições e critérios ficam explícitos; cada ramo pode ser aprofundado, combinado, escolhido ou arquivado.

Não trazer: clientes OpenAI/Groq/OpenRouter, MCTS completo, score único do próprio LLM, HTML atual ou fluxo que exige editar `main.py`. É um protótipo de seis commits, sem CI/testes/releases. Há bugs concretos no `continue`, seleção UCB e renderização com `innerHTML` sem escape. Toda saída importada deve ser marcada `synthetic`.

Referências: [README](https://github.com/mikecreighton/ai-brainstorm/blob/8bff488cdb823eecdcebfefaff870cdca7e34e72/README.md), [diretivas](https://github.com/mikecreighton/ai-brainstorm/blob/8bff488cdb823eecdcebfefaff870cdca7e34e72/creative_directives.py), [árvore](https://github.com/mikecreighton/ai-brainstorm/blob/8bff488cdb823eecdcebfefaff870cdca7e34e72/node.py), [MCTS](https://github.com/mikecreighton/ai-brainstorm/blob/8bff488cdb823eecdcebfefaff870cdca7e34e72/mcts.py), [licença MIT](https://github.com/mikecreighton/ai-brainstorm/blob/8bff488cdb823eecdcebfefaff870cdca7e34e72/LICENSE).

### Khoj

Valor principal: pesquisa acionada dentro da conversa, fontes visíveis, filtros de escopo, progresso, cancelamento e memória separada da evidência. Adaptar o conceito de `:research` com escopo `web | files | history`, preservando URL, trecho, data, query e método de coleta.

Não trazer: produto inteiro, Django/FastAPI/PostgreSQL/pgvector/Torch/SearxNG, automações ou RAG completo. Além do peso operacional, Khoj é AGPL e sua direção de produto mudou após o encerramento anunciado do cloud.

Referências: [chat](https://github.com/khoj-ai/khoj/blob/1e30154d1070c7b132f389638c008b490be1481b/documentation/docs/features/chat.md), [research router](https://github.com/khoj-ai/khoj/blob/1e30154d1070c7b132f389638c008b490be1481b/src/khoj/routers/research.py), [modelos](https://github.com/khoj-ai/khoj/blob/1e30154d1070c7b132f389638c008b490be1481b/src/khoj/database/models/__init__.py), [licença AGPL](https://github.com/khoj-ai/khoj/blob/1e30154d1070c7b132f389638c008b490be1481b/LICENSE).

### DeepDiagram

Valor principal: layout chat + canvas, streaming progressivo, versões ramificadas, detalhe por nó e exportação. O Forge deve gerar o mapa deterministicamente a partir de IDs e relações canônicas; o LLM pode sugerir agrupamentos, mas não inventar o grafo.

Não trazer: seis renderers, LangGraph/LangChain, parser XML do modelo, configuração de chave pela UI ou stack Python/PostgreSQL. É AGPL, jovem, praticamente sem testes e com um único contribuidor predominante.

Referências: [dispatcher](https://github.com/LingyiChen-AI/DeepDiagram/blob/b37398463b6ed169019d9eb4a89cae5abfcc1e02/backend/app/agents/dispatcher.py), [branching](https://github.com/LingyiChen-AI/DeepDiagram/blob/b37398463b6ed169019d9eb4a89cae5abfcc1e02/backend/app/models/chat.py), [canvas](https://github.com/LingyiChen-AI/DeepDiagram/blob/b37398463b6ed169019d9eb4a89cae5abfcc1e02/frontend/src/components/CanvasPanel.tsx), [licença AGPL](https://github.com/LingyiChen-AI/DeepDiagram/blob/b37398463b6ed169019d9eb4a89cae5abfcc1e02/LICENSE).

## Arquitetura alvo da ETAPA 1

```text
TUI prompt-first ───────────────┐
                               │ ações/eventos
Discovery Canvas web ──────────┤
                               ▼
                    catálogo + dispatcher
                               ▼
                     DiscoveryWorkspace v2
        ┌───────────────┬───────────────┬───────────────┐
        │ idea branches │ research runs │ source/candidates│
        └───────────────┴───────────────┴───────────────┘
                               │
                    players subscription-only
                               │
              search adapter + fontes públicas
```

### Subetapas internas

1. **1A Intake:** primeira mensagem cria a room; agente extrai problema, público, restrições e dúvidas sem impor tese.
2. **1B Divergir:** `:explore` cria no máximo três ramos com diretiva e parent explícitos.
3. **1C Investigar:** `:research` propõe perspectivas e perguntas, executa buscas limitadas e grava fontes/candidatos.
4. **1D Recuperar:** busca simples em rooms, mensagens e artefatos locais; memória pessoal nunca conta como fonte externa.
5. **1E Sintetizar:** canvas mostra ramos, lacunas, contradições e fontes; usuário escolhe/combina um ramo.
6. **Saída:** somente uma ação humana promove o ramo escolhido para proposta de tese da ETAPA 2.

### Estado canônico mínimo

```ts
IdeaBranch {
  id, roomId, parentId, text, directive, constraints,
  status: "active" | "selected" | "archived",
  provenance: "synthetic", createdAt
}

ResearchRun {
  id, roomId, branchId, perspectives, questions,
  scope: "web" | "files" | "history",
  status, maxQueries, startedAt, endedAt
}

SourceRecord {
  id, runId, url, title, snippet, retrievedAt,
  perspective, question, query, method
}

EvidenceCandidate {
  id, roomId, branchId, sourceId, observation, inference,
  polarity, status: "unverified" | "promoted" | "rejected"
}
```

O `DiscoveryWorkspace` precisa de migração explícita de schema v1 para v2; nunca alterar silenciosamente `.control/discovery/workspace.json` sem backup e teste de restart.

### Ações e eventos propostos

- `discovery.explore.start`, `discovery.explore.stop`
- `discovery.branch.select`, `discovery.branch.combine`, `discovery.branch.archive`
- `discovery.research.start`, `discovery.research.stop`
- `discovery.candidate.promote`, `discovery.candidate.reject`
- `discovery.map.export`, `discovery.workspace.open`
- eventos: `perspective.generated`, `question.proposed`, `query.planned`, `source.retrieved`, `candidate.created`, `branch.updated`, `map.updated`

Toda ação longa precisa de `runId`, streaming, cancelamento, limite explícito e idempotência. Nenhuma execução pode começar duas vezes por Enter repetido.

## Plano da próxima sessão

Executar em fatias testáveis; não começar instalando dependências externas.

1. **T0 — Contrato e migração:** escrever testes do schema v2, backup/restart e contratos das ações; preservar fixtures v1.
2. **T1 — Ramos nativos:** implementar `IdeaBranch`, três diretivas iniciais, selecionar/combinar/arquivar e TUI prompt-first. Sem MCTS.
3. **T2 — Pesquisa rastreável:** criar interface `SearchAdapter`, runner cancelável e `EvidenceCandidate`; primeiro adapter pode usar Agent Reach/gh/web fora do core, sem paygo.
4. **T3 — Síntese:** transformar ramo selecionado em draft de tese somente por ação humana; candidatos continuam sem abrir E1/E2.
5. **T4 — Canvas mínimo:** uma view web com árvore room → branches → sources/candidates; mouse e teclado; detalhe da fonte; sem renderer múltiplo.
6. **T5 — Memória leve:** busca textual/local por room e artefatos; medir necessidade antes de embeddings/pgvector.
7. **T6 — Benchmark STORM:** opcional, isolado e fixado em commit; comparar perguntas/fontes contra o runner nativo. Remover se não houver ganho claro.

## Definition of Done

- `forgenexus` continua aceitando texto + `Enter` no primeiro segundo de uso.
- Uma room vazia vira room + mensagem com uma submissão lógica.
- `:explore` gera no máximo três ramos, cada um com parent, diretiva e `synthetic` visíveis.
- Usuário consegue escolher, combinar e arquivar sem editar JSON.
- `:research` mostra progresso e pode ser interrompido.
- Cada candidato preserva URL, trecho, data, perspectiva, pergunta e query.
- Candidato não revisado nunca satisfaz E1/E2.
- Canvas e TUI refletem o mesmo snapshot; reload/restart não perde estado.
- Canvas é operável por mouse e teclado; TUI não promete mouse.
- Nenhum código AGPL copiado; nenhuma API paygo adicionada como motor de agente.
- Testes cobrem migração v1→v2, restart, idempotência, cancelamento, zero rooms, pesquisa parcial e XSS em conteúdo de LLM.
- Handoff/QUEUE/CLAIMS atualizados; sem deploy, commit ou push automático.

## Fora de escopo inicial

- Fork integral de STORM, Khoj, DeepDiagram ou ai-brainstorm.
- Geração de artigo longo.
- MCTS autônomo de 100+ iterações.
- RAG completo, embeddings, pgvector, SearxNG ou ingestão multimodal.
- Seis tipos de diagrama, LangGraph ou escolha automática de renderer.
- Promoção automática de tese/evidência/gate.
- Outreach, publicação, gasto ou deploy.

## Arquivos locais para ler primeiro

1. Este handoff.
2. `AGENTS.md`.
3. `workbench/HANDOFF.md`, `workbench/QUEUE.md`, `workbench/CLAIMS.md`.
4. `maestro/discovery/workspace.mjs`, `store.mjs`, `model.mjs`, `playbooks.mjs`.
5. `maestro/executor-run-service.mjs` e `maestro/control/{catalog,handlers,dispatcher,snapshot}.mjs`.
6. `maestro/tui/src/app.tsx` e `maestro/tui/test/discovery-flow.test.tsx`.
7. `maestro/control-center.js` e `docs/TUI-WEB-PARITY.md` antes de decidir onde nasce o canvas.

## Prompt exato para a nova sessão

```text
Continue C:\Dev\forge a partir de docs/HANDOFF-ETAPA-1-DISCOVERY-STUDIO.md.

Leia AGENTS.md e os três arquivos do workbench. Preserve todas as mudanças não commitadas e não rode git add/commit/push/deploy.

Implemente somente T0 e T1 do handoff, test-first: schema/migração v2 + IdeaBranch nativo com no máximo três ramos. Não instale STORM/Khoj/DeepDiagram/ai-brainstorm, não copie código AGPL e não adicione API paygo. Mantenha digitar+Enter como fluxo principal. Atualize HANDOFF/QUEUE/CLAIMS e pare depois dos critérios de T1 verificados.
```

## Observação sobre o working tree

O repositório já estava muito modificado e contém trabalho paralelo. Trate todas as mudanças existentes como pertencentes ao usuário. Não use reset/checkout destrutivo, não limpe untracked e não suponha que arquivos fora do escopo desta sessão podem ser removidos.
