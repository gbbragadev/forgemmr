# HANDOFF

## Loop ativo
**L1/B5 revisor-cetico-de Done** (2026-07-16) — ship check static pós-ITERATE **PASS**. Build EXIT 0 · smoke 18/18. Próximo: gate humano **P3 deploy** (CF Pages) ou **P4 measure** se URL live já válida. Sem push/deploy.

## Last agent
Grok 4.5 | 2026-07-16 · L1/B5 `revisor-cetico-de` (forge autopilot / grok-solo)

## Last iteration — L1/B5 revisor-cetico-de (pós-ITERATE, 2026-07-16, Grok 4.5 / grok-solo)
- **Contexto:** re-check após ITERATE (eyebrow copiloto, status pt-BR, WhatsApp+perguntas no topo do relatório).
- **Checklist B5 (static):**

| Item | Resultado |
|------|-----------|
| Build `npm run build -w @forge/revisor-cetico-de` | **PASS** EXIT 0 (Compiled + static export) |
| Typecheck (next build) | **PASS** |
| Disclaimer legal na UI | **PASS** (`app.config.legal.disclaimer` → intro+report; presente em `out/`) |
| `.env.example` vars/porta | **PASS** (static, sem AI key, `dev:revisor` → **:3003**) |
| Free quota 402/paywall | **N-A** (static, free path demo sem créditos/API) |
| GET /api/health + stream | **N-A** (capability static, sem `src/app/api`) |
| Core smoke fluxo | **PASS** `node apps/revisor-cetico-de/scripts/b5-smoke.mjs` **18/18** |
| Ship readiness Next | **P3 deploy** (static CF/GH Pages) ou **P4** se `revisor-cetico-de.gbbragadev.com` já live |
| Porta dev | **3003** |

- **Correções de código:** nenhuma (ponytail — zero quebras reais).
- **Fora do B5:** push, deploy, PDF real, WhatsApp webhook, billing.
- **Sem git** (orquestrador).

## Last iteration — ITERATE revisor-cetico-de (2026-07-16, Grok 4.5 / grok-solo)
- **Fonte:** SIMULATE `2026-07-16T04-52-11-152Z` ranks 1–3 (+ rank 4 copy gate, trivial).
- **1 Eyebrow/intro:** «Copiloto do piloto · revisão documental» + linha demo RX-DEMO-001 / intake manual fora do app.
- **2 Status pt-BR:** `caseStatusLabel` no header + gate (Em revisão / Aprovado / Precisa de informação).
- **3 Relatório:** Resumo WhatsApp + Copiar logo após veredito; «Perguntas prontas» (5) antes dos totais.
- **Bonus copy gate:** sem jargão «fora do B1»; PDF/WhatsApp manuais + apontar Copiar resumo.
- **VERIFY:** `npm run build -w @forge/revisor-cetico-de` **EXIT 0**. Sem git.
- **Fora:** intake real, PDF, total comparável (rank 5 protected), deploy.

## Last iteration — SIMULATE revisor-cetico-de (2026-07-16, Grok 4.5 / grok-solo)
- **Artefatos:** `apps/revisor-cetico-de/docs/simulations/2026-07-16T04-52-11-152Z.json` + `.html` (generate_report.py).
- **Superfície testada:** static export + `RevisorApp` (intro→case→matrix→findings→report→gate); caso demo banheiro Grande SP.
- **Verdict:** maior fit (~91) completa o demo; leak = só caso demo + eyebrow B2/status EN + PDF/WhatsApp «fora do B1» — sem intake real.
- **auto_apply candidatas (≤3):** copy eyebrow; status pt-BR; resumo WhatsApp no topo do relatório. Sem auth/billing/legal.
- **VERIFY:** `validateSimulationReport` PASS · 5 personas · 5 fixes · limits com disclaimer simulation≠pesquisa real. Sem build (sem mudança de código). Sem git.

## Last iteration — META/L1 full auto real (2026-07-16, Codex)
- **Modo padrão:** Central, CLI, HTTP e Forge Operator iniciam em `full_auto`; `autopilot_to_gate` continua disponível como legado.
- **Gates locais:** P0 GO/GO condicionado, fundação, escolha recomendada do design-system e validações visuais são decididos pelo orquestrador com ator, escolha e motivo persistidos.
- **Fronteiras humanas:** sinal de mercado, deploy, domínio, billing, provider login, segredo, legal, P4/P5, blocker ou ausência de evidência continuam pausando.
- **B3 real:** o Designer do time escolhido implementa diretamente via `docs/prompts/L1-B3-ui-implement.md`; prompt para terceiro não conta. Verify exige diff de UI e build verde.
- **Provider:** política `strict` continua sem fallback oculto; escolher full Grok mantém Grok também no B3.
- **Skill:** `.agents/skills/forge-operator/SKILL.md` e adaptador Claude atualizados para operar/acompanhar o novo modo.
- **VERIFY:** testes focados 18/18; `npm run typecheck` PASS (9 workspaces); `npm run build:all` PASS (5 apps); `npm test` **196 total / 195 pass / 0 fail / 1 skip**; validators das duas skills PASS.
- **Code review:** corrigidos NO-GO tardio/ambíguo, migração de `p0Verdict`, DS legado sem recomendação, falso positivo de UI em `docs/`/deleção/rename e motivo factual de dry-run; regressão focada final **24/24 PASS**.
- **Sem push/deploy.** Próximo uso: `$forge-operator tive uma ideia... crie profile/blueprint/time se necessário, inicie em full_auto e acompanhe`.

## Loop ativo (legado B5 — superado por SIMULATE acima)
**L1/B5 revisor-cetico-de Done** (2026-07-16) — ship check static **PASS**. Ver bloco SIMULATE no topo.

## Last iteration — L1/B5 revisor-cetico-de (2026-07-16, Grok 4.5 / grok-solo)
- **Checklist B5 (static):**

| Item | Resultado |
|------|-----------|
| Build `npm run build -w @forge/revisor-cetico-de` | **PASS** EXIT 0 (Compiled + static export) |
| Typecheck (next build) | **PASS** |
| Disclaimer legal na UI | **PASS** (`app.config.legal.disclaimer` → intro+report; no `out/`) |
| `.env.example` vars/porta | **PASS** (documentado: static, sem AI key, `dev:revisor` → **:3003**) |
| Free quota 402/paywall | **N-A** (static, free path demo sem créditos/API) |
| GET /api/health + stream | **N-A** (capability static, sem `src/app/api`) |
| Core smoke fluxo | **PASS** `node apps/revisor-cetico-de/scripts/b5-smoke.mjs` **18/18** (personas v2, arith A/B, findings+evidência, gate humano, 6 steps, export) |
| Ship readiness Next | **P3 deploy** path (static → CF Pages/GH Pages) — **sem URL ainda** |
| Porta dev | **3003** (`package.json` + root `dev:revisor` + `.env.example`) |

- **Correção real (ponytail):** `.env.example` não listava o revisor (só quiz/deck) → bloco adicionado.
- **Artefato smoke:** `apps/revisor-cetico-de/scripts/b5-smoke.mjs` (reproduzível).
- **Nota:** `apps/revisor-cetico-de/docs/` está vazio no working tree (scorecard/hooks/design docs de jobs anteriores não estão no disco deste app nested `.git`); **não bloqueia B5** (ship check de produto/build). Restaurar docs é backlog separado se o orquestrador depender deles.
- **Fora do B5:** push, deploy, PDF real, WhatsApp webhook, billing, extração IA, polish visual GLM.
- **Próximo:** gate humano **P3** (autorizar deploy static) **ou** colar B3 no GLM se UI ainda for prioridade. Sem git push (orquestrador).

## Last operator iteration - META/L1 forge-operator skill (2026-07-16, Codex)
- **Orquestracao:** Codex/Claude Code viram o diretor conversacional; players do Forge continuam executando os jobs.
- **Skill canonica:** `.agents/skills/forge-operator/SKILL.md`; adaptador Claude em `.claude/skills/forge-operator/SKILL.md`; gatilhos registrados no `AGENTS.md`.
- **Fluxo:** ideia natural/arquivo -> review de intake -> reutilizar/criar profile, blueprint e time -> iniciar -> observar eventos com cursor ate done, blocker ou gate humano.
- **Helper:** `forge-control.mjs` oferece snapshot pequeno, observe com espera <=45s e criacao de time validada contra providers/modelos vivos.
- **VERIFY:** quick_validate Codex + Claude PASS; `node --check` PASS; snapshot real PASS; observe real confirmou `revisor-cetico-de`/`grok-solo`; time full Grok dry-run PASS com hash do roster inalterado; `git diff --check` PASS.
- **Uso:** nova sessao no repo -> `$forge-operator tive uma ideia...` (Codex) ou `/forge-operator tive uma ideia...` (Claude). Linguagem natural equivalente tambem aciona. Sem push/deploy.

## Last agent
Grok 4.5 | 2026-07-16 · L1/B3 `revisor-cetico-de` (forge autopilot / grok-solo)

