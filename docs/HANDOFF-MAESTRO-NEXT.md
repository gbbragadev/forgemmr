# HANDOFF — Maestro HQ / Bernstein / por que não omp.sh

**Para:** qualquer modelo (Claude, Codex, Grok, Gemini, GLM)  
**Repo:** `C:\Dev\anime-forge`  
**Data:** 2026-07-10  
**Objetivo deste handoff:** continuar com precisão o “próximo nível” visual do Maestro **sem** redescobrir o problema do zero.

---

## 1. O que o usuário quer (problema de produto)

Guilherme **não** quer só “um coding agent melhor”.

Ele quer uma **mesa de controle da factory Anime Forge**:

| Requisito | Significado |
|-----------|-------------|
| **Visual** | Ver execução ao vivo no browser, não ficar no terminal digitando |
| **Sem comando** | Botão RUN / presets — não `bernstein -g "..."` na mão |
| **Controle total de modelos** | Pré-mapear quem roda o quê (Claude=UI, Codex=API, Grok=E2E…) |
| **“Cara”** | Identidade (Maestro) — orquestra com rostos, não tool genérico |
| **Multi-sub** | Claude Code + Codex + Grok + Gemini (subscriptions), handoff entre eles |
| **Produto separado** | Cérebro do *app* (chat usuário) = Z.AI/GLM via `ZAI_API_KEY` — **não** é o coding agent |

Isto é **orquestração de CLIs de coding + factory de apps nichados**, não “um agent com LSP no terminal”.

---

## 2. Arquitetura em camadas (não misturar)

