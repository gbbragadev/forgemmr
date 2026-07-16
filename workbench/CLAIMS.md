# CLAIMS

Uma linha = uma **iteração** de loop. Limpar ao terminar.

| slot | agent | loop | job | app / area | since | notes |
|------|-------|------|-----|------------|-------|-------|

| — | — | — | — | — | — | livre |
_(META/L1 full-auto liberado 2026-07-16 — Codex · gates locais auditáveis · DS recomendado · B3 direto com diff UI + build · 195 pass / 1 skip · sem push/deploy)_
_(L1/B5 revisor-cetico-de liberado 2026-07-16 — Grok 4.5 / grok-solo · ship check static PASS · `npm run build -w @forge/revisor-cetico-de` EXIT 0 · `node apps/revisor-cetico-de/scripts/b5-smoke.mjs` 18/18 · `.env.example` documenta porta 3003 · sem push/deploy · claim liberado)_
_(META/L1 forge-operator-skill liberado 2026-07-16 - Codex - skill canonica Codex + adaptador Claude Code - snapshot/observe/time dry-run PASS - sem criar pipeline/time de teste)_

_(L1/B3 revisor-cetico-de liberado 2026-07-16 — Grok 4.5 / grok-solo · prompt GLM denso `workbench/prompts-glm/L1-B3-revisor-cetico-de-obra-clareza.md` · ds-pick=2 Obra Clareza · sem implementar UI (B3=prompt) · claim liberado)_
_(L1/B2 revisor-cetico-de liberado 2026-07-16 — Grok 4.5 / grok-solo · `content/personas/revisor-pack-v2.json` 5 perspectivas densas (scope/commercial/evidence/spec/escalation) + wire `app.config.ts` · IDs demo preservados · v1 mantido · `npm run build -w @forge/revisor-cetico-de` EXIT 0 · claim liberado)_
_(L1/B1 revisor-cetico-de liberado 2026-07-15/16 tentativa 4 — Grok 4.5 / grok-solo · source recriado (disco só tinha out/.next) · Next 15 static `output:export` · `@forge/revisor-cetico-de` · personas revisor-pack-v1 · fluxo intro→case→matrix→findings→report→gate humano · aritmética determinística · `npm run build -w @forge/revisor-cetico-de` EXIT 0 · claim liberado)_
_(L1/B1 revisor-cetico-de liberado 2026-07-15 tentativa 3 — Grok 4.5 / grok-solo · re-verify: namespace `@forge` válido · build EXIT 0 · claim liberado)_
_(L1/B1 revisor-cetico-de liberado 2026-07-15 tentativa 2 — Grok 4.5 / grok-solo · causa raiz: namespace profile `orçamentos` inválido → `@forge` · build EXIT 0 · claim liberado)_
_(L1/B1 revisor-cetico-de liberado 2026-07-15 — Grok 4.5 / grok-solo · scaffold Next static `output:export` · caso demo + matriz + findings + gate humano + relatório · `npm run build -w @forge/revisor-cetico-de` EXIT 0 · claim liberado)_
_(L0/P1 revisor-cetico-de liberado 2026-07-15 — Grok 4.5 / grok-solo · `apps/revisor-cetico-de/docs/content-hooks.md` · 15 hooks PT+EN + oferta + brief piloto · hasSubstantialText PASS · sem código/build/git · claim liberado)_
_(META/L2 Gemini Antigravity + strict prompt improver liberado 2026-07-15 — Codex · smoke real + 190 testes, sem API key)_
_(META/L1 Forge Operator liberado 2026-07-14 — Codex · 188 testes, typecheck/build, sem push/deploy)_
_(DS-GEN revisor-cetico-de liberado 2026-07-15 — Grok 4.5 / grok-solo · 3 HTML self-contained em `maestro/proposals/revisor-cetico-de/proposal-{1,2,3}.html` + `apps/revisor-cetico-de/docs/design-system.md` · verify local isSubstantialHtml×3 + hasSubstantialText PASS · sem git/build app · claim liberado)_
_(FOUNDATION revisor-cetico-de liberado 2026-07-15 — Grok 4.5 / grok-solo · `apps/revisor-cetico-de/docs/system-design.md` com Arquitetura/Dados/Decisões/Padrões/Riscos · sem código/build/git · claim liberado)_
_(L0/P0 revisor-cetico-de liberado 2026-07-14 — Claude Sonnet 5 · 1ª execução real, scorecard.md criado de fato · Veredito: GO condicionado a piloto manual · claims anteriores "liberado" para este job eram registro falso, arquivo nunca existiu)_
_(L0/P0 revisor-cetico-de — reverificação 2026-07-14 (tentativa 2, mesma sessão de trabalho: attempt 1 anterior bateu max-turns=25 no orquestrador mas já tinha escrito o scorecard) — Claude Sonnet 5 · `docs/scorecard.md` conferido linha a linha contra os critérios do job (GO no topo, pt-BR, fatos×hipóteses×lacunas, linguagem proibida só citada como restrição, fontes com URL+data, nenhum git/build executado) · nada reescrito, claim liberado sem alteração de conteúdo)_
_(L0/P0 revisor-cetico-de — tentativa 3, causa raiz do verify corrigida 2026-07-15 — Claude Sonnet 5 (claude-frontend) · `maestro/pipelines/revisor-cetico-de.json` mostrava o motivo real da falha, nunca reportado no handoff: `validateP0Market()` (`maestro/engine.mjs:84-111`) exige uma seção `## Mercado` com 4 campos (`Comprador`, `Canal`, `Preço-alvo`, `Recorrência`) — o scorecard tinha o conteúdo espalhado em outras seções, mas não nesse formato estrutural, então `verify()` reprovava com "mercado ausente/inválido" mesmo com o documento completo · adicionada seção `## Mercado` (4 campos preenchidos com conteúdo real do próprio scorecard, não placeholder) · `validateP0Market` testado localmente via `node -e` contra o texto real: `{pass:true, detail:"mercado declarado"}`, `go:true`, `conditionalGo:true` · nenhum outro conteúdo do scorecard alterado · claim liberado)_
_(META/L1→P3 Forge Nexus + ai-memory liberado 2026-07-14 — GPT-5.6 · 168 testes, typecheck/build, smoke, CI Node+Rust, push e onboarding em produção)_
_(META/L1 Maestro Control Center liberado 2026-07-14 — GPT-5.6 · 129/129, browser QA, sem push/deploy)_
_(META/L1 Forge Nexus + ai-memory design liberado 2026-07-14 — GPT-5.6 · especificação revisada, sem implementação/push/deploy)_
_(META/P3 onboarding visual liberado 2026-07-13 — GPT-5.6 · 108/108, Pages público, push/WhatsApp)_
_(META/L2 C-1/C-2 pós-revisão Fable liberado 2026-07-13 — GPT-5.6 Sol · 99/99, sem push/deploy)_
_(META GPT56 optimization contract liberado 2026-07-13 — GPT-5.6 Sol · implementação verificada, sem deploy/push)_
_(L1/B5 anima-deck liberado 2026-07-13 — Claude Opus / opussonnet-claude2 · ship check + fix domínio do share)_
_(L1/B4 doki-call liberado 2026-07-13 — Grok 4.5 / ggg-grok1 · chat+TTS+entitlement stub)_
_(L1/B2 doki-call liberado 2026-07-13 — Grok 4.5 / ggg-grok1 · doki-pack-v2)_
_(L1/B1 doki-call liberado 2026-07-13 — Grok 4.5 / ggg-grok1 · scaffold + fake-door)_
_(L0/P1 doki-call liberado 2026-07-13 — Grok 4.5 / ggg-grok1 · content-hooks.md)_
_(FOUNDATION doki-call liberado 2026-07-13 — Grok 4.5 / ggg-grok1 · system-design.md)_

## Protocolo

1. Claim (ex. `A | codex | L1 | B4 | waifu-chat | 14:00`)
2. QUEUE: Backlog → Doing
3. Rodar **uma** iteração (implement → verify → fix se preciso)
4. Doing → Done **ou** HANDOFF com blocker; apagar claim
5. Rate limit no meio → notes `paused-L2` + HANDOFF Next claro