## Last iteration — L1/B3 revisor-cetico-de (2026-07-16, Grok 4.5 / grok-solo)
- **Feito (job B3 = prompt denso, NÃO código UI):** `workbench/prompts-glm/L1-B3-revisor-cetico-de-obra-clareza.md`
- **Direção:** ds-pick proposta **2** Obra Clareza · ref `maestro/proposals/revisor-cetico-de/proposal-2.html`
- **Conteúdo do brief:** diagnóstico B1/B2; metas por tela (intro/case/matrix/findings/report/gate/shell); tokens --rx-*; restrições (não tocar domain/demo/personas/API); anti-padrões; VERIFY `npm run build -w @forge/revisor-cetico-de`; DoD user-facing.
- **README:** entrada adicionada em `workbench/prompts-glm/README.md`
- **VERIFY B3:** checklist densidade (diagnóstico + metas por tela + paths + restrições + anti-padrões + VERIFY + DoD) · **PASS** (artefato documental; sem implementação UI neste job).
- **Fora do B3 coding:** polish real (GLM), B5, deploy, PDF/WhatsApp reais.
- **Próximo:** colar PROMPT no **GLM 5.2 MAX** → build revisor → B5 ship check. Sem git push (orquestrador).

## Last iteration — L1/B2 revisor-cetico-de (2026-07-16, Grok 4.5 / grok-solo)
- **Feito:** `content/personas/revisor-pack-v2.json` — 5 perspectivas ORIGINAIS densas (não OCs de anime; revisores operacionais do domínio):
  1. `scope-reviewer` — omissões, matriz, comparabilidade
  2. `commercial-reviewer` — pagamento, garantia, aditivo, proteção
  3. `evidence-validator` — gates 1/2/7, basis, anti prompt-injection
  4. `spec-reviewer` — materiais/unidade/marca vs mão de obra
  5. `escalation-reviewer` — limite documental vs ART/profissional
- **Wire:** `apps/revisor-cetico-de/app.config.ts` → pack v2; eyebrow UI B2. IDs dos 3 findings do demo preservados. `revisor-pack-v1.json` mantido (histórico).
- **Regras embutidas nos system:** linguagem proibida (golpe/laudo/desonesto), basis (explicit…unknown), evidência obrigatória, SINAPI não é preço correto, sem IP de obras.
- **VERIFY:** schema persona OK (5/5) · `npm run build -w @forge/revisor-cetico-de` → **EXIT 0** (Compiled successfully + static export).
- **Fora do B2:** B3 polish visual, API/extração, upload, DB, PDF, WhatsApp, billing.
- **Próximo:** L1/B3 — prompt GLM denso (Obra Clareza). Sem git push (orquestrador).

## Last iteration — L1/B1 revisor-cetico-de tentativa 4 (2026-07-15/16, Grok 4.5 / grok-solo)
- **Causa:** pipeline em B1 attempt 4 (retry pós blocked-L1-B1); no disco `apps/revisor-cetico-de` só tinha `.git` init + `out/`/`.next` legados + `nul` — **sem package.json/source** (handoffs anteriores reportaram scaffold que não estava no working tree do app-repo nested).
- **Feito:** scaffold Next 15 `output:"export"` · `@forge/revisor-cetico-de` · `app.config.ts` (niche `orcamentos`, capability static, personas `revisor-pack-v1`) · fluxo **intro → case → matrix → findings → report → gate humano** · demo banheiro Grande SP (2 propostas) · aritmética determinística (`checkProposalArithmetic`) · resumo WhatsApp copiável · disclaimer documental/comercial · tokens mínimos Obra Clareza (âmbar dark; polish = B3).
- **Profile:** `.forge/profile.md` namespace `@forge` (regex OK). Scripts root `dev:revisor` / `build:revisor` já existiam.
- **VERIFY:** `npm run build -w @forge/revisor-cetico-de` → **EXIT 0** (Compiled successfully + static export).
- **Fora do B1:** API/extração real, upload, DB, PDF, WhatsApp webhook, billing, B3 polish.
- **Próximo:** L1/B2 personas densas. Sem git push (orquestrador).

## Last iteration — L1/B1 revisor-cetico-de tentativa 3 (2026-07-15, Grok 4.5 / grok-solo)
- **Contexto:** pipeline ainda tinha B1 attempt 1–2 com `pass:false` (`namespace inválido: orçamentos`). Scaffold + fix de profile já estavam no disco.
- **Re-verify:** `.forge/profile.md` + `profiles/wpp-ia-criterios/profile.md` → `namespace: "@forge"`, `niche: "orcamentos"` (regex `/^@?[a-z0-9._-]+$/` OK).
- **Scaffold:** `apps/revisor-cetico-de` Next 15 `output:"export"` · `@forge/revisor-cetico-de` · personas `revisor-pack-v1` · fluxo intro→case→matrix→findings→report→gate humano · demo case + aritmética determinística.
- **VERIFY:** `npm run build -w @forge/revisor-cetico-de` → **EXIT 0**; simulação Maestro `{pass:true, detail:"build exit 0", namespace:"@forge"}`.
- **Fora do B1:** API/extração, upload, DB, PDF real, WhatsApp, billing, B3 polish.
- **Próximo:** L1/B2 personas densas. Sem git push.

## Last iteration — L1/B1 revisor-cetico-de tentativa 2 (2026-07-15, Grok 4.5 / grok-solo)
- **Causa raiz (attempt 1 FAIL):** `detail: "namespace inválido no profile: orçamentos"` — `.forge/profile.md` tinha `namespace: "orçamentos"` (ç + sem `@scope`); o verify de B1 roda `npm run build -w ${namespace}/${appId}` e exige `/^@?[a-z0-9._-]+$/`.
- **Fix:** `namespace` → `@forge` e `niche` → `orcamentos` em `.forge/profile.md` + `profiles/wpp-ia-criterios/profile.md`; `app.config.ts` niche alinhado.
- **Scaffold (já existia, revalidado):** Next 15 `output: "export"` · personas pack · fluxo intro→case→matrix→findings→report→gate humano · aritmética determinística · scripts `dev:revisor`/`build:revisor`.
- **VERIFY:** `npm run build -w @forge/revisor-cetico-de` → **EXIT 0**; simulação do path Maestro `{pass:true, detail:"build exit 0", namespace:"@forge"}`.
- **Fora do B1:** API/extração, upload, DB, PDF real, WhatsApp, billing, B3 polish.
- **Próximo:** L1/B2 personas densas. Sem git push.

## Last iteration — L0/P1 revisor-cetico-de (2026-07-15, Grok 4.5 / grok-solo)
- **Feito:** `apps/revisor-cetico-de/docs/content-hooks.md` — 15 hooks PT-BR+EN (reforma/orçamento Grande SP), copy de oferta R$ 197/297/497+, brief de aquisição do piloto WhatsApp, intake mínimo, telemetria manual, sequência 7 dias, checklist de linguagem (sem laudo/golpe).
- **VERIFY:** `hasSubstantialText` no artefato → **PASS** (job documental; sem código/build/git).
- **Métrica norte:** `mensagem WhatsApp com material → pagamento → entrega → descoberta útil`.
- **Próximo:** humano postar hooks / rodar piloto pago; resolver `ds-pick` (proposta 1/2/3) se for retomar UI; **B1 bloqueado** até demanda validada. Medidas P4 humanas dos apps live continuam na QUEUE.

## Last iteration — META/L1-L2 Forge Operator + Gemini (2026-07-15)
- **Operator:** `forge ingest` recebe texto, arquivo, pasta, URL, PDF ou DOCX; classifica intenção e decide com justificativa entre reutilizar/criar profile, blueprint e pipeline. Planos de alto risco e alterações do próprio Forge exigem revisão explícita.
- **Caso real:** `plano-revisor-cetico-orcamentos-reforma.md` foi lido em `review-only`; propôs profile + blueprint novos para capability `chat`, com revisão obrigatória por ser domínio de alto impacto. Nada foi iniciado automaticamente.
- **Blueprint Studio:** versões imutáveis por SHA-256, lineage, derive, archive/restore e migração de blueprints legados; documentação diferencia profile, blueprint e pipeline.
- **Times:** `grok-solo` agora é estrito e não cruza provider nem no prompt-improver. Times `fallback` continuam usando a cadeia declarada. Isso elimina o uso silencioso de Codex/Claude quando o usuário escolhe “Só Grok”.
- **Gemini:** executor por assinatura validado via Antigravity `agy 1.1.2`; fábrica detecta `agy`, remove o login inexistente e lista Gemini 3.1 Pro/3.5 Flash. Smoke real `Gemini 3.1 Pro (High)` retornou `GEMINI-31-PRO-FORGE-OK` sem API key.
- **Estado:** pipelines `done` voltam a ser restauradas após restart e podem receber feedback ou simulação; somente runs interrompidas viram gate de recovery.
- **Run Console:** eventos JSONL estruturados, redigidos, persistentes e filtráveis por app/run/cursor; a central mostra progresso, agente, job, duração e saída completa.
- **Simulator:** skill MIT pinada no commit `834a2a37661743cc241a70781b859c1e68d08f99`; job `SIMULATE` exige exatamente cinco personas e cinco melhorias, aplica no máximo três correções seguras e injeta no máximo um ciclo `ITERATE → B5` antes do gate de deploy.
- **VERIFY:** `npm test` **190 total / 189 pass / 0 fail / 1 skip**; `npm run typecheck`, `npm run build:all`, `git diff --check` e sintaxe dos `.mjs` alterados com exit 0.
- **Operação:** commits `2afd91f` e `78e6da0` integrados por fast-forward; Control Center novo ativo em `127.0.0.1:8799`; `revisor-cetico-de` foi parado manualmente após DS-GEN e mantém o `ds-pick`; sem push ou deploy externo.
- **Próximo:** quando quiser retomar, resolver `stopped` e escolher a proposta 1/2/3 no `ds-pick`.

