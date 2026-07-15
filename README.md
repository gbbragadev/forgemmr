# Forge — fábrica autônoma de apps: **ideia → app no ar**

Forge é um **orquestrador de coding agents** que leva uma ideia da cabeça até um app publicado,
com o humano decidindo só nos pontos que importam. Não é um framework de app nem um wrapper de
LLM: é a **fábrica** — a linha de montagem, os operários (CLIs de IA), os gates de qualidade e o
git de cada produto.

> **Genérico por design.** O vertical (nicho, marca, domínio, idioma, regras) vive num **profile**
> trocável. O mesmo motor produz um quiz de anime, um advergame ou um SaaS B2B — o que muda é o
> profile, não o código do maestro. (Este repo nasceu como `anime-forge` e foi generalizado.)

## Abrir sem terminal

Dê duplo clique em **`forge-control-center.cmd`** na raiz. O supervisor reutiliza o Maestro se ele
já estiver saudável; caso contrário, inicia uma instância local e abre
<http://127.0.0.1:8799>. Pela central você cria e controla pipelines, responde gates, configura
times/profiles/providers e registra P4/P5 sem decorar comandos.

- Tutorial visual: [`docs/GUIA-VISUAL.html`](docs/GUIA-VISUAL.html)
- Manual da central: [`docs/MAESTRO.md`](docs/MAESTRO.md)

---

## 1. A ideia (por que isto existe)

**Tese:** quem paga assinatura de coding agent (Grok, Codex, Claude, GLM, Gemini) tem **capacidade
fixa mensal** — que expira sem uso. O gargalo deixou de ser escrever código: virou **decidir o que
construir, construir rápido e matar rápido**. O Forge converte capacidade ociosa de agente em apps
shippados, em série.

Quatro princípios que o código **impõe** (são mecanismos, não conselhos):

| Princípio | Como o Forge força isso |
|---|---|
| **Nunca API paga por chamada** | Só CLIs de subscription. Não existe client HTTP de LLM no repo — agentes são processos (`spawn`), não requests. |
| **Kill antes de construir** | O P0 (scorecard) roda **antes** de qualquer linha de código e termina num gate `go / retry / kill`. Ideia ruim morre custando 1 job. |
| **Verify objetivo, não autodeclarado** | Job só passa se o **artefato existe** ou o **build sai exit 0**. O agente dizer "pronto" não vale nada. Falhou 3×? Rollback (git) + troca de player. |
| **Humano nos gates, não no loop** | A pipeline anda sozinha e **para** onde a decisão é irreversível ou de gosto: matar a ideia, aprovar a arquitetura, escolher o design, aprovar o visual, autorizar o deploy. |

---

## 2. A pipeline

```
ideia
  │
  ├─ L0/P0      scorecard (mercado, custo, risco legal, TIPO do app)  ──▶ ⏸ gate p0-go       go | retry | kill
  ├─ FOUNDATION system design (arquitetura, dados, decisões, riscos)  ──▶ ⏸ gate foundation-review
  ├─ DS-GEN     3 propostas de design system (HTML navegável)         ──▶ ⏸ gate ds-pick     1 | 2 | 3 | retry | kill
  ├─ L0/P1      content hooks (o que vai atrair usuário)
  ├─ L1/B1      scaffold do app (Next.js, no workspace npm)
  ├─ L1/B2      conteúdo / personas / dados
  ├─ L1/B3      UI polida seguindo o DS escolhido                     ──▶ ⏸ gate b3-visual   (preview real no navegador)
  ├─ L1/B4      wire da API              (só capability `chat`)
  ├─ L1/B5      ship-check (build, lint, typecheck)
  ├─ SIMULATE   5 clientes simulados + relatório JSON/HTML
  │             └─ fixes seguros: no máx. 1× ITERATE → B5            ──▶ ⏸ gate deploy
  └─ P3         ship: merge no repo do app + deploy                   ──▶ app no ar
```

Depois de publicado, o loop de melhoria (`forge feedback`):

```
feedback do dono ──▶ ITERATE ──▶ ⏸ gate iterate-visual ──▶ L1/B5 ──▶ ⏸ gate deploy ──▶ redeploy
```

O simulador é uma heurística estruturada, não entrevista, analytics nem previsão de conversão.
Exatamente cinco personas examinam a interface real. Só copy/layout/estados reversíveis marcados
com alta confiança podem entrar na única rodada automática; auth, billing, dados, deploy, domínio,
segurança e decisões legais sempre ficam para revisão humana.

