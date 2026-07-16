# Implementation Plans

Gerados pelo skill **improve**.

- **Onda 1** (2026-07-16, deep, base `ab9f479`): planos **001–005** — todos
  **DONE + MERGED** em `feat/gpt56-optimization`.
- **Onda 2** (2026-07-16, standard, base `895cc63`): planos **006–020** —
  segurança, docs de job, créditos, DX, tests, perf e 2 spikes de direction.

Execute na ordem abaixo salvo dependências. Cada executor: leia o plano inteiro,
honre STOP conditions e atualize a linha de status ao terminar.

## Execution order & status

### Onda 1 (histórico)

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Higiene: docs errados, CI, artefatos | P1 | S | — | DONE + MERGED — `5993c46` |
| 002 | Testes @forge/credits + coverage | P1 | S | — | DONE + MERGED — `ff99954` |
| 003 | Testes rotas HTTP mutantes do server | P1 | M | — | DONE + MERGED — `87d012a` |
| 004 | Hardening server (body cap + streams) | P2 | S-M | — | DONE + MERGED — `b467345` |
| 005 | Build assíncrono no verify | P1 | M | — | DONE + MERGED — `ef956d9` |

### Onda 2 (TODO)

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 006 | SEC: validar `ai.envKey` no deploy Workers (shell) | P1 | S | — | DONE — assertSafeEnvKey + testes |
| 007 | DOC: prompts `@anime-forge` → `@forge` / path forge | P1 | S | — | DONE — docs/prompts + AGENT-PIPELINE |
| 008 | SEC: confinar blueprint id + `verify.path` | P1 | S | — | DONE — loader + engine verify |
| 009 | SEC: operator SSRF + path sob root | P1 | S-M | — | DONE — readIntakeSource + testes |
| 010 | CORE/SEC: crédito pós-IA + sanitize msgs + zero coins cookie | P1 | M | — | DONE — guest-safe + sanitize + waifu pós-IA |
| 011 | SEC: HMAC no cookie de créditos | P2 | M | 010 | DONE — seal/open + CREDITS_COOKIE_SECRET |
| 012 | CORE: goal file por run (fim da race `.run-goal.txt`) | P2 | S | — | DONE — runs/<runId>/goal.txt |
| 013 | DX: lint root = workspaces + typecheck no CI | P2 | S | — | DONE — package.json + test.yml |
| 014 | DX: fake-exec delay default 0 | P2 | S | — | DONE — FORGE_FAKE_DELAY_MS |
| 015 | DEP: pinar OpenNext/wrangler no path Workers | P2 | S | — | DONE — OPENNEXT_CF + WRANGLER pins |
| 016 | TEST: caracterização `workbench.mjs` | P2 | S-M | — | DONE — workbench.test.mjs |
| 017 | TEST: `@forge/ai` env + trimHistory | P2 | S | — | DONE — packages/ai/test/env.test.mjs (env only; index SDK skip) |
| 018 | PERF: cache do control snapshot | P2 | M | — | DONE — TTL 2s + pipeline key |
| 019 | DIRECTION: spike sink de telemetria | P3 | M | — | DONE (doc) — docs/telemetry-sink-decision.md |
| 020 | DIRECTION: spike loop P4/P5 + prefills | P3 | M | 019 (soft) | DONE (doc) — docs/p4-measure-loop.md |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (razão em 1 linha) | REJECTED.

## Dependency notes

```
006 007 008 009 012 013 014 015 016 017 018 019  → paralelizáveis
010 → 011 (HMAC depois do guest-safe)
019 → 020 (preferir decisão de sink antes do loop measure; 020 design-only ok em paralelo)
```

**Ordem sugerida de merge (segurança primeiro):**  
006 → 008 → 009 → 010 → 007 → 012 → 014 → 013 → 015 → 016 → 017 → 011 → 018 → 019 → 020

**Nota de sessão:** Vercel foi removido do deploy operacional (CF Pages/Workers +
`baseUrl`/domínio). Plano 015 **não** reintroduz Vercel — só pina CLIs Workers.

## Findings considered and rejected (onda 2 + herdados)

Não reabrir sem evidência nova:

- Rate-limit falso positivo (T-03) — guard `exitCode !== 0` + testes
- Cooldown some no restart (F-B2) — ressemeado no boot do engine
- `stats.mjs` binário (F-B3) — usa `\u0000` escapado
- SSE double-delete leak, advanceLoop fire-and-forget, improver check-then-act
- npm audit force (downgrade Next catastrófico)
- God-modules só por tamanho de arquivo
- Target Vercel como feature — **removido de propósito** (não é bug a restaurar)
- Planos 001–005 — já merged

## Backlog residual (abaixo da linha, sem plano nesta onda)

- Cap de `sseClients` / batch de linhas SSE
- Rotação/prune de `maestro/runs/` (ajuda 018; fazer quando disco doer)
- Regex `\b` em seções de verify (F-B4 / CORE-01 latente)
- `forge.mjs` CLI/TUI — cobertura ainda parcial
- File lock no workbench (016 caracteriza; lock é follow-up)
- Capability `image` — exige P0, não plano de build

## Direction index

| ID | Tema | Plano |
|----|------|-------|
| Telemetria / sink prod | 019 |
| P4 measure → P5 kill\|scale | 020 |
| Billing real | depende 010+011; sem plano de Stripe ainda |
| Profile B2B / jobs API remota | sem plano — decisão de produto |

## Como executar um plano

```text
1. Ler plans/NNN-*.md por completo
2. Drift check no SHA stamped
3. Branch advisor/NNN-<slug>
4. Steps + verify commands
5. Atualizar status nesta tabela
6. Não push/PR sem o dono pedir
```

Ou: `/improve execute plans/006-sec-deploy-envkey-shell.md` (worktree isolado + review).
