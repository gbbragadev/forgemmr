# GPT-5.6 Sol Ultra — plano de implementação

**Data:** 2026-07-13  
**Branch:** `feat/gpt56-optimization`  
**Base real:** `240fd22`  
**Referência auditada:** `0423528`

## Restrições globais

- Uma tarefa por commit lógico, com ID na mensagem.
- Para mudança comportamental: RED comprovado antes de produção, GREEN específico e `npm test` ao fim.
- Preservar `package-lock.json` preexistente e os scratch dirs `.claude/` / `.codebase-memory/` fora dos commits.
- Não tocar `maestro/roster.json`, apps reais fora da tarefa, pipelines/runs existentes ou Git do repo pai por engano.
- Nenhum push, merge, deploy, cobrança, credencial, banco, fila, serviço novo ou API paga por chamada.
- Dry-run continua fake/sem quota; gates humanos e guards anti-walk-up permanecem.
- `pipeline.cooldowns` continua serializado; tails visíveis precisam estar redigidos e limitados.
- T-03 obrigatoriamente antes de T-05.
- T-13 ocorre no Git próprio de `apps/doki-call`; sem publicação.

## Decisões por tarefa

| ID | Decisão | Arquivos previstos | Verificação principal | Dependências | Status inicial |
|---|---|---|---|---|---|
| T-14 | **ADAPTED** — criar CI separado de testes; não alegar que F-28/workflow de deploy foi corrigido | `.github/workflows/test.yml` | validar YAML/estrutura local + `npm test`; GitHub verde exige push e fica não verificado | nenhuma | PENDING |
| T-01 | **ACCEPTED** | `package.json` | `npm run build:all` inclui 4 apps e sai 0 no Windows | T-14 | PENDING |
| T-03 | **ACCEPTED** | `maestro/adapters.mjs`, `engine.mjs`, `fake-exec.mjs`, teste novo | teste unitário + integração de exit 0 mencionando 429; suíte | Onda 0 | PENDING |
| T-04 | **ACCEPTED** | `maestro/engine.mjs`, teste novo | JSON truncado logado; save final válido sem `.tmp`; suíte | T-03 | PENDING |
| T-02 | **ADAPTED** — unificar target local e preservar alias legado se houver estado; não alegar recuperação do deploy legado | `maestro/deploy.mjs`, teste de contrato | todos os targets da engine são tratados; suíte; sem deploy | T-04 | PENDING |
| T-06 | **ACCEPTED** | `maestro/engine.mjs`, teste novo | todo player de time gerado possui fallback; solo não quebra | T-02 | PENDING |
| T-05 | **ACCEPTED** | `maestro/engine.mjs`, teste novo | cooldown compartilhado no manager afeta outra pipeline; estado local preservado | T-03, T-06 | PENDING |
| T-07 | **ACCEPTED** | `maestro/engine.mjs`, `forge.mjs`, characterization | tail redigido ≤500 no snapshot/TUI; caracterização atualizada; suíte | T-05 | PENDING |
| T-08 | **ACCEPTED** | prompt P0, PLAYBOOK, engine verify, fake-exec, teste | Mercado incompleto reprova; completo passa; dry-run chega a `p0-go` | Onda 1 | PENDING |
| T-09 | **ACCEPTED** | `maestro/engine.mjs`, fake-exec, teste | GO condicionado pausa em `p1-signal`; GO simples não ganha gate | T-08 | PENDING |
| T-13 | **ACCEPTED** | repo próprio `apps/doki-call`: checkout route, UI e i18n | build:doki; nenhuma resposta `paid` sem PSP; fluxo honesto PT/EN; sem deploy | T-09 | PENDING |
| T-10a | **BLOCKED em produção / ADAPTED local** — não inventar persistência serverless | app(s) com telemetria, somente se destino existente for comprovado | append local sobrevive restart; produção só fecha com destino durável real | decisão de host/destino | BLOCKED |
| T-11 | **ACCEPTED** | `maestro/engine.mjs`, teste | todos os conteúdos não confiáveis envelopados e delimitadores neutralizados | Onda 1 | PENDING |
| T-16 | **ACCEPTED** | `maestro/engine.mjs`, teste | duas tentativas com mesma base invocam improver uma vez | T-11 | PENDING |
| T-15 | **ACCEPTED** | `maestro/engine.mjs`, fake-exec, teste | artefato oco reprova; válido passa; dry-run permanece verde | T-16 | PENDING |
| T-12 | **ADAPTED** — fixar apenas versões comprovadas localmente | `maestro/deploy.mjs` | zero `@latest`; versões vêm de instalação/lock atuais; sem deploy | T-15 | PENDING |
| T-20 | **ACCEPTED com testes locais** | `maestro/server.mjs`, writers de prompt/raw log, testes | SSE sem ACAO; logger redige; arquivos sensíveis 0600; cleanup comprovado | T-12 | PENDING |
| T-10b | **ACCEPTED** | prompt P4, validação/teste | schema fixo; dois resultados comparáveis por fixture realista | Onda 3 | PENDING |
| T-17 | **ACCEPTED** | `maestro/stats.mjs`, `maestro/forge.mjs`, teste | `forge stats` agrega runs reais/fixtures e imprime três tabelas | T-10b | PENDING |
| T-18 | **DEFERRED** — backlog sem contrato executável nesta passagem | — | — | — | DEFERRED |
| T-19 | **DEFERRED** — parte da cobertura será criada pelas tarefas; deploy real continua proibido | — | — | — | DEFERRED |

## Ordem de execução

1. **Onda 0:** T-14 → T-01.
2. **Onda 1:** T-03 → T-04 → T-02 → T-06 → T-05 → T-07.
3. **Onda 3:** T-08 → T-09 → T-13 → T-10a (somente parte segura; produção permanece bloqueada se não houver destino).
4. **Onda 2:** T-11 → T-16 → T-15 → T-12 → T-20.
5. **Onda 4:** T-10b → T-17.
6. Verificação global, revisão adversarial, relatório e handoff.

Nenhuma onda começa com a anterior vermelha. Dentro de cada tarefa: teste RED → implementação mínima → teste GREEN → suíte relacionada → `npm test` → revisão do diff → commit → revisão independente.

## Gates e divergências que exigem relatório

1. **T-14:** sem push, o job GitHub Actions não pode ser observado; o arquivo e a suíte local podem ser verificados, mas o aceite remoto fica pendente.
2. **F-28:** `deploy-anime-quiz.yml` permanece fora do escopo por decisão explícita do contrato; Actions pode continuar com um workflow legado vermelho.
3. **T-02:** target local consistente não prova publicação GitHub Pages.
4. **T-10a:** não há persistência universal em Cloudflare Workers/Vercel por filesystem. Sem KV/endpoint durável já disponível e autorizado, a parte de produção fica `BLOCKED`, nunca simulada como pronta.
5. **T-12:** se uma versão não puder ser provada sem instalar/publicar, a tarefa será parcial em vez de inventar número.
6. **T-13:** o app está em produção, mas a alteração ficará somente commitada no repo local do app.

## Verificação global final

```text
npm test
npm run typecheck
npm run build:all
node --test <testes específicos por tarefa>
npm run forge -- new "gpt56 final probe" --team dry-run --dry-run
npm run forge -- status gpt56-final-probe
npm run forge -- remove gpt56-final-probe --force
```

Também serão registrados: contagem real, exit codes, builds por app afetado, comportamento não testado, tarefas bloqueadas e ausência de deploy/cobrança.