**O tipo do app (`static | quiz | chat`) é decidido pelo P0**, não por você num menu: o scorecard
declara `Tipo:` e o gate `p0-go` confirma (com `retry`+feedback se você discordar). O `go` aplica a
sequência de jobs e o alvo de deploy (chat ⇒ server host; senão static host). Quem tem contexto para
dizer se a ideia precisa de backend é o P0 — e esse custo aparece no scorecard, antes do build.

---

## 3. Arquitetura

```
maestro/
  engine.mjs      state machine: jobs, gates, verify, git, dispatch, cooldown/fallback (L2)
  server.mjs      HTTP :8799 (http puro, sem framework) + SSE + API + cockpit
  forge.mjs       CLI + TUI full-screen (wizards, attach ao vivo, decisão por tecla)
  index.html      cockpit web: gates renderizados, propostas em iframe, preview do app
  adapters.mjs    matriz de spawn por CLI (grok/codex/claude/glm/gemini/fake) + sanitizer + redactor
  improver.mjs    prompt-improver (reescreve o prompt do job antes de executar)
  operator.mjs    ingest/evolve: lê ideia, arquivo, pasta, URL, PDF ou DOCX e propõe/aplica
  simulator.mjs   contrato das cinco personas + seleção limitada de fixes reversíveis
  toolbox.mjs     catálogo de skills/subagentes do host que o improver pode escolher
  roster.json     players (modelo + effort) e teams (dispatch por job, fallbacks, revisor)
  deploy.mjs      Cloudflare Pages / Vercel / GitHub Pages
  pipelines/      estado durável — 1 arquivo por app (sobrevive a restart do server)
  runs/           raw log de cada job (auditoria: o que o agente respondeu de verdade)

profiles/<slug>/profile.md   biblioteca de verticais (o ativo é copiado p/ .forge/profile.md)
docs/prompts/*.md            1 template por job = o contrato de trabalho do agente
blueprints/<nome>/           contratos versionados de pipeline, com linhagem (ex.: gameads)
integrations/startup-user-simulator/  skill MIT vendorizada e pinada por commit
workbench/                   QUEUE · HANDOFF · CLAIMS (estado legível/retomável por humano)
apps/<app>/                  cada app tem REPO GIT PRÓPRIO (a fábrica ignora apps/)
packages/{ui,config,ai,credits}   kernel compartilhado pelos apps (workspaces npm)
```

### Repo por app + N pipelines concorrentes

Cada `apps/<app>` tem **`.git` próprio**; a fábrica ignora `apps/`. Todo git do run (branch
`pipeline/<app>`, checkpoint por job PASS, rollback, merge do ship) acontece **dentro do repo do
app** — por isso **N pipelines rodam ao mesmo tempo sem disputar working tree**. O app continua
workspace npm (compartilha `packages/*`), mas tem histórico, branch e remote independentes.

O motor é um `Map<appId, engine>`: cada app tem estado, executor e **profile congelado no start**
(trocar o profile no meio não contamina run em andamento). Logs e SSE são etiquetados por `[appId]`;
cockpit e TUI listam e selecionam. Trade-offs registrados em
[`docs/system-design-git-control.md`](docs/system-design-git-control.md).

### Prompt-improver

Todo prompt de job passa por um **modelo dedicado** antes de ir ao executor. Ele reescreve o prompt
(mais específico e acionável, **sem perder nenhuma restrição**) e **escolhe skills e subagentes** do
host que o executor deve invocar.

```
prompt do job ──▶ codex · gpt-5.6-terra · HIGH ──(falhou/limite)──▶ claude · haiku · MAX ──(falhou)──▶ prompt ORIGINAL
```

Blindagens: timeout, JSON inválido, ou prompt que volte **menor que 80% do original** (sinal de
restrição perdida) ⇒ usa o original. **O improver nunca trava nem degrada a pipeline.** Skills e
subagentes só são anexados quando o executor consegue invocá-los (`claude`/GLM). Em dry-run o
improver é fake (zero quota). Cada tentativa deixa raw log em `maestro/runs/`.

### Dispatch, fallback e o loop L2

`roster.json` define **players** (CLI + modelo + effort) e **teams** (qual player pega qual job, quem
é fallback, quem revisa). Cada time declara `fallbackPolicy`: `strict` nunca troca para outro
player/provedor; `fallback` autoriza a cadeia configurada. Quando permitido e um player bate
rate-limit (`429`, `529`, `overloaded`, quota), o engine o põe em **cooldown** e redispatcha o mesmo
job — sem humano. É o **L2**: handoff automático entre provedores. O time **Só Grok** é `strict`.