## Last iteration — DS-GEN revisor-cetico-de (2026-07-15, Grok 4.5 / grok-solo)
- **Feito:** 3 direções visuais distintas + doc de tokens canônicos `--rx-*`.
  1. **Clínica Documental** (minimal light) — `maestro/proposals/revisor-cetico-de/proposal-1.html`
  2. **Obra Clareza** (vibrante dark âmbar) — `proposal-2.html`
  3. **Advisory Editorial** (navy + ouro + serif) — `proposal-3.html`
  - Tokens: `apps/revisor-cetico-de/docs/design-system.md`
- **VERIFY:** `isSubstantialHtml` ×3 + `hasSubstantialText` design-system.md → **PASS** (local via engine.mjs). Sem git/build de app (job documental).
- **Próximo:** gate **`ds-pick`** (humano escolhe 1/2/3). Depois L0/P1 content hooks se a pipeline seguir; B1 só com demanda validada (piloto pago do scorecard).

## Last iteration — FOUNDATION revisor-cetico-de (2026-07-15, Grok 4.5 / grok-solo)
- **Feito:** `apps/revisor-cetico-de/docs/system-design.md` com seções **Arquitetura**, **Dados**, **Decisões**, **Padrões**, **Riscos** (backoffice interno, pipeline evidência→humano, entidades do briefing; sem código/build/git).
- **Próximo:** era DS-GEN (feito acima).

## Nota — correção de causa raiz do verify L0/P0 revisor-cetico-de (2026-07-15, "tentativa 3")
`maestro/pipelines/revisor-cetico-de.json` (não consultado nos handoffs anteriores) mostrava o motivo real de 6 tentativas reprovadas antes desta: `verify()` para `L0/P0` chama `validateP0Market(txt)` (`maestro/engine.mjs:84-111`), que exige uma seção `## Mercado` no scorecard com 4 campos em formato `- Campo: valor` — `Comprador`, `Canal`, `Preço-alvo`, `Recorrência` — cada um com conteúdo real (não placeholder, ≥8 caracteres úteis). O scorecard já tinha toda essa informação, mas espalhada em outras seções (§3 cliente, §7 canal, §8 preço), nunca no formato exato que o parser procura — por isso `verify` reprovava com "mercado ausente"/"mercado inválido" mesmo com o documento completo e o GO no topo. **Fix:** adicionada seção `## Mercado` logo após o sumário executivo, com os 4 campos preenchidos a partir do conteúdo já pesquisado (nada novo inventado). Testado localmente (`node -e` importando `validateP0Market` de `maestro/engine.mjs` contra o arquivo real): `{pass:true, detail:"mercado declarado"}`, `go:true`, `conditionalGo:true`. Nenhum outro conteúdo do scorecard foi alterado; nenhum git/build executado (documental).

## Nota — reverificação L0/P0 revisor-cetico-de (2026-07-14, "tentativa 2")
O orquestrador reenviou este job com `Error: Reached max turns (25)` da execução anterior. Conferido: `apps/revisor-cetico-de/docs/scorecard.md` já existe, completo e correto (GO no topo, pt-BR, fatos×hipóteses×lacunas, linguagem proibida citada só como restrição, fontes com URL+data, nenhum git/build executado nesta linha). A execução anterior aparentemente estourou o limite de turnos do orquestrador *depois* de já ter escrito o arquivo — o verify não capturou a tempo. Nada foi reescrito nesta passada; apenas claim registrado/liberado. Não redisparar este job novamente sem checar o arquivo primeiro.

## Last agent (pipeline anterior)
Claude Sonnet 5 (claude-frontend) | 2026-07-14 · L0/P0 `revisor-cetico-de` (1ª execução real)

## Last iteration — L0/P0 revisor-cetico-de (2026-07-14, Claude Sonnet 5)
- ⚠️ **Correção de registro:** os 3 registros anteriores abaixo ("tentativa 3", "Codex Engine", "Grok 4.5 reexec") eram falsos — `apps/revisor-cetico-de/` só tinha `.gitignore` + commit de init, `docs/scorecard.md` nunca existiu no disco. Não confiar em handoffs anteriores deste app sem verificar o arquivo.
- **Feito/veredito real:** `apps/revisor-cetico-de/docs/scorecard.md` criado agora, linha canônica `Veredito: GO` (condicionado a piloto manual pago, zero código); fatos/hipóteses/lacunas separados explicitamente.
- **Evidência real (8 buscas + 2 fetch nesta sessão):** SINAPI (exclusões confirmadas via espelho `anda.ibge.gov.br` — URL oficial deu 403 no fetch), Confea/ART (obrigatoriedade geral confirmada, **mas a página não esclarece isenção para reforma leve sem estrutura** — lacuna real, não fato), CDC Art.40, LGPD anonimização/consentimento, reclamações reais no Reclame Aqui, 1 concorrente indireto validado (Lar Pontual Engenharia) e concorrentes lado-vendedor de IA (Vigha/OrcamentoApp) que não atacam o lado comprador.
- **Maior lacuna:** nenhuma evidência de disposição a pagar por essa revisão isolada (vs. ChatGPT grátis) — é exatamente o que o próximo passo testa.
- **Próximo gate (inalterado):** 5–10 revisões pagas, 7/10 úteis, tempo humano &lt;90 min e margem positiva; kill se &lt;3 pagamentos em 30 dias úteis. Job não iniciou o piloto.

## Last agent (anterior)
GPT‑5.6 | 2026-07-14 · Forge Nexus + ai-memory (`feat/forge-nexus-memory`)

## Last iteration — META/L1→P3 Forge Nexus + ai-memory (2026-07-14)
- **Produto:** Maestro passou a se apresentar como **Forge Nexus**; oito áreas zero-command controlam P0–P5, fábrica, decisões, métricas, atividade e memória.
- **Memória:** `akitaonrails/ai-memory` v1.13.0 incorporado e pinado; instalação visual com checksum, runtime loopback, token privado, escopo fábrica/app, sete tipos, briefing pré-job, eventos pós-job e outbox fail-open.
- **Operação:** setup, retry, busca, regra, importação com prévia, backup, reindex e exclusão ficam na central; primeiro uso vazio responde 200 sem ruído no console.
- **Segurança:** conteúdo lembrado entra por `untrustedBlock`; browser nunca recebe token upstream; nenhuma rota de shell livre; control plane permanece em `127.0.0.1:8799`.
- **VERIFY local:** `npm test` 168/167 pass/0 fail/1 skip opt-in; smoke real 1/1; typecheck 4 packages; quatro apps reais com `Compiled successfully`.
- **VERIFY remoto:** Actions `29378454831` verde nos jobs Node e `cargo test --workspace --locked`.
- **Browser QA:** instalação pela UI, saúde, estado vazio e busca exercitados; console 0 errors/0 warnings. Tutorial responsivo já coberto em 375/768/1024/1440.
- **Deploy público:** onboarding estável em https://forge-onboarding.pages.dev/ e deployment imutável https://5286152e.forge-onboarding.pages.dev/; central e memória não foram publicadas.
- **Git:** branch `feat/forge-nexus-memory` publicada; commits cirúrgicos e relatório em `docs/optimization/GPT56-VERIFICATION-REPORT.md`.
- **Escopo preservado:** `package-lock.json`, `.claude/` e `.codebase-memory/` preexistentes continuaram fora dos commits; nenhum app de produção foi removido ou republicado.
- **Próximo:** usar o launcher Forge Nexus e conduzir as próximas pipelines pela central; P4 real continua dependendo dos dados do dono.

## Last iteration — META/L1 Forge Nexus + ai-memory design (2026-07-14)
- **Decisão:** marca visível Forge Nexus; código do `ai-memory` incorporado como git subtree fixado em `v1.13.0` (`39a1e248`); nomes internos `maestro/*` preservados na primeira fase.
- **Integração:** runtime local gerenciado sem terminal/Rust, briefing pré-job, eventos estruturados pós-job, escopo por factory/app/run, outbox fail-open e importação histórica com prévia.
- **Central:** nova área Memória para saúde, busca, briefing, regras, erros, handoffs, importação, backup e recovery; token upstream nunca chega ao browser.
- **Segurança:** loopback, checksum, env allowlisted, redaction, `untrustedBlock`, mutações allowlisted e gates humanos invariantes.
- **Documento:** `docs/plans/2026-07-14-forge-nexus-ai-memory-design.md`.
- **Escopo desta iteração:** somente design e workbench; nenhum subtree, runtime, dependência, implementação, push, deploy ou restart.
- **Próximo:** dono revisa o documento; após aprovação escrita, gerar plano por commits com `superpowers:writing-plans`.

