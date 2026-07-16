# Implementation Plans

Gerados pelo skill improve em 2026-07-16 (auditoria deep, commit base `ab9f479`,
branch `feat/gpt56-optimization`). Execute na ordem abaixo, salvo dependências.
Cada executor: leia o plano inteiro antes de começar, honre as STOP conditions e
atualize sua linha ao terminar.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Higiene: docs errados, CI, artefatos | P1 | S | — | DONE + MERGED — commit `5993c46` |
| 002 | Testes @forge/credits + coverage nativo | P1 | S | — | DONE + MERGED — commit `ff99954` (28 testes, credits 100% cov) |
| 003 | Testes das rotas HTTP mutantes do server | P1 | M | — | DONE + MERGED — commit `87d012a` (17 testes novos) |
| 004 | Hardening server.mjs (body cap + streams) | P2 | S-M | — | DONE + MERGED — commit `b467345` (readBody 413 + streamFile, 4 testes) |
| 005 | Build assíncrono no verify (event loop) | P1 | M | — | DONE + MERGED — commit `ef956d9` (zero execSync) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (razão em 1 linha) | REJECTED.

> **Merged em `feat/gpt56-optimization` em 2026-07-16** (autorizado pelo dono): merges
> `065596e`…`e0cab90`, suíte pós-merge **253 testes · 252 pass · 0 fail · 1 skipped**
> (memory-real-smoke, opt-in). Arquivo `nul` da raiz removido. Único conflito de merge:
> `.env.example` (bloco do revisor × bloco do maestro — mantidos os dois).

## Dependency notes

- Os 5 planos são **independentes entre si** (arquivos disjuntos; 004 cria seu
  próprio arquivo de teste em vez de depender do harness do 003).
- Merge order sugerida: 001/002/003 (zero risco de produção) → 004 → 005.
- 003 e 004 tocam ambos em `maestro/test/` com arquivos NOVOS distintos — sem
  conflito. 002 é o único que edita o `package.json` raiz.

## Findings considered and rejected

(Registrado para não re-auditar. Fonte: auditoria deep 2026-07-16, 8 subagentes,
achados vetados abrindo o código citado.)

- **CORE-03 (leak de SSE client em double-delete)**: `Set.delete` é idempotente
  nos dois caminhos — não há leak.
- **CORE-04 (advanceLoop fire-and-forget)**: tem try/catch/finally interno;
  snapshot imediato é by-design (UI acompanha por SSE).
- **CORE-05 (readBody sem catch nos callers)**: callers embrulham em try/catch.
- **CORE-07 (check-then-act no improver)**: o bloco já está em try/catch com
  fallback para stdout — o crash alegado não existe.
- **SEC-01 (npm audit "crítico")**: real mas 4 low + 4 moderate (arbitrado por
  `npm audit --omit=dev`); o fix `--force` instalaria `next@9.3.3` (downgrade
  catastrófico). Não agir agora; acompanhar patches de `ai`/`next` upstream.
- **SEC-03 (tokens de deploy via env visíveis em ps)**: alegação incorreta (env
  não aparece em ps; mesmo usuário já teria acesso total). `deploy.mjs` já manda
  segredo por STDIN onde suportado (comentário na linha 69). Env var é o
  mecanismo padrão de wrangler/vercel.
- **DEBT-09 ("maestro/test vazio")**: alucinação — são ~50 arquivos, 204 testes.
- **DEBT-10 ("maestro/memory não existe")**: alucinação — existe com 9 módulos.
- **DEBT-07 (módulos grandes = god-modules)**: o próprio auditor concluiu que são
  longos-mas-lineares; tamanho justificado.
- **PERF-05 (suíte 27% mais lenta)**: variância de máquina ocupada (81s vs 102s
  na mesma máquina em horários diferentes); sem baseline controlado não é achado.
- **MEM-06 (ordem do Set em dedup)**: Set do ES2015+ preserva ordem de inserção —
  o próprio achado admite; não é bug.
- **DX-02 parcial (vars fictícias no .env.example)**: FOO_TOKEN/AAA/BBB não
  existem no arquivo; a parte válida (vars de deploy ausentes) entrou no plano 001.
- **DEBT-01 parcial (p4-result.mjs como artefato)**: é módulo validador com teste
  próprio; só `e2e-result.md` + `nul` eram artefatos (plano 001).

## Backlog (achados válidos, abaixo da linha de corte dos 5 planos)

- **TEST.001** forge.mjs (~2000L CLI/TUI) sem nenhum teste — M-L, valioso mas caro.
- **TEST.003** 5 de 6 apps sem testes — começar por revisor-cetico-de e
  pmoc-acceptance-gate se forem a produção séria.
- **TEST.006** o único teste skipped é `memory-real-smoke` (opt-in
  `FORGE_MEMORY_REAL_SMOKE=1`, só Windows x64) — considerar job de CI Windows.
- **PERF-02/03** SSE: broadcast por linha sem batch; replay de 500 eventos numa
  string única — otimizar se o cockpit pesar com múltiplos viewers.
- **PERF-04** `maestro/runs/` sem rotação (4.4 MB/126 arquivos hoje) — cleanup
  por idade no boot do server quando incomodar.
- **CORE-01/F-B4** regex `\b` após nome de seção no verify (`engine.mjs:935`) —
  latente; trocar por `(?=\s|$)` quando mexerem nesse código.
- **CORE-06** `simulator.mjs:44` JSON.parse sem contexto de erro próprio — S, LOW.
- **MEM-01..05, MEM-07, MEM-08** observabilidade/robustez do subsistema de
  memória e timeout de operações no dispatcher do control — S-M, LOW-MED.
- **SEC-04/05/06** cap de sseClients, validação extra de subdomain no deploy,
  documentar o threshold de 8 chars do redactor — defesa em profundidade, S.
- **DEBT-02** constantes duplicadas engine ↔ control-center.js — M.
- **DEBT-03** duplicação parcial de rotas/credits entre apps — M, consolidar em
  packages/ quando um 3º app repetir o padrão.
- **DX-04/DX-07** lint/formatter monorepo-wide + docs de lint — S-M.

## Direction (opções para o dono — não são planos)

Da auditoria de direção (evidência no repo, decisão é de negócio):
1. **P4 measure→kill|scale automatizado** — a tese do produto é o gate kill/scale
   e ele é 100% manual hoje (README §9 ⏳; 4 apps parados em P4 no QUEUE.md).
   Pré-requisito: decidir o sink de telemetria (item 2).
2. **Sink de telemetria** — produção responde 503 `telemetry_sink_required`
   honesto desde a revisão de 13/07; decisão pendente do dono (JSONL local →
   Postgres/ClickHouse/SaaS).
3. **Billing real (Stripe/Pix)** — checkout do doki-call é waitlist honesta;
   `packages/credits` já modela coins/weekly (o plano 002 vira contrato de testes).
4. **Capability `image`** — stated-but-undelivered (README §9, PLAYBOOK "Anime
   Me/haifu"); exige P0 próprio.
5. **API de jobs para dispatch remoto/batch** — o supervisor e o L2 já apontam
   nessa direção; M de esforço aproveitando o engine.
6. **Profile B2B (Braga Suite/Senior)** — a arquitetura de profiles suporta;
   margem maior que o vertical anime; exige decisão de compliance/LGPD.
