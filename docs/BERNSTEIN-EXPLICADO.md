# Bernstein — explicado de verdade

> Versão visual no browser: seção Bernstein em [`GUIA-VISUAL.html`](./GUIA-VISUAL.html)  
> Piloto local: [`BERNSTEIN-PILOT.md`](./BERNSTEIN-PILOT.md) · site: [bernstein.run](https://bernstein.run)

---

## Em uma frase

**Bernstein não é um LLM.**  
É um **maestro (scheduler em Python)** que manda **vários coding agents de terminal** (Claude Code, Codex, Gemini CLI…) trabalharem num **mesmo repositório git**, cada um na sua **cópia isolada (worktree)**, mostra o **progresso**, roda **testes/build** e só **junta** o que passou.

---

## Analogia

Imagine uma orquestra:

| Papel | Quem é |
|-------|--------|
| **Você** | Dono da obra: define o *goal* (“adicione rate limit”) |
| **Bernstein** | Maestro: decide *quem* toca *qual* parte, em que ordem, e se o ensaio passou |
| **Claude Code / Codex / Gemini CLI** | Músicos: escrevem e editam código de verdade (cada um na sua sub) |
| **Janitor / verify** | Fiscal: `npm run build`, lint, testes |
| **Git worktrees** | Salas de ensaio separadas — ninguém pisa no partitura do outro |
| **Audit log** | Partitura gravada: o que aconteceu, em que ordem (replayável) |

Sem Bernstein você abre o Codex, pede uma coisa, espera, troca pro Claude, perde contexto, não tem “painel” do time.

Com Bernstein você diz o goal **uma vez**; ele **quebra** em tarefas, **dispara** agents, **mostra** status, **valida**, **mergeia**.

---

## O que ele faz (4 estágios)

```
1. DECOMPOSE     Você: "Add JWT auth"
                 Bernstein: vira 3–4 tarefas (middleware, tests, docs…)
                      │
2. SPAWN         Cada tarefa → 1 agent CLI em 1 git worktree
                 (claude em pasta A, codex em pasta B, em paralelo se couber)
                      │
3. VERIFY        Roda gates (build/test/lint). Falhou → retry ou outro modelo
                      │
4. MERGE         Só o que passou volta pro branch principal
```

**Importante:** o “cérebro de orquestração” (quem roda quando, quem está bloqueado) é **código determinístico**, não um LLM gastando token para “decidir o time”.  
Os agents é que são LLMs (via CLIs da sua subscription).

---

## O que ele **não** é

| Não é | Por quê |
|-------|---------|
| Substituto do **workbench** (QUEUE/HANDOFF) | Workbench orquestra **você + Grok + handoff humano** entre apps |
| Langflow / flow de chat | Não monta RAG nem chatbot visual |
| CLI-Anything | Não vira GIMP/Comfy em CLI |
| MALLM / llm-council | Não é debate multi-modelo via API |
| OpenRouter do WaifuChat | OpenRouter = **produto** (usuário conversa com persona) |

Bernstein = **fábrica de código com vários operários CLI**.  
Workbench = **kanban + handoff multi-sub** (incluindo Grok, que o Bernstein não “é”).

---

## Como encaixa na Anime Forge

```
L0  ideia / content / kill     →  workbench + Grok/Gemini (sem Bernstein)
L1  código pesado              →  agent manual  OU  Bernstein (opcional)
L2  rate limit de uma sub      →  HANDOFF.md → outra sub
App chat                       →  OPEN_ROUTER_API_KEY (Windows)
```

| Situação | Ferramenta certa |
|----------|------------------|
| “Quem faz o próximo job da QUEUE?” | `workbench/QUEUE.md` + claim |
| “Quero progresso ao vivo de 2 agents codando” | `bernstein live` |
| “Grok escreve 15 hooks” | prompt L0, **não** Bernstein |
| “Codex implementa API + build tem que passar” | Codex manual **ou** Bernstein |

**Verdict atual do piloto:** *thin keep* — instalado e útil **se** você for rodar L1 code-heavy; não vira o centro da factory.

---

## Peças no seu disco

| Caminho | Função |
|---------|--------|
| `bernstein.yaml` | Goal + constraints + budget do projeto |
| `.sdd/` | Workspace interno (runtime, audit, runs…) — em grande parte no `.gitignore` |
| `templates/` | Roles/workflows que o init criou |
| `docs/BERNSTEIN-PILOT.md` | Log do piloto (doctor, adapters) |

---

## Comandos do dia a dia

```powershell
cd C:\Dev\anime-forge

bernstein doctor          # preflight: claude/codex no PATH? OAuth?
bernstein agents list     # catálogo de “personas” de agent (não confunda com personas anime)

# Monitor (progresso de verdade)
bernstein live            # TUI no terminal
bernstein dashboard       # UI web local
bernstein status          # resumo
bernstein logs            # tail da saída dos agents
bernstein cost            # quanto “gastou” por task/modelo

# Executar
bernstein                 # usa goal de bernstein.yaml
bernstein -g "texto do goal"
bernstein stop            # encerra com graça

# Depois da run
bernstein recap           # o que passou/falhou
```

### Fluxo recomendado na 1ª run real

1. Terminal A: `bernstein live`  
2. Edite `bernstein.yaml` com um **goal pequeno e seguro**  
3. Terminal B: `bernstein`  
4. Observe tasks nascerem, agents trabalharem, verify rodar  
5. Se merge bagunçar: `git status` / worktrees — revise antes de confiar em main  

---

## Subscription vs API (sua regra)

| Camada | Correto |
|--------|---------|
| Agents que o Bernstein **dispara** | Claude Code / Codex / Gemini CLI **já logados na sub** |
| OpenRouter | **Só** o app WaifuChat (`OPEN_ROUTER_API_KEY` no Windows) |
| Se o Bernstein exigir key paga de coding | **Parar** e documentar — não é o modelo que você quer |

No seu PC (piloto): **Claude OAuth ✓**, **Codex ✓**, **Gemini CLI ✗** (não está no PATH).

---

## Worktree em português

- Cada tarefa vira uma **cópia de trabalho** do repo (`git worktree`).  
- Agent A edita arquivos numa cópia; Agent B em outra.  
- Só depois do **verify** o Bernstein tenta **juntar** no branch principal.  
- Por isso o repo **precisa ser git** (por isso fizemos `git init` no anime-forge).

Sem git → Bernstein quebra. Com git sujo/confuso → worktrees complicam: comece com goal **mínimo**.

---

## Exemplo concreto (Anime Forge)

**Goal ruim (não faça):**  
“Faça a factory de apps anime completa com billing e image gen.”

**Goal bom:**  
“Só edite `docs/X.md` e garanta `npm run build` passar. Não mude packages/.”

Isso é o que está (ou estava) no `bernstein.yaml` de piloto: forçar escopo pequeno + gate de build.

---

## Quando usar / quando não

### Use Bernstein se

- Quer **ver** agents rodando (progresso).  
- Tem **2+ CLIs** logados e um goal **quebrável** em tarefas.  
- Aceita git worktrees + revisão de merge.  
- Job é L1 (código).

### Não use se

- Só precisa de um agent (abra Codex/Claude direto).  
- Job é copy/score (Grok + prompt L0).  
- Você não quer que nada mexa em git sozinho.  
- Overhead te irrita mais do que ajuda.

---

## Cara visual: Maestro HQ

Não quer digitar comando o tempo todo? Use a **cara** da orquestra:

| | |
|--|--|
| Painel | `maestro/index.html` |
| Launch | `scripts/start-maestro.ps1` (duplo clique) |
| Roster / models | `maestro/roster.json` (pré-mapeados) |
| Doc | `docs/MAESTRO.md` |

Fluxo: **clique no preset → goal copiado → Bernstein GUI ao vivo** (`:8052/ui`).

---

## Resumo mental

```
Workbench  = kanban + memória entre VOCÊ e várias SUBs (incluindo Grok)
Bernstein  = orquestra CLIs de código (engine)
Maestro HQ = cara + partitura + 1 clique (skin da factory)
Z.AI/GLM   = cérebro do APP pro usuário final
```

Quatro camadas. Não misture.