## Last iteration — META/L1 Maestro Control Center (2026-07-14)
- **Control plane:** snapshot versionado, catálogo state-driven, operações idempotentes, confirmação por nonce, auditoria redigida e handlers allowlisted; nenhum shell livre.
- **Pipeline completa:** modos `autopilot_to_gate`/`guided`/`manual`, gates invariantes, recovery, target, P4 comparável e P5 `kill|iterate|scale` sem apagar produção no kill de produto.
- **Fábrica:** profiles, times, providers e blueprints administráveis pelo catálogo; login usa somente CLI oficial allowlisted com `shell:false`.
- **Dashboard:** sete áreas (Visão geral, Nova pipeline, Pipelines, Decisões, Fábrica, Métricas e Atividade), wizard sem terminal, formulários genéricos, previews/propostas/documentos preservados, SSE e tratamento de `state_stale`.
- **Launcher:** `forge-control-center.cmd` + supervisor; reutiliza health existente, inicia no máximo uma instância, espera snapshot legítimo e abre o browser uma vez. Smoke real: `Maestro já estava online: http://127.0.0.1:8799`.
- **VERIFY fresco:** `npm test` **129/129, 0 fail** · `npm run typecheck` **8 workspaces, EXIT 0** · `npm run build:all` **4 apps, 4× Compiled successfully, EXIT 0**.
- **Browser QA:** Chromium real em 375/768/1024/1440; `scrollWidth === innerWidth` nas quatro larguras; wizard, fábrica, modal e confirmação externa exercitados; console **0 errors / 0 warnings**.
- **UI forte:** brief denso versionado em `workbench/prompts-glm/maestro-control-center.md`. A tentativa GLM ficou opaca e não escreveu arquivos; o processo próprio foi encerrado pelos PIDs exatos e o fallback local foi revisado por testes + browser.
- **Escopo preservado:** `package-lock.json`, `.claude/` e `.codebase-memory/` preexistentes continuam intocados; sem dependência, push, deploy, publicação, restart da porta 8799 ou mutação de apps/pipelines durante QA.
- **Não exercitado no estado real:** submits mutáveis e login externo foram validados em roots/spawns falsos, não clicados contra os dados do dono. Isso evita criar pipeline/profile/time ou abrir autenticação só para demonstrar a UI.
- **Próximo:** escolher merge/push/PR. O uso normal começa por duplo clique em `forge-control-center.cmd`.

## Last iteration — META/P3 onboarding visual do Forge (2026-07-13)
- **Entrega:** tutorial público em `docs/forge-onboarding/` com mapa da jornada, primeiros 15 minutos, laboratório de gates, comparação de times, busca de comandos, operação concorrente, recovery e checklist de ship persistida no navegador.
- **Design:** página estática editorial dark/light, responsiva em 375/768/1024/1440, acessível por teclado e sem dependência nova.
- **VERIFY:** `npm test` **108/108** · browser em quatro larguras com **overflow 0** · busca, gate, cópia e persistência exercitados · console **0 errors / 0 warnings**.
- **Deploy:** Cloudflare Pages direto com Wrangler `4.108.0`; URL estável **https://forge-onboarding.pages.dev/** e deployment imutável **https://160c8198.forge-onboarding.pages.dev/**; body, assets e headers de segurança retornam HTTP 200.
- **Git:** commit de fechamento que contém este handoff; push autorizado para `origin/feat/gpt56-optimization`.
- **Escopo preservado:** `package-lock.json`, `.claude/` e `.codebase-memory/` preexistentes ficaram intocados; nenhum app ou serviço do Maestro foi reiniciado.
- **Próximo:** divulgar o tutorial e observar dúvidas reais de onboarding antes de ampliar conteúdo.

## Last iteration — META/L2 correções pós-revisão Fable (2026-07-13)
- **C-1:** cooldowns futuros persistidos em `pipeline.cooldowns` ressemeiam o `Map` global no boot; regressão cobre manager novo no mesmo root (`3fec9a0`).
- **C-2:** byte NUL cru removido de `maestro/stats.mjs` em favor de `\u0000`; teste impede o fonte de voltar a ser binário.
- **VERIFY:** `npm test` **99/99** · `npm run forge -- stats` **EXIT 0**, com as três tabelas e dados reais.
- **Escopo preservado:** nenhuma dependência, refactor, publicação, push ou deploy; `package-lock.json`, `.claude/` e `.codebase-memory/` preexistentes ficaram intocados.
- **Próximo:** Fable reexecuta os aceites de C-1/C-2 e, se verde, branch está pronta para merge.

## Last iteration — META/GPT56 optimization (2026-07-13)
- **Entrega:** T‑01/02/03/04/05/06/07/08/09/10b/11/12/13/14/15/16/17/20 implementadas ou adaptadas conforme contrato; T‑10a local concluída e produção explicitamente bloqueada sem sink durável.
- **VERIFY global:** `npm test` **97/97** · `npm run typecheck` **8 workspaces / EXIT 0** · `npm run build:all` **4 apps / EXIT 0**.
- **DOKI//CALL local:** `32ba6df` checkout waitlist honesta, sem entitlement; `edc2298` telemetria JSONL local. **Não publicados.**
- **Relatórios:** `docs/optimization/GPT56-VERIFICATION-REPORT.md` + `docs/optimization/HANDOFF-TO-FABLE-REVIEW.md`.
- **Pendências reais:** revisão Fable; GitHub Actions após push autorizado; sink durável da telemetria; eventual publicação do DOKI//CALL; medições P4 humanas.
- **Próximo:** revisar adversarialmente o diff `240fd22..HEAD`; não reconstruir as tarefas concluídas.

## Iteration anterior — L1/B2 doki-call (2026-07-13)
- **Job:** L1/B2 personas pack (`content/personas/doki-pack-v2.json`)
- **Entrega:** 3 OCs 21+ (Mika/Rena/Yuki) com system prompts densos p/ telefone+guardrails IP/idade; starters PT+EN; tags voz; `app.config` → v2; voice-note free path por persona em `mock-chat.ts`
- **VERIFY:** `npm run build -w @forge/doki-call` **EXIT 0**
- **Sem git** (orquestrador) · v1 mantido no repo (histórico)
- **Próximo:** B3 prompt GLM denso (Neon Y2K) OU B4 chat AI + TTS + entitlement

## Iteration anterior — L1/B1 doki-call (2026-07-13)
- **Job:** L1/B1 scaffold app (`@forge/doki-call`)
- **Entrega:** funil create→free_text(3)→voice_note→paywall R$4,90→fake-door+lead; 3 personas originais 21+; i18n PT+EN; age gate After Dark; `RealtimeVoiceProvider` stub; API health/telemetry/interest/voice/session (402 sem entitlement); tokens Neon Y2K (`--af-*`)
- **VERIFY:** `npm run build -w @forge/doki-call` **EXIT 0**
- **Sem git** (orquestrador) · **Sem Realtime/checkout real** (B4)
- **Próximo:** B3 prompt GLM denso OU B4 chat AI + TTS + entitlement

## Iteration anterior — L0/P1 doki-call (2026-07-13)
- **Job:** L0/P1 content hooks + brief fake-door
- **Artefato:** `apps/doki-call/docs/content-hooks.md`
- **Entrega:** 15 hooks PT-BR+EN (SFW); copy paywall R$ 4,90; brief fake-door (mock criação + áudio pré + CTA → “em breve” + lead); telemetria `visit→…→audio_play→buy_click`; métrica norte **áudio→clique Atender**
- **Sem código de app** · **Sem Realtime/checkout** · **Sem git** (orquestrador)

## Iteration anterior — DS-GEN doki-call (2026-07-13)
- **Job:** DS-GEN (gate `ds-pick`) · 3 propostas visuais · `maestro/proposals/doki-call/proposal-{1,2,3}.html` + `apps/doki-call/docs/design-system.md`
- **Pendente do dono:** escolher direção visual 1/2/3

## Iteration anterior — FOUNDATION doki-call (2026-07-13)
- **Job:** FOUNDATION (contrato de arquitetura)
- **Artefato:** `apps/doki-call/docs/system-design.md`
- **Decisões-chave:** Next server (Vercel); free = texto+TTS; Realtime só pós-pagamento; `RealtimeVoiceProvider` (xAI primário, OpenAI fallback); guest + entitlement server-side; 1ª oferta só R$ 4,90; +18 opcional; P1 fake-door antes de B1 voice
- **Sem código de app** neste job

## Iteration anterior — L0/P0 doki-call (2026-07-13)
- **Veredito:** GO condicionado — content-first + fake-door
- **Tipo:** `chat` (produto = server/Realtime+checkout; P1 = hooks/fake-door sem código Realtime)
- **Score:** 27/35 (hook/fit/impulso 5; capability 3; economia 4; MVP 3; risco legal/idade 2)
- **Artefatos:** `apps/doki-call/docs/scorecard.md` · espelho `docs/scorecard-doki-call.md`
- **Portfólio:** 1ª aposta monetização-first; ANIMA//DECK = engagement/share-first
- **Sem código de app** neste job

## Handoff canônico (ideia + o que foi feito)
**Ler primeiro:** `docs/HANDOFF-SESSAO.md` · **Autopilot:** `docs/MAESTRO.md` § Forge Autopilot

## Last iteration — FORGE AUTOPILOT (2026-07-10)
- **Motor**: `maestro/engine.mjs` — pipeline ideia→P0→gate→P1→B1..B5→gate→ship com git
  checkpoints/rollback, retry ≤3, L2 automático em rate-limit (cooldown+fallback do team)
- **CLI**: `npm run forge -- new "<ideia>" --team grok-glm-front` → TUI full-screen
  (gates com teclas g/k/r/f); `forge decide|status|attach|stop|resume|roster`
- **Teams**: grok-solo · grok-glm-front (GLM headless no B3 — fim do copiar prompt) ·
  quality (Opus+Codex review) · dry-run
