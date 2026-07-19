# Forge — fábrica discovery-first: **tese → evidência → experimento → produto**

Forge é um **orquestrador profile-driven de discovery e coding agents**. Novos produtos começam
em uma room, viram tese somente após confirmação humana e precisam de evidência externa verificada
antes do build mínimo. Não é um framework de app nem um wrapper de LLM: é a **fábrica** — discovery,
experimentos, linha de montagem, executores por assinatura, gates de qualidade e git de cada produto.

> **Genérico por design.** O vertical (nicho, marca, domínio, idioma, regras) vive num **profile**
> trocável. O mesmo motor produz um quiz de anime, um advergame ou um SaaS B2B — o que muda é o
> profile, não o código do maestro. (Este repo nasceu como `anime-forge` e foi generalizado.)

## Superfície principal: TUI discovery

```bash
npm run tui          # cliente local do control plane
npm run tui:test     # testes de input, SSE, catálogo e payloads
npm run tui:build    # typecheck/build da TUI
forgenexus           # atalho global deste host; garante o Maestro e abre a TUI
```

A entrada normal agora é igual a um coding agent: **digite a ideia e pressione `Enter`**. Não é
necessário clicar, usar `Tab`, criar a primeira room manualmente ou procurar “Enviar mensagem” na
paleta. `↑`/`↓` troca rooms, `←`/`→` troca teses, `:` abre ações avançadas e `?` mostra ajuda.

A TUI é um cliente fino e keyboard-first: rooms, chat multi-host, tese, evidência, experimento,
build, BragaMarketing e aquisição são ações do catálogo do servidor. As regras de confirmação,
`why`, gates e gasto permanecem server-side. O Control Center web legado continua disponível em
<http://127.0.0.1:8799>, mas não tem paridade completa e sua retirada foi adiada; veja
[`docs/TUI-WEB-PARITY.md`](docs/TUI-WEB-PARITY.md). Para começar pela interface nova, use o
[`tutorial visual discovery-first`](docs/TUTORIAL-VISUAL-DISCOVERY-FIRST.md). O tutorial e o manual legados continuam úteis:
[`docs/GUIA-VISUAL.html`](docs/GUIA-VISUAL.html) e [`docs/MAESTRO.md`](docs/MAESTRO.md).

O próximo incremento planejado da primeira etapa — ramificação de ideias, pesquisa com fontes,
memória leve e canvas web — está especificado em
[`docs/HANDOFF-ETAPA-1-DISCOVERY-STUDIO.md`](docs/HANDOFF-ETAPA-1-DISCOVERY-STUDIO.md).

### Referências para a nova ETAPA 1

Quatro projetos open source foram analisados como referências de produto e arquitetura. Eles não
serão simplesmente incorporados ao Forge: a integração precisa preservar o `DiscoveryWorkspace`,
os gates humanos, os executores por assinatura e a distinção entre sugestão sintética e evidência
externa verificada.