```
┌─────────────────────────────────────────────────────────────┐
│  A) WORKBENCH (markdown)                                    │
│     workbench/QUEUE.md · HANDOFF.md · CLAIMS.md             │
│     = kanban + handoff humano entre Grok/Claude/Codex/…     │
│     Loops: L0 product · L1 build · L2 rate-limit handoff    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  B) MAESTRO HQ (cara + partitura + RUN)                     │
│     maestro/index.html · roster.json · server.mjs :8787     │
│     = UI visual, presets, dispatch map, botão RUN           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  C) EXECUTORES (músicos)                                    │
│     grok.exe | codex | claude | gemini | bernstein          │
│     = quem de fato edita código (subscription CLI)          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  D) PRODUTO (WaifuChat / apps/*)                            │
│     packages/ai → Z.AI (glm-4.5-flash) · OpenRouter fallback│
│     = chat do usuário final no webapp                       │
└─────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** A/B/C = *factory*; D = *app*. Keys de coding agent ≠ `ZAI_API_KEY`.

---

## 3. O que já existe no disco (estado real)

### 3.1 Factory / app

| Path | Notas |
|------|--------|
| `apps/waifu-chat` | Next.js, chat streaming |
| `packages/ai` | provider `zai` \| `openrouter` |
| `packages/config`, `credits`, `ui` | kernel |
| `content/personas/` | packs v1/v2 |
| `docs/prompts/NOVO-APP.md` | scaffold app com 1 prompt |
| `docs/GUIA-VISUAL.html` | guia de uso |
| `AGENTS.md` | contrato multi-agent |

### 3.2 Maestro / Bernstein

| Path | Notas |
|------|--------|
| `maestro/index.html` | HQ visual (presets, RUN, log) |
| `maestro/roster.json` | caras + CLIs + dispatch + presets (incl. **E2E Grok**) |
| `maestro/server.mjs` | API `:8787` — `POST /api/run`, SSE `/api/events` |
| `scripts/start-maestro.ps1` | sobe server + abre browser |
| `templates/teams/anime-forge.toml` | team Bernstein pinado |
| `bernstein.yaml` | `team: anime-forge` |
| `docs/MAESTRO.md` | doc Maestro |
| `docs/BERNSTEIN-EXPLICADO.md` | o que é Bernstein |
| `docs/BERNSTEIN-PILOT.md` | piloto install |
| `maestro/e2e-result.md` | **E2E Grok já passou** (build exit 0) uma vez |

### 3.3 Comandos úteis

```powershell
cd C:\Dev\anime-forge
npm run maestro              # http://127.0.0.1:8787
# ou
node maestro/server.mjs
.\scripts\start-maestro.ps1
```

API:

```http
POST /api/run   { "goal": "...", "executor": "grok"|"codex"|"claude"|"bernstein", "playerId": "grok-solo", "maxTurns": 40 }
POST /api/stop
GET  /api/status
GET  /api/events   # SSE
GET  /api/roster
```

### 3.4 Executor Grok

- Binary: `%USERPROFILE%\.grok\bin\grok.exe` (existe na máquina)
- Spawn: headless com `--always-approve --permission-mode bypassPermissions --max-turns N --output-format json --no-alt-screen --check`
- **Problema conhecido (ainda em melhoria):** o Grok CLI emite **TUI/ANSI** no stdout/stderr. Log “plain” no HQ fica ilegível (contadores, shortcuts, lixo).  
- **Mitigação atual no `server.mjs`:**  
  - raw → `maestro/runs/*.raw.log`  
  - UI mostra só marcos + heartbeat + `fs` watch (`e2e-result.md`, `HANDOFF.md`)  
  - anti-hang se `e2e-result.md` contém PASS  
- **Se o log ainda sujar a UI:** o server antigo ainda está em memória → **matar node `maestro/server` e reiniciar**; hard refresh `Ctrl+F5` no browser.

### 3.5 Produto AI (app)

- Default: **Z.AI** `ZAI_API_KEY` em `apps/waifu-chat/.env.local` (gitignored)
- Modelo default: **`glm-4.5-flash`** (free; content limpo)
- Base: `https://api.z.ai/api/paas/v4/`
- Docs: https://docs.z.ai/guides/overview/quick-start
- **Nunca** commitar a key; user já colou key em chat uma vez → preferir rotação

---

## 4. O que falta / próximo nível preciso

### Já feito parcialmente

- [x] Cara (Maestro) + roster  
- [x] Server com RUN real  
- [x] Preset E2E Grok  
- [x] Um E2E Grok PASS (artefato existe)  
- [x] Strip ANSI (insuficiente sozinho) → modo quiet + raw log  

### Ainda incompleto / bugs a tratar

| # | Issue | O que fazer |
|---|--------|-------------|
| 1 | Log web ainda pode mostrar lixo se server velho ou raw vazar | Garantir **só** marcos na UI; nunca dump TUI; opcional painel “raw file path” |
| 2 | Processo Grok **hang** após terminar | Anti-hang por artefato + timeout; testar flags headless mais limpas |
| 3 | RUN 100% mouse sem depender de clipboard | Já é o `POST /api/run` — polir UX (status, progress steps) |
| 4 | Bernstein multi-CLI visual | Opcional: `executor: bernstein` + GUI `:8052` — **não** é o path Grok solo |
| 5 | Roster vs realidade PATH | Gemini CLI pode faltar; Grok path hardcode ok |

### Critério de sucesso do “próximo nível”

1. `npm run maestro` → abrir HQ  
2. Clicar preset **E2E · só Grok** → **RUN**  
3. Log no browser mostra **linhas legíveis** (start, heartbeat, arquivo atualizado, PASS) — **sem** soup de ANSI  
4. `maestro/e2e-result.md` atualizado + `npm run build` documentado  
5. Processo termina (status `done`), não fica “Run em andamento…” eterno  

---

## 5. Por que https://omp.sh/ **não** resolve (e o que ele é)

### O que é o omp.sh

**omp** = **Oh My Pi** ([omp.sh](https://omp.sh/), repo [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)).

- Um **coding agent de terminal** (fork/evolução do Pi)
- IDE “wired in”: LSP, debugger (DAP), hashline edits, subagents, sessions, providers
- Roda **como o próprio agent** (tipo Claude Code / Grok Build / Codex CLI)
- Config, skills, tools — harness de **um** agent (com subagents internos)

### O que o usuário pediu vs omp

| Pedido do usuário | omp.sh | Maestro + multi-CLI |
|-------------------|--------|---------------------|
| Mesa de controle da **factory** | ❌ | ✅ |
| Despachar **vários** CLIs (Claude **e** Codex **e** Grok) com mapa fixo | ❌ (é *um* agent) | ✅ |
| Handoff entre **subscriptions** diferentes (L2) | ❌ | ✅ workbench |
| Cara/roster da orquestra Anime Forge | ❌ | ✅ Maestro |
| Orquestrar **Bernstein** / worktrees multi-agent | ❌ | ✅ Bernstein |
| Coding agent com LSP no terminal | ✅ **isto sim** | (usa os CLIs, não reimplementa) |
| Substituir Claude Code / Grok | possível *como* agent | não é o objetivo |

### Em uma frase

> **omp** = *um músico virtuoso com instrumento completo (IDE no terminal)*.  
> **Maestro** = *a regência + partitura + quem toca o quê na orquestra de músicos (CLIs) que você já paga*.

Trocar tudo por omp seria:

- perder o desenho multi-sub (Claude UI + Codex API + Grok E2E + Grok handoff),
- virar “mais um coding agent” no stack (já tem Claude/Codex/Grok),
- **não** entregar o painel de factory / roster / dispatch map da Anime Forge.

### Quando omp **faria** sentido

- Como **mais um executor** no roster (`cli: omp`) *se* instalar e gostar — no mesmo papel de `claude`/`codex`/`grok`
- **Não** como substituto do Maestro HQ nem do workbench

### Não confundir com

| Tool | Papel |
|------|--------|
| **omp** | 1 coding agent (IDE no TTY) |
| **Bernstein** | Orquestra N coding CLIs + worktrees + gates |
| **Maestro** | UI/cara/presets/RUN em cima dos executores |
| **Langflow** | Flows de LLM de *produto* |
| **CLI-Anything** | Transformar software (GIMP/Comfy) em CLI agent-native |
| **MALLM** | Debate multi-LLM research (API) |

---

## 6. Prompt pronto para o próximo modelo

Cole isto no agent que for continuar:

```
Repo: C:\Dev\anime-forge
Leia por completo:
- docs/HANDOFF-MAESTRO-NEXT.md  (este arquivo)
- docs/MAESTRO.md
- maestro/server.mjs
- maestro/roster.json
- maestro/index.html

Contexto: usuário quer Maestro HQ visual com RUN real, modelos pré-mapeados, cara "Maestro".
E2E Grok solo já passou uma vez (maestro/e2e-result.md).
Problema atual: log no browser poluído pelo TUI do Grok — server foi para modo quiet + raw log + file watch; validar e polir.

Tarefa:
1) Reinicie maestro/server.mjs e confirme POST /api/run com executor=grok.
2) Garanta que o painel em :8787 mostre SÓ marcos legíveis (start, heartbeat, arquivos, PASS/FAIL) — zero ANSI/TUI.
3) Rode E2E preset "e2e-grok" e confirme status done + e2e-result.md.
4) Não reimplemente omp.sh; não troque a arquitetura por um único coding agent.
5) Não commitar secrets (.env.local).
6) Atualize workbench/HANDOFF.md com o resultado.

omp.sh (Oh My Pi) NÃO substitui Maestro: é um coding agent de terminal, não orquestrador multi-CLI da factory.
```

---

## 7. Referências rápidas de arquivos

| Quer… | Abra… |
|-------|--------|
| Continuar Maestro | `docs/HANDOFF-MAESTRO-NEXT.md` (este) |
| Usar factory no dia a dia | `docs/GUIA-VISUAL.html` |
| Novo app 1 prompt | `docs/prompts/NOVO-APP.md` |
| O que é Bernstein | `docs/BERNSTEIN-EXPLICADO.md` |
| Contrato agents | `AGENTS.md` |
| Estado sessão | `workbench/HANDOFF.md` |

---

## 8. Resumo executivo

1. **Ideia:** factory de webapps anime + multi-sub + Maestro visual que despacha CLIs com roster fixo.  
2. **Não é:** “instalar um coding agent melhor (omp) e pronto”.  
3. **omp.sh:** excelente como *agent*, inadequado como *mesa de orquestra multi-CLI / factory control plane*.  
4. **Estado:** base pronta; E2E Grok já PASS; polir log visual + estabilidade do RUN é o trabalho imediato.  
5. **Próximo modelo:** seguir seção 6; validar quiet log + E2E clean finish.