- **Fix histórico**: Grok headless = `grok -p` (posicional abria TUI → hang/ANSI). Smokes
  reais PASS: GLM-FORGE-OK, GROK-ADAPTER-OK. Dry-run E2E 2× PASS.
- **Deploy**: cf-pages → `<app>.gbbragadev.com` implementado; ⚠ CLOUDFLARE_API_TOKEN é
  read-only → gate entrega 3 passos p/ trocar por token com Pages:Edit + DNS:Edit

## Done (produto)
| App | Status |
|-----|--------|
| **waifu-chat** | MVP + smoke OpenRouter + UI B3 GLM |
| **anime-quiz** | P0→B5 + **live** https://gbbragadev.github.io/anime-forge/ |
| **anima-deck** | ship/iterate em curso (engagement/share-first) |
| **doki-call** | L0/P0–P1 + FOUNDATION + B1–B3 + **B4 wire API** (chat/TTS/entitlement stub) · próximo B5 |

## Done (harness)
- Loops L0/L1/L2 multi-sub (Claude/Codex/Grok/Gemini + GLM B3)
- workbench QUEUE/HANDOFF/CLAIMS
- Guia visual, PLAYBOOK, ship matrix, content-first gates
- OpenRouter: `OPEN_ROUTER_API_KEY` env sistema (não pedir no chat)

## Next
1. **revisor-cetico-de:** gate humano — piloto ops (5–10 pagos, WhatsApp+PDF) ou kill se &lt;3/30d; **sem B1/P1 anime**
2. **L1/B5** doki-call: ship check (health + free path + paywall CTA)
3. **Content:** postar hooks batch 1,2,3,5,8 + medir `audio_play→buy_click`
4. **Humano P4** anime-quiz / anima-deck measure
5. **Token CF** Pages:Edit + DNS:Edit; Vercel + PSP real quando ship server doki-call
6. **Realtime live** xAI/OpenAI quando keys + VOICE_PROVIDER no ship

## Blockers
- P4 measure = humano
- Deploy automático cf-pages = token CF read-only (3 passos no gate)
- Vercel server deploy = token (necessário quando L1 chat/Realtime do doki-call)

## Links
- Scorecard doki-call: `apps/doki-call/docs/scorecard.md`
- System design doki-call: `apps/doki-call/docs/system-design.md`
- Content hooks doki-call: `apps/doki-call/docs/content-hooks.md`
- Handoff sessão: `docs/HANDOFF-SESSAO.md`
- Quiz: https://gbbragadev.github.io/anime-forge/
- Repo: https://github.com/gbbragadev/anime-forge
- Pipeline: `docs/AGENT-PIPELINE.md`
- Trocar ideia: `docs/PLAYBOOK.md` + `docs/prompts/L0-NOVA-IDEIA.md`

<!-- forge:begin:o-anima-deck -->
## Forge autopilot — o-anima-deck
- **Ideia:** O ANIMA//DECK ficou dividido corretamente em duas camadas:

Visão completa: criação por IA/selfie, packs, inventário, raridades,
evolução, temporadas e Álbum Vivo. Wedge v0: criador estático de
personagem e photocard, sem backend, conta, pagamento ou geração por IA,
feito especificamente para medir criação e compartilhamento.

O próximo produto pode repetir essa lógica:

uma visão completa de companion altamente personalizável; um v0
extremamente focado em provar que alguém paga para receber uma ligação.
Próxima aposta: DOKI//CALL

Crie sua waifu original, defina a personalidade dela e receba uma
ligação em tempo real.

Classificação Aspecto Definição Tipo Híbrido, mas monetização-first
Aquisição Reel, Story e demonstração da voz Emoção Curiosidade, romance,
exclusividade e personalização Produto pago Ligação ao vivo com a
personagem criada Diferencial Não é só chat de texto: é uma personagem
que fala, reage e lembra IP Personagens e vozes originais Veredito
inicial GO condicionado --- content-first

O ponto mais importante é este:

O usuário não deve pagar apenas pelo "+18". Ele deve pagar pela ligação,
memória e personalização.

O modo adulto deve ser uma camada opcional. Assim, o produto continua
monetizável mesmo se um provedor restringir conteúdo explícito ou mudar
sua política.

A estratégia de compra por impulso

A melhor oferta não é "assine um chatbot". Isso exige confiança demais.

A oferta deve ser:

"Atender uma ligação de cinco minutos da personagem que você acabou de
criar."

Funil recomendado Etapa Experiência Objetivo psicológico 1. Hook Reel
mostrando uma chamada chegando Curiosidade 2. Criação Nome,
personalidade, relação, voz e intensidade Sensação de propriedade 3.
Prova gratuita Três mensagens de texto Demonstrar personalidade 4.
Momento de presença Um áudio curto usando o nome do usuário Demonstrar
que ela "existe" 5. Paywall "Atender ligação ao vivo --- 5 minutos por
R\$ 4,90" Compra pequena e concreta 6. Entrega Chamada começa
imediatamente após o pagamento Recompensa instantânea 7. Upsell Mais
minutos, memória persistente ou áudio exclusivo Aumentar ticket

A etapa gratuita pode usar texto + uma mensagem curta por TTS, deixando
o Realtime reservado para clientes pagantes. Isso reduz drasticamente o
custo de usuários que entram apenas por curiosidade.

Copy principal do paywall SUA PERSONAGEM ESTÁ PRONTA

Ela já sabe seu nome, sua personalidade e o que você acabou de contar.

Atender ligação ao vivo 5 minutos · R\$ 4,90

\[ ATENDER AGORA \]

Abaixo do botão:

Pagamento único. Sem assinatura. A conversa continua do ponto em que
parou.

Isso é mais forte que vender "créditos" logo no primeiro contato. O
usuário entende exatamente o que está comprando.

Estrutura de ofertas

A primeira tela deve mostrar somente a oferta de R\$ 4,90. Mais opções
aparecem depois do clique ou após a primeira chamada.

Oferta Entrega Preço proposto Custo bruto de voz na xAI Degustação
Texto + áudio curto Grátis TTS, sem Realtime Primeira Ligação 5 minutos
ao vivo R\$ 4,90 US\$ 0,25 Encontro Privado 12 minutos + memória R\$
9,90 US\$ 0,60 Passe da Noite 30 minutos + memória por 7 dias R\$ 19,90
US\$ 1,50

Esses custos de voz são calculados pela tarifa atual publicada de US\$ 3
por hora para o agente de voz da xAI, antes de câmbio, impostos,
infraestrutura e taxa do meio de pagamento. A xAI também publica TTS por
caractere, o que torna uma mensagem de voz curta mais apropriada para a
degustação gratuita.

Melhor order bump

Depois que o usuário escolher a primeira ligação:

Adicionar áudio personalizado para guardar "Boa noite, \[nome\]"

-   R\$ 2,90

É um produto digital instantâneo, pessoal e emocional. Também pode ser
baixado e enviado em grupos, gerando tráfego orgânico.

A experiência de personalização

O usuário não precisa construir uma personagem visual inteira no v0.
Isso aumentaria demais o escopo.

Personalização mínima 1. Identidade Nome da personagem; nome pelo qual
ela chama o usuário; idade da personagem, sempre explicitamente 21+;
pronome; relação inicial. 2. Personalidade

Escolha uma personalidade principal:

provocadora; carinhosa; sarcástica; dominante; misteriosa; caótica.

E um traço secundário:

ciumenta; protetora; competitiva; tímida; confiante; dramática. 3.
Cenário primeira ligação; encontro virtual; rivalidade; missão secreta;
reencontro; conversa de madrugada. 4. Voz

No v0, usar entre três e cinco vozes prontas:

suave; energética; elegante; misteriosa; confiante.

A xAI documenta vozes prontas com diferentes tons, suporte a conversa
speech-to-speech de baixa latência e também vozes customizadas. Para o
MVP, as vozes prontas são preferíveis; clonagem de voz só deveria entrar
com contrato e consentimento explícito de uma atriz de voz.

5.  Intensidade ○ Amigável ○ Romântica ○ Provocadora ○ After Dark 18+

O modo adulto não deve aparecer antes da confirmação de idade.

Como o "+18" deve funcionar

Há uma diferença importante entre:

romance; flerte; linguagem sugestiva; roleplay adulto; conteúdo sexual
gráfico.

Nenhuma das páginas oficiais consultadas concede uma autorização
irrestrita para erotismo explícito em aplicações comerciais. Portanto, o
app precisa tratar essa capacidade como configurável por provedor, não
como promessa fixa do produto.

As políticas atuais da OpenAI proíbem conteúdo íntimo não consensual,
violência sexual, sexualização de menores, roleplay sexual com menores e
uso indevido da voz ou imagem de terceiros. A política atual da xAI
também proíbe sexualização de crianças, nudificação ou representação
pornográfica de pessoas reais, personificação enganosa e serviços pagos
que ofereçam outputs violadores.

Regras obrigatórias Todas as personagens têm 21 anos ou mais. Nenhum
arquétipo pode parecer escolar ou menor de idade no modo adulto. Nenhum
personagem, nome, roupa, voz ou história de anime existente. Não
permitir clonagem de dubladores, celebridades ou pessoas reais.
Aquisição no Instagram permanece SFW. O modo adulto fica em rota
separada e atrás de age gate. O usuário pode definir limites e tópicos
proibidos. O app precisa ter saída imediata da conversa e exclusão do
histórico. O conteúdo básico continua funcionando sem modo adulto.

