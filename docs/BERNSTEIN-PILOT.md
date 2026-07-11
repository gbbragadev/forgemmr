# Bernstein pilot — Anime Forge

**Data:** 2026-07-10  
**Versão:** bernstein 3.1.0  
**Repo:** `C:\Dev\anime-forge`

> **O que é o Bernstein?** leia [`BERNSTEIN-EXPLICADO.md`](./BERNSTEIN-EXPLICADO.md) (analogia + pipeline + quando usar).

## Objetivo do piloto

Ver se o Bernstein serve para **acompanhar / executar** jobs L1 com CLI coding agents (Claude Code, Codex, Gemini CLI), em paralelo ao workbench multi-sub.

## Pre-check (doctor)

| Check | Resultado |
|-------|-----------|
| Adapter **claude** | ✓ PATH + OAuth active |
| Adapter **codex** | ✓ PATH |
| Adapter **gemini** | ✗ não no PATH (key GEMINI pode existir; CLI não instalada) |
| `.sdd` workspace | ✓ após `bernstein init` |
| Port 8052 | ✓ |
| Git | ✓ após `git init` + commit inicial (antes falhava) |
| Ready to run | ✓ (com ressalvas) |

Comandos úteis:

```powershell
uv tool install bernstein   # ou install.ps1
cd C:\Dev\anime-forge
bernstein init
bernstein doctor
bernstein agents sync
bernstein live              # TUI progresso
bernstein dashboard         # UI web
# Run com goal em bernstein.yaml:
bernstein
# ou:
bernstein -g "goal curto e seguro"
```

## Config local

- `bernstein.yaml` — goal de piloto + constraints (npm build, surgical, sem secrets)
- `.sdd/config.yaml` — port / workers
- `.gitignore` — `.sdd/runtime/`, runs, audit, `nul`

## O que NÃO fazer com Bernstein

| Não | Por quê |
|-----|---------|
| Substituir workbench L0/L2 | Grok app e handoff humano ficam no markdown |
| Usar como cérebro OpenRouter do coding | Sub CLIs only; OpenRouter = produto |
| Goals gigantes no dia 1 | Custo + worktrees |
| Confiar em pytest default | Factory usa **`npm run build`** |

## Tools avaliados e fora do core

| Tool | Veredito |
|------|----------|
| CLI-Anything | Software agent-native (Comfy/GIMP) — depois image |
| Langflow | Flows de produto LLM — não coding progress |
| Multi-Agent-LLMs / MALLM | Debate research API — não factory |
| karpathy/autoresearch | Loop treino LLM — não monorepo apps |
| karpathy/llm-council | Council OpenRouter — P0 opcional só |
| andrej-karpathy-skills | Já coberto por skill global karpathy-guidelines |
| **Bernstein** | **Piloto L1** — progresso + multi-CLI |

## Decisão (piloto install)

| | |
|--|--|
| **Verdict** | **Thin keep** (por enquanto) |
| Install | PASS — `bernstein` 3.1.0 via `uv tool install` |
| Doctor adapters | PASS — Claude + Codex |
| Full orchestrated run | **Não executada neste passo** (evitar custo/tempo; goal pronto em `bernstein.yaml` para você disparar) |
| Workbench | Continua verdade multi-sub (Grok incluso) |

### Próximo experimento (você)

```powershell
cd C:\Dev\anime-forge
bernstein live   # outro terminal
bernstein        # usa goal de bernstein.yaml
```

Se a run passar e o progresso for útil: **Keep** para jobs L1 code-heavy.  
Se overhead alto: **Drop** e ficar só workbench + `forge` CLI futura.

## Mapa L0/L1 ↔ Bernstein

| Job | Tool |
|-----|------|
| L0 P0/P1 (Grok) | workbench + prompts |
| L1 B1–B5 code | **Bernstein** (opcional) ou agent manual |
| L2 handoff Grok | workbench HANDOFF |
| Progresso visual | `bernstein live` / `dashboard` |