| Projeto | O que ensina ao Forge | Licença e decisão |
|---|---|---|
| [STORM](https://github.com/stanford-oval/storm) | Pesquisa multi-perspectiva: transformar um tema em perguntas, queries, fontes citáveis, outline e mapa de conhecimento. | **MIT.** Adaptar perspectivas, proveniência e candidatos de evidência; não trazer geração de artigo, LiteLLM ou a stack Python completa. |
| [ai-brainstorm](https://github.com/mikecreighton/ai-brainstorm) | Árvore de ideias com linhagem, restrições explícitas e diretivas como inverter premissas, mudar perspectiva e combinar conceitos. | **MIT.** Portar conceitos para TypeScript e limitar a poucos ramos; não adotar o MCTS/paygo como gate de produto. |
| [Khoj](https://github.com/khoj-ai/khoj) | Pesquisa dentro da conversa, fontes visíveis, memória, filtros de escopo, progresso e cancelamento. | **AGPL-3.0.** Referência clean-room; não copiar nem embutir o produto ou seu stack Django/FastAPI/pgvector. |
| [DeepDiagram](https://github.com/LingyiChen-AI/DeepDiagram) | Experiência chat + canvas, streaming, ramificações, detalhe por nó e exportação visual. | **AGPL-3.0.** Referência visual clean-room; o canvas do Forge será derivado deterministicamente do estado canônico. |

A direção resultante é híbrida: **TUI prompt-first** para uso rápido como Codex/Claude Code e um
**Discovery Canvas web realmente clicável** para ramos, fontes e mapas. Nenhum resultado de
brainstorm ou pesquisa abre E1/E2 automaticamente. A análise completa, revisões fixadas, riscos e
plano T0–T6 estão no handoff acima.

---

## 1. A ideia (por que isto existe)

**Tese:** quem paga assinatura de coding agent (Grok, Codex, Claude, GLM, Gemini) tem **capacidade
fixa mensal** — que expira sem uso. O gargalo deixou de ser escrever código: virou **decidir o que
construir, construir rápido e matar rápido**. O Forge converte capacidade ociosa de agente em apps
shippados, em série.

Quatro princípios que o código **impõe** (são mecanismos, não conselhos):

| Princípio | Como o Forge força isso |
|---|---|
| **Nunca API paga por chamada** | Coding agents usam somente CLIs de subscription. O executor é escolhido por turno no chat multi-host; não há paygo implícito. |
| **Prova antes de produto** | Score, consenso e simulação são `synthetic`: ajudam a pensar, mas nunca satisfazem E1/E2/E3 nem liberam build. |
| **Verify objetivo, não autodeclarado** | Evidência externa precisa ser verificada; build só termina com URL/artefato e instrumentação observada. |
| **Humano nas fronteiras externas** | Promover tese, iniciar build, outreach/publicação, deploy e gasto são ações separadas. Gasto exige confirmação, justificativa e teto explícito. |

WIP estrutural: no máximo **3 teses em validação, 1 build e 1 aquisição real**. Não há outreach,
publicação, deploy ou gasto automático; `full_auto` não herda autorização para essas ações.

---

## 2. O loop discovery-first

```
room + chat multi-host
  → promoção humana da tese
  → playbooks + evidência externa verificada
  → E1 (dor + alcance)
  → E2 (ação real)
  → proposta e aprovação do build mínimo
  → build concluído com URL/artefato + instrumentação observada
  → aquisição / handoff BragaMarketing
  → métricas importadas como evidência
  → E3 (comportamento econômico/repetível)
  → P5 kill | iterate | scale
```

Os playbooks provider-neutral são `pressure-test`, `pain-signal-miner`,
`first-customer-finder`, `startup-user-simulator` e `design-audit`. Pain miner e finder geram
candidatos externos inicialmente `unverified`; somente revisão humana os torna elegíveis.
Simulator e design audit são sempre `synthetic`, ainda que produzam score máximo.

Depois de E2, `startFromDiscovery` congela tese, profile, blueprint, critérios e referências de
evidência e entra no menor subconjunto útil do build legado. O build não abre aquisição enquanto
não houver entrega testável e instrumentada. BragaMarketing recebe/exporta dossiê versionado; o
Forge não escreve no repositório externo e importa o retorno como `channel_metric`.

Pipelines criadas antes deste contrato continuam duráveis e retomáveis pelos comandos legados.
Para **novos produtos**, `pipeline.start` não é uma ação pública: todo entrypoint passa pelo
`DiscoveryWorkspace` e por `discovery.build.start` após E1+E2 e aprovação explícita.

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
player/provedor, inclusive no prompt-improver; `fallback` autoriza a cadeia configurada. Quando permitido e um player bate
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
| **gemini** | `agy -p --dangerously-skip-permissions` | etiqueta | Antigravity CLI por assinatura. Modelos locais: Gemini 3.1 Pro e 3.5 Flash; o binário `gemini` legado é rejeitado pelo Google. |
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
  "deploy": { "baseUrl": "gbbragadev.com", "staticHost": "cf-pages", "serverHost": "cf-workers" },
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
| `forge ingest <texto\|arquivo\|pasta\|URL> [--team X] [--review-only] [--apply]` | Cria room/proposta para revisão no discovery; nunca cria profile, blueprint ou pipeline automaticamente |
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
- **gemini** = `agy` (Antigravity CLI), não o binário `gemini`. A autenticação vem do Antigravity; não existe `agy auth login`.

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
- ✅ Deploy Cloudflare Pages / Vercel · dry-run E2E sem quota · 204 testes
- ⏳ Billing (Stripe/Pix) · capability `image` · P4 (measure → kill|scale) automatizado