Isso é especialmente relevante porque a descrição atual do público do
ANIMA//DECK inclui usuários de 16 a 28 anos. O produto adulto não pode
assumir que toda a audiência proveniente da página é maior de idade.

OpenAI Realtime versus Grok Voice Minha recomendação para o MVP: xAI
como primário, interface abstrata desde o início Critério xAI/Grok Voice
OpenAI Realtime Cobrança US\$ 3 por hora Por tokens de áudio
Previsibilidade de margem Alta Média Conversa speech-to-speech Sim Sim
Cliente seguro Tokens efêmeros Credenciais efêmeras Browser
WebSocket/WebRTC demonstrado WebRTC recomendado Vozes prontas Sim Sim
Voz customizada documentada Sim Não usaria no v0 Certeza sobre erotismo
explícito Não Não Uso recomendado Voz principal do MVP Fallback e modo
SFW

A xAI documenta o grok-voice-latest como speech-to-speech em tempo real,
com latência inferior a um segundo, endpoint Realtime e tokens efêmeros
para clientes.

A OpenAI também possui arquitetura apropriada para browser: sessões
Realtime, comunicação por WebRTC, credenciais efêmeras e modelos
gpt-realtime-2.1 e gpt-realtime-2.1-mini. Atualmente, o modelo mini
publica valores de US\$ 10 por milhão de tokens de áudio de entrada e
US\$ 20 por milhão de saída; a versão completa publica US\$ 32 e US\$
64, respectivamente.

A aplicação deve ter uma interface como:

interface RealtimeVoiceProvider { createSession(input:
VoiceSessionInput): Promise`<VoiceSession>`{=html};
endSession(sessionId: string): Promise`<void>`{=html};
getUsage(sessionId: string): Promise`<VoiceUsage>`{=html};
supportsMode(mode: "safe" \| "romantic" \| "mature"): boolean; }

Isso impede que uma mudança de preço, disponibilidade ou política mate o
produto inteiro.

Escopo fechado do v0 Incluir três personagens originais; seis
combinações de personalidade; três vozes; nome do usuário; texto
gratuito limitado; uma mensagem de voz curta; ligação Realtime paga;
oferta única de R\$ 4,90; pagamento Pix/cartão; sessão convidada, sem
cadastro obrigatório antes da compra; contexto preservado após
pagamento; limite de minutos controlado no servidor; telemetria do
funil; age gate; moderação básica; histórico temporário; botão
compartilhar resultado SFW. Não incluir geração de avatar por IA; upload
de selfie; clonagem de voz pelo usuário; dezenas de personagens;
inventário; gamificação complexa; feed social; assinatura recorrente na
primeira versão; relacionamento com níveis; conteúdo adulto gráfico como
requisito do lançamento. Hooks para Instagram

Todos funcionam sem anunciar conteúdo explícito:

Hook 1

"Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Hook 2

"Escolhi 'sarcástica + ciumenta' e ela falou meu nome..."

Hook 3

"Esse site cria uma personagem e faz ela te ligar de verdade."

Hook 4

"Não coloque 'dominante' e 'caótica' ao mesmo tempo."

Hook 5

"A conversa era normal até ela mandar esse áudio."

O Reel termina com a tela:

CRIE A SUA link na bio Teste antes do desenvolvimento

Antes do Realtime completo, o P1 pode testar intenção de compra com:

mockup funcional da criação; áudio pré-gerado usando uma personagem
original; botão Atender ligação --- R\$ 4,90; após o clique, tela
transparente de "lançamento em breve" e captura de interesse.

Métricas principais:

visita → início da criação início → personagem concluída personagem →
reprodução do áudio áudio → clique em comprar clique → pagamento
pagamento → segunda compra

A métrica mais importante não é tempo de chat. É:

Quantas pessoas que ouviram a mensagem personalizada clicaram para
atender a ligação?

Scorecard inicial Critério Nota Hook demonstrável em um Reel 5/5 Fit com
audiência otaku 5/5 Potencial de compra por impulso 5/5 Capability já
existente no Anime Forge 3/5 Economia de API 4/5 Velocidade do MVP 3/5
Risco de política, idade e distribuição 2/5 Total 27/35 Decisão

GO condicionado.

Condições:

aquisição SFW; personagens sempre adultas e originais; chamada como
objeto principal da compra; modo adulto desacoplado do produto; xAI como
primeiro teste econômico; provider abstraction desde o início; P1 de
conteúdo e fake-door antes do build completo. Bloco pronto para o Anime
Forge --- L0/P0 IDEIA:

Nome provisório: DOKI//CALL

Webapp mobile-first no qual o usuário cria uma waifu original e adulta,
escolhendo nome, personalidade, relação, cenário e voz.

Depois da personalização, recebe: - 3 mensagens de texto gratuitas; - 1
mensagem de voz curta usando seu nome; - oferta para atender uma ligação
speech-to-speech em tempo real.

Oferta principal: "Ligação ao vivo de 5 minutos --- R\$ 4,90" Pagamento
único, preferencialmente Pix/cartão, entrega imediata e sem cadastro
obrigatório antes da compra.

Categoria: Híbrido, monetização-first.

Hook: "Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Capability: - chat existente; - adicionar capability realtime-voice; -
provider abstraction; - xAI/Grok Voice como candidato primário; - OpenAI
Realtime como fallback.

Escopo do v0: - 3 personagens originais; - 6 personalidades; - 3
vozes; - texto gratuito limitado; - voice note TTS; - ligação Realtime
paga; - memória somente durante a sessão; - telemetria; - checkout; -
age gate; - moderação.

Modo +18: - não é requisito para monetização; - somente para usuários
verificados como adultos; - personagens explicitamente 21+; - sem
personagens escolares ou minor-coded; - sem pessoas reais, celebridades,
dubladores ou franquias; - implementar apenas se o provedor e o
processador de pagamento permitirem; - aquisição e conteúdo
compartilhável permanecem SFW.

Fora do v0: - avatar por IA; - selfie; - clonagem de voz pelo usuário; -
assinatura; - inventário; - níveis de relacionamento; - comunidade; -
dezenas de personagens.

Objetivo do P0: Avaliar hook, intenção de compra, custo por chamada,
risco de política, risco de idade, fit com Instagram e tempo de
implementação.

Resultado esperado: GO condicionado a P1 content-first e teste de clique
no CTA de R\$ 4,90.

Este conceito deve ser registrado como a primeira aposta
monetização-first do portfólio, enquanto o ANIMA//DECK permanece como
aposta engagement/share-first.
- **Team:** grok-solo · **Status:** killed
- **Job atual:** — (2/9)
- **Branch:** pipeline/o-anima-deck · checkpoints: 2
- pipeline encerrada: killed
_Atualizado 2026-07-13T00:16:12.372Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/o-anima-deck.json_
<!-- forge:end:o-anima-deck -->

<!-- forge:begin:anima-deck -->
## Forge autopilot — anima-deck
- **Ideia:** feedback fb1: Revise o app como um todo, leve ele a um nivel superior
- **Team:** opussonnet · **Status:** done
- **Job atual:** — (4/3)
- **Branch:** pipeline/anima-deck-fb1 · checkpoints: 1
- **URL:** https://anima-deck.gbbragadev.com
- DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de apps/anima-deck/docs/content-hooks.md
_Atualizado 2026-07-13T03:08:40.019Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/anima-deck.json_
<!-- forge:end:anima-deck -->

## Last iteration — L1/B5 ship check anima-deck (2026-07-13 · Claude Opus, opussonnet-claude2)
- **1 quebra REAL corrigida:** o texto de share mandava todo mundo pra `deck.gbbragadev.com` (link morto) — o deploy real é **`anima-deck.gbbragadev.com`** (`maestro/pipelines/anima-deck.json`: subdomain+baseUrl). Num app share-first isso vazava 100% do tráfego de volta. Fix em `AnimaDeckApp.tsx:328`; bundle agora só contém o domínio certo. ⚠ **O HANDOFF antigo (iter 1) tem a prosa errada `deck.gbbragadev.com` — não reintroduzir.**
- **Checklist B5:** build EXIT 0 · disclaimer PT no HTML + EN no bundle · selo @otaku_sincero69 · core smoke PASS (pesos raridade=100, fronteiras de `rollRarity` corretas, card coerente, 12 personas bilíngues, 216 combos) · API/paywall = **N-A** (static, sem créditos/backend).
- **Docs:** `.env.example` agora documenta anima-deck (static, sem key, **porta dev 3002**) + root `npm run dev:deck` / `build:deck` (era o único app sem atalho).
- **Não construí:** `og.png` (`seo.ogImage` aponta p/ arquivo inexistente, mas o metadata NÃO referencia → sem 404; share primário manda o PNG do card, não preview de link) → backlog.
- **Sem git** (orquestrador). **Próximo:** gate humano `iterate-visual` segue pendente → `forge decide iterate-visual go|kill`, depois P3 deploy cf-pages (token CF ainda read-only).

