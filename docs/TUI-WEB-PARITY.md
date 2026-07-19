# Matriz de paridade — TUI × Control Center web

Estado observado em 2026-07-18. A **TUI é a superfície primária** do fluxo discovery-first; o Control Center web permanece como interface legada enquanto suas mudanças locais são reconciliadas.

| Área | Servidor / contrato | TUI | Web legado | Evidência e lacunas |
|---|---|---|---|---|
| Providers / executores | **Completo** | **Parcial** | **Completo legado** | O servidor lista roster e permite escolher player por turno. A TUI seleciona executor no chat/playbook; administração completa de providers/times ainda está no web/CLI. |
| Profiles | **Completo legado** | **Somente leitura indireta** | **Completo legado** | Biblioteca e profile congelado por run continuam preservados. A TUI discovery ainda não administra profiles. |
| Blueprints | **Completo legado** | **Somente no brief de build** | **Completo legado** | Versionamento/linhagem permanece no servidor e web. A TUI envia o blueprint pelo formulário catalog-driven, sem studio próprio. |
| Room / chat | **Completo** | **Completo para o MVP** | **Sem paridade discovery** | Room canônica, chat multi-host por turno, SSE e fallback sem resume cobertos por testes; transcript privado não entra no snapshot público. |
| Tese / evidência / experimento | **Completo para o MVP** | **Completo para ações do catálogo** | **Sem paridade discovery** | Promoção humana, E1/E2/E3, evidência verificada/sintética, playbooks e experimentos estão expostos na TUI. Regras ficam server-side. |
| Build / run / gates | **Completo e retrocompatível** | **Parcial amplo** | **Completo legado** | A TUI propõe/inicia/conclui/termina build discovery e mostra gates; console detalhado de runs, previews e algumas operações legadas ainda são mais completos no web/CLI. `pipeline.start` não existe para produto novo. |
| Lifecycle / handoff | **Completo para o MVP** | **Completo nas ações Task 8** | **Parcial legado** | TUI alcança validation asset, Braga prepare/export/import, acquisition e spend approval. P4/P5 e visualização histórica rica ainda não têm paridade integral de apresentação. |

## Segurança e operação

- Coding agents usam CLIs de **subscription**; não há fallback paygo autorizado.
- WIP server-side: 3 teses em validação, 1 build e 1 aquisição.
- Promoção de tese, build e ações externas exigem as confirmações definidas no catálogo/dispatcher.
- Gasto exige confirmação separada, `why` e teto; orçamento zero não concede autorização futura.
- First Customer Finder gera shortlist e abertura sugerida; não envia outreach.
- Publicação e deploy não ocorrem por padrão.

## Evidência de verificação desta entrega

- `maestro/test/discovery-e2e.test.mjs`: fake executors atravessando HTTP/control plane, workspace, playbooks, build bridge, Braga e lifecycle.
- `npm run tui:test`: cliente, SSE, input, catálogo, IDs pós-build/Braga e payloads tipados.
- `npm run tui:build`: TypeScript da TUI.
- A skill `verify` não estava disponível no catálogo Codex usado nesta execução. A substituição registrada foi E2E com fake executors e testes da TUI; isso **não equivale** a smoke físico.
- O bootstrap `npm run tui` foi verificado em Windows Terminal real em 2026-07-18. Navegação completa por teclado e smoke com executor de subscription autenticado permanecem **não verificados** até execução explícita posterior.

## Decisão sobre a web

A remoção de `maestro/index.html`, `maestro/control-center.js`, `maestro/control-center.css`, rotas, scripts e testes web está **adiada para uma mudança separada** porque:

1. existem modificações locais não reconciliadas no Control Center;
2. a matriz mostra paridade incompleta em administração de providers/profiles/blueprints, console detalhado de runs e apresentação de lifecycle;
3. remover a web junto com discovery impediria separar regressão funcional de reconciliação de UI.

Esta entrega não toca nem remove arquivos, rotas, scripts ou testes da web.