O papel **Revisor** (opcional no team) roda uma revisão adversarial depois de B1/B4: corrige problema
real, e se quebrar o verify é revertido. Advisory-safe.

---

## 4. Executores suportados

| CLI | Como o Forge chama | Effort | Notas |
|---|---|---|---|
| **grok** | `grok -p <goal> --effort <e>` | **real** | Grok Build CLI (SuperGrok). Goal posicional abre TUI e trava — sempre `-p`. |
| **codex** | `codex exec -m <model> -c model_reasoning_effort=<e>` | **real** | GPT-5.6 (sol/terra/luna). Sandbox: ver gotchas. |
| **claude** | `claude -p --model <m> --permission-mode bypassPermissions` | etiqueta | Opus · Sonnet · **Fable 5** (`claude-fable-5`) · Haiku. |
| **glm** | `claude` + env Z.ai (`ANTHROPIC_BASE_URL=api.z.ai`) | etiqueta | GLM 5.2 via Coding Plan. |
| **gemini** | `agy -p --dangerously-skip-permissions` | etiqueta | Antigravity CLI (o binário `gemini` foi descontinuado). |
| **fake** | `node maestro/fake-exec.mjs` | — | **dry-run**: gera os artefatos que o verify espera. Zero quota. |

*Effort real* = o flag muda o raciocínio do modelo. Nos demais é **etiqueta** (aparece no log e no
roster, mas o CLI não expõe o knob).

---

## 5. Configuração — o profile é o vertical