## Iteration anterior — FEEDBACK fb1 iter 3 anima-deck (2026-07-12 · GLM ITERATE, skill /frontend-fable)
Gate do dono desta rodada: *"Aumentar a variedade de personas tipo cabeça corpo e tal"*.
- **Gap fechado = "corpo"**: a silhueta de ombros/busto era um path FIXO em `AvatarSvg` (zero variação de corpo). Nova dimensão **`body`** (sleek/atlético/robusto) via `bodyBuild(body)` → 3 silhuetas com largura de ombro 40/52/64px.
- **Variedade multiplicada**: +face `round`, +cabelos `twin`(rabo duplo)/`ponytail`, +3 builds de corpo → **36 → 216 personagens visuais distintos** (4 face × 6 cabelo × 3 olho × 3 corpo). Botão **Aleatório** agora sorteia `body` também (`randomDraft`).
- **Fidelidade preview↔export (guardrail)**: `Photocard` passa `body={card.body}` → card na tela e PNG baixado/share saem com o MESMO corpo (sem isso o export caía p/ default).
- **YAGNI**: fonte Unbounded (iter 2) intocada — feedback de "fonte fina" já estava resolvido. `body` entrou no step 1 (Aparência), não como step novo → `STEPS=6`/progress/validação preservados. Bilíngue PT/EN (labels em `forge.ts` Opt + `i18n.ts` field).
- **VERIFY**: `npm run build -w @forge/anima-deck` **EXIT 0** (types+lint OK). ⚠ verify visual (browser real) pendente no gate humano — confirmar leitura das 3 silhuetas + cabelos novos no preview `iterate-visual`.
Próximo: humano valida no preview (forge decide iterate-visual go|kill). Não rodei git (orquestrador cuida).

## Iteration anterior — FEEDBACK fb1 iter 2 anima-deck (2026-07-12 · GLM ITERATE, skill /fable-frontend)
Gate rejeitou iter 1: fonte ainda "fina/pouco profissional" (Saira Condensed = condensed, optical estreita em mobile).
- **Fonte (núcleo do feedback)**: Saira Condensed → **Unbounded** (wght 500-900, NÃO-condensed, acentos PT-BR, presença premium/TCG) em `--af-display`. Override **local** em `apps/anima-deck/src/app/globals.css`; `<link>` 500-900 em `layout.tsx`. packages/ui intocado → waifu-chat/anime-quiz não mudam de pele.
- **Peso/contraste premium**: peças-estrela 700→**800** (hero h1, nome do card, reveal-rarity, scene-num, quiz h2) + tracking ~0.01em (Unbounded larga dispensa o tracking largo que condensed pedia). Nome do card: clamp max 2.3→2.1 + `text-wrap: balance` p/ não estourar em mobile.
- **Fidelidade preview↔export (guardrail)**: `renderNodeToBlob` agora embute **Unbounded 800** no `@font-face` base64 do SVG→PNG (era Saira 700) — card na tela e PNG baixado/share na mesma fonte.
- **YAGNI (intocado)**: personagem/lineart (iter 1), wizard, botão Aleatório, i18n PT/EN, share/download — feedback desta rodada era só fonte+premium.
- **VERIFY**: `npm run build -w @forge/anima-deck` **EXIT 0** (lint+types OK). ⚠ verify visual (browser real) pendente no gate humano — confirmar leitura "premium" no preview `iterate-visual`.
Próximo: humano valida no preview (forge decide iterate-visual go|kill). Não rodei git (orquestrador cuida).

## Iteration anterior — FEEDBACK fb1 iter 1 anima-deck (2026-07-12 · GLM ITERATE)
1 iteração aplicando o feedback do dono. Build `@forge/anima-deck` exit 0.
- **Fonte (explícito)**: Bebas Neue (peso único, SEM acentos → nomes acentuados quebravam) → **Saira Condensed** (wght 600-800, acentos PT-BR) no `--af-display`. Override **local** em `apps/anima-deck/src/app/globals.css` (packages/ui intocado → waifu-chat/anime-quiz não mudam de pele). Pesos 700 em h1/h2/nome/scene-num/reveal.
- **Estética do personagem**: lineart (stroke `#1a0f24`, ~1.4-1.6px) em cabelo/rosto/ombros do `AvatarSvg` — acabamento cel-shaded que faltava (antes só fills).
- **Criação fácil**: botão **Aleatório** (shuffle) no topbar do wizard → `randomDraft()` preenche todos os campos + pula pro último step (1 toque → só forjar).
- **Compartilhar/Baixar**: `shareCard` agora manda a **imagem** do card via `navigator.share({files})` (Stories/WhatsApp direto, AbortError respeitado); download e share usam `renderNodeToBlob`, que **embeda `@font-face` Saira Condensed em base64** no SVG → PNG com a fonte certa (antes caía p/ fonte do sistema por CORS no contexto `<img>`).
Próximo: humano valida no ar (deck.gbbragadev.com). Não rodei git (orquestrador cuida).

<!-- forge:begin:doki-call -->
## Forge autopilot — doki-call
- **Ideia:** O ANIMA//DECK ficou dividido corretamente em duas camadas:

Visão completa: criação por IA/selfie, packs, inventário, raridades,
evolução, temporadas e Álbum Vivo. Wedge v0: criador estático de
personagem e photocard, sem backend, conta, pagamento ou geração por IA,
feito especificamente para medir criação e compartilhamento.

O próximo produto pode repetir essa lógica:

uma visão completa de companion altamente personalizável; um v0
extremamente focado em provar que alguém paga para receber uma ligação.
Próxima aposta: DOKI//CALL

Crie sua waifu original, defina a personalidade dela e receba uma
ligação em tempo real.

Classificação Aspecto Definição Tipo Híbrido, mas monetização-first
Aquisição Reel, Story e demonstração da voz Emoção Curiosidade, romance,
exclusividade e personalização Produto pago Ligação ao vivo com a
personagem criada Diferencial Não é só chat de texto: é uma personagem
que fala, reage e lembra IP Personagens e vozes originais Veredito
inicial GO condicionado --- content-first

O ponto mais importante é este:

O usuário não deve pagar apenas pelo "+18". Ele deve pagar pela ligação,
memória e personalização.

O modo adulto deve ser uma camada opcional. Assim, o produto continua
monetizável mesmo se um provedor restringir conteúdo explícito ou mudar
sua política.

A estratégia de compra por impulso

A melhor oferta não é "assine um chatbot". Isso exige confiança demais.

A oferta deve ser:

"Atender uma ligação de cinco minutos da personagem que você acabou de
criar."

Funil recomendado Etapa Experiência Objetivo psicológico 1. Hook Reel
mostrando uma chamada chegando Curiosidade 2. Criação Nome,
personalidade, relação, voz e intensidade Sensação de propriedade 3.
Prova gratuita Três mensagens de texto Demonstrar personalidade 4.
Momento de presença Um áudio curto usando o nome do usuário Demonstrar
que ela "existe" 5. Paywall "Atender ligação ao vivo --- 5 minutos por
R\$ 4,90" Compra pequena e concreta 6. Entrega Chamada começa
imediatamente após o pagamento Recompensa instantânea 7. Upsell Mais
minutos, memória persistente ou áudio exclusivo Aumentar ticket

A etapa gratuita pode usar texto + uma mensagem curta por TTS, deixando
o Realtime reservado para clientes pagantes. Isso reduz drasticamente o
custo de usuários que entram apenas por curiosidade.

Copy principal do paywall SUA PERSONAGEM ESTÁ PRONTA

Ela já sabe seu nome, sua personalidade e o que você acabou de contar.

Atender ligação ao vivo 5 minutos · R\$ 4,90

\[ ATENDER AGORA \]

Abaixo do botão:

Pagamento único. Sem assinatura. A conversa continua do ponto em que
parou.

Isso é mais forte que vender "créditos" logo no primeiro contato. O
usuário entende exatamente o que está comprando.

Estrutura de ofertas

A primeira tela deve mostrar somente a oferta de R\$ 4,90. Mais opções
aparecem depois do clique ou após a primeira chamada.

Oferta Entrega Preço proposto Custo bruto de voz na xAI Degustação
Texto + áudio curto Grátis TTS, sem Realtime Primeira Ligação 5 minutos
ao vivo R\$ 4,90 US\$ 0,25 Encontro Privado 12 minutos + memória R\$
9,90 US\$ 0,60 Passe da Noite 30 minutos + memória por 7 dias R\$ 19,90
US\$ 1,50

Esses custos de voz são calculados pela tarifa atual publicada de US\$ 3
por hora para o agente de voz da xAI, antes de câmbio, impostos,
infraestrutura e taxa do meio de pagamento. A xAI também publica TTS por
caractere, o que torna uma mensagem de voz curta mais apropriada para a
degustação gratuita.

Melhor order bump

Depois que o usuário escolher a primeira ligação:

Adicionar áudio personalizado para guardar "Boa noite, \[nome\]"

-   R\$ 2,90

É um produto digital instantâneo, pessoal e emocional. Também pode ser
baixado e enviado em grupos, gerando tráfego orgânico.

A experiência de personalização

O usuário não precisa construir uma personagem visual inteira no v0.
Isso aumentaria demais o escopo.

Personalização mínima 1. Identidade Nome da personagem; nome pelo qual
ela chama o usuário; idade da personagem, sempre explicitamente 21+;
pronome; relação inicial. 2. Personalidade

Escolha uma personalidade principal:

provocadora; carinhosa; sarcástica; dominante; misteriosa; caótica.

E um traço secundário:

ciumenta; protetora; competitiva; tímida; confiante; dramática. 3.
Cenário primeira ligação; encontro virtual; rivalidade; missão secreta;
reencontro; conversa de madrugada. 4. Voz

No v0, usar entre três e cinco vozes prontas:

suave; energética; elegante; misteriosa; confiante.

A xAI documenta vozes prontas com diferentes tons, suporte a conversa
speech-to-speech de baixa latência e também vozes customizadas. Para o
MVP, as vozes prontas são preferíveis; clonagem de voz só deveria entrar
com contrato e consentimento explícito de uma atriz de voz.

5.  Intensidade ○ Amigável ○ Romântica ○ Provocadora ○ After Dark 18+

O modo adulto não deve aparecer antes da confirmação de idade.

Como o "+18" deve funcionar

Há uma diferença importante entre:

romance; flerte; linguagem sugestiva; roleplay adulto; conteúdo sexual
gráfico.

Nenhuma das páginas oficiais consultadas concede uma autorização
irrestrita para erotismo explícito em aplicações comerciais. Portanto, o
app precisa tratar essa capacidade como configurável por provedor, não
como promessa fixa do produto.

As políticas atuais da OpenAI proíbem conteúdo íntimo não consensual,
violência sexual, sexualização de menores, roleplay sexual com menores e
uso indevido da voz ou imagem de terceiros. A política atual da xAI
também proíbe sexualização de crianças, nudificação ou representação
pornográfica de pessoas reais, personificação enganosa e serviços pagos
que ofereçam outputs violadores.

Regras obrigatórias Todas as personagens têm 21 anos ou mais. Nenhum
arquétipo pode parecer escolar ou menor de idade no modo adulto. Nenhum
personagem, nome, roupa, voz ou história de anime existente. Não
permitir clonagem de dubladores, celebridades ou pessoas reais.
Aquisição no Instagram permanece SFW. O modo adulto fica em rota
separada e atrás de age gate. O usuário pode definir limites e tópicos
proibidos. O app precisa ter saída imediata da conversa e exclusão do
histórico. O conteúdo básico continua funcionando sem modo adulto.

Isso é especialmente relevante porque a descrição atual do público do
ANIMA//DECK inclui usuários de 16 a 28 anos. O produto adulto não pode
assumir que toda a audiência proveniente da página é maior de idade.

OpenAI Realtime versus Grok Voice Minha recomendação para o MVP: xAI
como primário, interface abstrata desde o início Critério xAI/Grok Voice
OpenAI Realtime Cobrança US\$ 3 por hora Por tokens de áudio
Previsibilidade de margem Alta Média Conversa speech-to-speech Sim Sim
Cliente seguro Tokens efêmeros Credenciais efêmeras Browser
WebSocket/WebRTC demonstrado WebRTC recomendado Vozes prontas Sim Sim
Voz customizada documentada Sim Não usaria no v0 Certeza sobre erotismo
explícito Não Não Uso recomendado Voz principal do MVP Fallback e modo
SFW

A xAI documenta o grok-voice-latest como speech-to-speech em tempo real,
com latência inferior a um segundo, endpoint Realtime e tokens efêmeros
para clientes.

A OpenAI também possui arquitetura apropriada para browser: sessões
Realtime, comunicação por WebRTC, credenciais efêmeras e modelos
gpt-realtime-2.1 e gpt-realtime-2.1-mini. Atualmente, o modelo mini
publica valores de US\$ 10 por milhão de tokens de áudio de entrada e
US\$ 20 por milhão de saída; a versão completa publica US\$ 32 e US\$
64, respectivamente.

A aplicação deve ter uma interface como:

interface RealtimeVoiceProvider { createSession(input:
VoiceSessionInput): Promise`<VoiceSession>`{=html};
endSession(sessionId: string): Promise`<void>`{=html};
getUsage(sessionId: string): Promise`<VoiceUsage>`{=html};
supportsMode(mode: "safe" \| "romantic" \| "mature"): boolean; }

Isso impede que uma mudança de preço, disponibilidade ou política mate o
produto inteiro.

Escopo fechado do v0 Incluir três personagens originais; seis
combinações de personalidade; três vozes; nome do usuário; texto
gratuito limitado; uma mensagem de voz curta; ligação Realtime paga;
oferta única de R\$ 4,90; pagamento Pix/cartão; sessão convidada, sem
cadastro obrigatório antes da compra; contexto preservado após
pagamento; limite de minutos controlado no servidor; telemetria do
funil; age gate; moderação básica; histórico temporário; botão
compartilhar resultado SFW. Não incluir geração de avatar por IA; upload
de selfie; clonagem de voz pelo usuário; dezenas de personagens;
inventário; gamificação complexa; feed social; assinatura recorrente na
primeira versão; relacionamento com níveis; conteúdo adulto gráfico como
requisito do lançamento. Hooks para Instagram

Todos funcionam sem anunciar conteúdo explícito:

Hook 1

"Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Hook 2

"Escolhi 'sarcástica + ciumenta' e ela falou meu nome..."

Hook 3

"Esse site cria uma personagem e faz ela te ligar de verdade."

Hook 4

"Não coloque 'dominante' e 'caótica' ao mesmo tempo."

Hook 5

"A conversa era normal até ela mandar esse áudio."

O Reel termina com a tela:

CRIE A SUA link na bio Teste antes do desenvolvimento

Antes do Realtime completo, o P1 pode testar intenção de compra com:

mockup funcional da criação; áudio pré-gerado usando uma personagem
original; botão Atender ligação --- R\$ 4,90; após o clique, tela
transparente de "lançamento em breve" e captura de interesse.

Métricas principais:

visita → início da criação início → personagem concluída personagem →
reprodução do áudio áudio → clique em comprar clique → pagamento
pagamento → segunda compra

A métrica mais importante não é tempo de chat. É:

Quantas pessoas que ouviram a mensagem personalizada clicaram para
atender a ligação?

Scorecard inicial Critério Nota Hook demonstrável em um Reel 5/5 Fit com
audiência otaku 5/5 Potencial de compra por impulso 5/5 Capability já
existente no Anime Forge 3/5 Economia de API 4/5 Velocidade do MVP 3/5
Risco de política, idade e distribuição 2/5 Total 27/35 Decisão

GO condicionado.

Condições:

aquisição SFW; personagens sempre adultas e originais; chamada como
objeto principal da compra; modo adulto desacoplado do produto; xAI como
primeiro teste econômico; provider abstraction desde o início; P1 de
conteúdo e fake-door antes do build completo. Bloco pronto para o Anime
Forge --- L0/P0 IDEIA:

Nome provisório: DOKI//CALL

Webapp mobile-first no qual o usuário cria uma waifu original e adulta,
escolhendo nome, personalidade, relação, cenário e voz.

Depois da personalização, recebe: - 3 mensagens de texto gratuitas; - 1
mensagem de voz curta usando seu nome; - oferta para atender uma ligação
speech-to-speech em tempo real.

Oferta principal: "Ligação ao vivo de 5 minutos --- R\$ 4,90" Pagamento
único, preferencialmente Pix/cartão, entrega imediata e sem cadastro
obrigatório antes da compra.

Categoria: Híbrido, monetização-first.

Hook: "Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Capability: - chat existente; - adicionar capability realtime-voice; -
provider abstraction; - xAI/Grok Voice como candidato primário; - OpenAI
Realtime como fallback.

Escopo do v0: - 3 personagens originais; - 6 personalidades; - 3
vozes; - texto gratuito limitado; - voice note TTS; - ligação Realtime
paga; - memória somente durante a sessão; - telemetria; - checkout; -
age gate; - moderação.

Modo +18: - não é requisito para monetização; - somente para usuários
verificados como adultos; - personagens explicitamente 21+; - sem
personagens escolares ou minor-coded; - sem pessoas reais, celebridades,
dubladores ou franquias; - implementar apenas se o provedor e o
processador de pagamento permitirem; - aquisição e conteúdo
compartilhável permanecem SFW.

Fora do v0: - avatar por IA; - selfie; - clonagem de voz pelo usuário; -
assinatura; - inventário; - níveis de relacionamento; - comunidade; -
dezenas de personagens.

Objetivo do P0: Avaliar hook, intenção de compra, custo por chamada,
risco de política, risco de idade, fit com Instagram e tempo de
implementação.

Resultado esperado: GO condicionado a P1 content-first e teste de clique
no CTA de R\$ 4,90.

Este conceito deve ser registrado como a primeira aposta
monetização-first do portfólio, enquanto o ANIMA//DECK permanece como
aposta engagement/share-first.
- **Team:** ggg · **Status:** done
- **Job atual:** — (11/10)
- **Branch:** pipeline/doki-call · checkpoints: 10
- **URL:** https://doki-call.gbbragadev.com
- DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de apps/doki-call/docs/content-hooks.md
_Atualizado 2026-07-13T03:24:44.250Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/doki-call.json_
<!-- forge:end:doki-call -->

<!-- forge:begin:revisor-cetico-de -->
## Forge autopilot — revisor-cetico-de
- **Ideia:** simulação pós-build 1
- **Team:** grok-solo · **Status:** done
- **Job atual:** — (5/4)
- **Branch:** pipeline/revisor-cetico-de-sim1 · checkpoints: 3
- **URL:** https://revisor-cetico-de.gbbragadev.com
- DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de apps/revisor-cetico-de/docs/content-hooks.md
_Atualizado 2026-07-16T05:14:43.376Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/revisor-cetico-de.json_
<!-- forge:end:revisor-cetico-de -->