`profiles/<slug>/profile.md` = um bloco ` ```forge-config ` (JSON, lido pela engine) + markdown
narrativo (contexto do projeto, injetado em **todo** prompt). O profile ativo é copiado para
`.forge/profile.md`.

```jsonc
{
  "name": "GameAds",
  "namespace": "@forge",             // workspaces npm: @forge/<app>
  "niche": "advergames gamificados",
  "i18n":   { "defaultLocale": "pt-BR", "locales": ["pt-BR"], "rule": "single" },
  "deploy": { "baseUrl": "exemplo.com", "staticHost": "cf-pages", "serverHost": "vercel" },
  "git":    { "targetBranch": "master", "commitPrefix": "forge" },
  "legal":  { "ipRules": ["nada de IP de terceiros"] },
  "capabilities": ["static", "quiz", "chat"],

  "limits": {                        // knobs do run (defaults abaixo)
    "maxAttemptsPerPlayer": 3,
    "cooldownMs": 3600000,           // rate-limit → 60 min de cooldown
    "jobTimeoutMs": { "L0/P0": 900000, "default": 1800000 },
    "jobMaxTurns":  { "L1/B3": 50, "ITERATE": 50, "default": 30 }
  },
  "promptImprover": {
    "enabled": true,
    "cli": "codex", "model": "gpt-5.6-terra", "effort": "high",
    "fallback": { "cli": "claude", "model": "haiku", "effort": "max" }
  }
}
```

O **narrativo** do profile é fonte da verdade nos prompts: os templates de `docs/prompts/` podem
citar exemplos de outro nicho, e o agente é instruído a **adaptar ao contexto do profile**.

---

## 6. Comandos

```bash
npm install
node maestro/forge.mjs      # ou: npm run forge   (o server sobe sozinho)
```

| Comando | O que faz |
|---|---|
| `forge` | **Wizard**: profile → ideia (aceita caminho `.md`/`.txt`) → nome do app → time → confirmar |
| `forge ingest <texto\|arquivo\|pasta\|URL> [--team X] [--review-only] [--apply]` | Tria profile/blueprint, persiste a decisão e inicia quando seguro/aprovado |
| `forge evolve <texto\|arquivo\|pasta\|URL> [--executor codex] [--apply]` | Propõe mudança no próprio Forge; sem `--apply` nunca executa agente |
| `forge new "<ideia>" [--team X] [--app-id X] [--dry-run]` | Start direto. Com `--idea-file doc.md` o app-id vem do **nome do arquivo** |
| `forge feedback` | **TUI de iteração**: escolhe o app → escreve o feedback → escolhe o time |
| `forge simulate <app> [--team X] [--dry-run]` | Roda cinco personas em um app concluído e no máximo uma melhoria automática segura |
| `forge attach [app]` · `forge status` | TUI ao vivo · snapshot de todas as pipelines |
| `forge decide <gate> <go\|retry\|kill\|1\|2\|3> [feedback…] [--app X]` | Decide um gate (ou por tecla no TUI) |
| `forge stop [app]` · `forge kill [app]` · `forge resume [app]` | Pausa · mata o run agora (sem precisar de gate) · retoma |
| `forge remove <app> [--force]` | Apaga tudo do app: repo, estado, propostas, workbench |
| `forge restart [--force]` | Recarrega o código do maestro. **Recusa se houver job vivo** |
| `forge profile init` · `forge team` · `forge roster` | Cria/ativa profile · monta time (provedor→modelo→effort→funções) · lista |

**Teclas no TUI:** `g` go · `r` retry · `f` retry+feedback · `1/2/3` escolher proposta · `k`+`k` kill · `q` detach.
**Cockpit:** <http://127.0.0.1:8799> — renderiza scorecard/system design, abre as 3 propostas em
iframe, mostra o preview do app e traz os botões de decisão.

### Testar sem gastar quota

```bash
npm test                                   # suíte node:test da fábrica
forge new "ideia de teste" --team dry-run  # pipeline E2E com executor fake
```

Blueprint não é tema nem profile: é o **contrato de ordem dos jobs, verificação e gates**. O
`generic` herda o fluxo padrão; contratos específicos podem ser criados, derivados, versionados,
arquivados e restaurados na área Fábrica. Veja [`docs/FORGE-OPERATOR.md`](docs/FORGE-OPERATOR.md).

---

## 7. Gotchas (conhecimento caro — não redescubra)

**Windows**
- **`spawn ENAMETOOLONG`** — o prompt vai como *argumento* do CLI e o Windows corta em **32.767
  chars**; ideia grande + system design + design system estouram isso. Sintoma: exit 1 em 0s, log
  vazio, 3 tentativas em 1 segundo. → Prompt acima de 6k vai **por arquivo** (`maestro/.prompts/`) e
  o CLI recebe a referência.
- **git walk-up** — `git` com cwd fora de um repo **sobe a árvore** e opera no repo pai (na sua HOME,
  se houver um `.git` lá). Há guards no engine: não os remova.

**CLIs**
- **codex trava lendo stdin** (`Reading additional input from stdin...`) se o pipe fica aberto. Todos
  os executores são spawnados com `stdio: ["ignore", …]`.
- **codex sem sandbox** — o helper `codex-windows-sandbox-setup.exe` não existe em toda máquina; com
  `--full-auto` o codex **não consegue nem ler arquivo** e ainda sai com **exit 0** (parece sucesso).
  O Forge usa `--dangerously-bypass-approvals-and-sandbox`; para religar o sandbox:
  `FORGE_CODEX_SANDBOX=workspace-write`.
- **GLM `529` / `overloaded` = rate-limit**, não falha de trabalho (`api.z.ai` sobrecarregado). Se não
  for tratado assim, queima as 3 tentativas do player em vez de trocar de provedor.
- **grok** — goal posicional abre a TUI e trava; sempre `-p`.
- **gemini** = `agy` (Antigravity CLI), não o binário `gemini`.

**Deploy**
- Cloudflare Pages: o CNAME do domínio custom precisa ser **DNS-only** (proxied ⇒ Error 1014). O
  subdomínio `.pages.dev` pode não ser `<app>.pages.dev` (a CF sufixa em colisão) — leia da API.

---

## 8. Contratos e docs

| Arquivo | Para quê |
|---|---|
| [`AGENTS.md`](AGENTS.md) | contrato canônico dos agentes (loops L0/L1/L2) — Claude/Codex/Grok/Gemini leem o mesmo |
| [`docs/AGENT-PIPELINE.md`](docs/AGENT-PIPELINE.md) | loops em detalhe + roteamento por rate-limit |
| [`docs/prompts/`](docs/prompts/) | 1 template por job: o que o agente recebe e o critério de sucesso |
| [`docs/system-design-git-control.md`](docs/system-design-git-control.md) | repo-por-app + concorrência (decisão registrada) |
| [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) | o L0 de negócio: scorecard, kill/scale |
| [`workbench/`](workbench/) | QUEUE/HANDOFF/CLAIMS — estado legível por humano, retomável sem o maestro |

---

## 9. Estado

- ✅ Pipeline completa (P0 → ship) com gates humanos e verify objetivo
- ✅ **N pipelines concorrentes**, repo git por app, estado durável por app
- ✅ Biblioteca de **profiles** (vertical trocável) e **teams** montáveis na TUI
- ✅ **Prompt-improver** com fallback em cascata e seleção de skills/subagentes
- ✅ Loop de **feedback** sobre app já publicado (ITERATE → redeploy)
- ✅ Deploy Cloudflare Pages / Vercel · dry-run E2E sem quota · 59 testes
- ⏳ Billing (Stripe/Pix) · capability `image` · P4 (measure → kill|scale) automatizado
