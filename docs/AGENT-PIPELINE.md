# Agent Pipeline — loops multi-provedor

Um **processo em loops**, vários motores (**Codex / Claude / Grok / Gemini / GLM**).  
Estágios são **passos dentro** dos loops — não uma fila linear cega.

```
┌─────────────────────────────────────────────────────────────┐
│  L0  PRODUCT LOOP  (um app / uma ideia)                     │
│  score → content test → build loop → ship → measure → K/S  │
│         └──────── se kill: próxima ideia ─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  L1  BUILD LOOP  (código — até DoD ou bloqueio)             │
│  claim → implement → build/smoke → fix → update handoff     │
│         └──────── repete até verde ───────────────────────┘ │
│  B1 lógica → B3 visual → B5 → SIMULATE → gate ship        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  L2  AGENT HANDOFF LOOP  (limites / troca de provedor)      │
│  rate-limit? → HANDOFF.md → outro agente → mesmo claim/job │
│         └──────── sem reexplicar o repo ──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Frase mágica (colar em qualquer agente)

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + workbench/QUEUE.md.
Identifique o loop (L0/L1/L2) e rode UMA iteração do job livre.
Claime em CLAIMS.md. Ao terminar: HANDOFF + QUEUE + liberar claim.
Coding agent = só subscription. Keys de produto: ler env, nunca pedir no chat.
```

### Atalhos de sessão

| User diz | Agente faz |
|----------|------------|
| `segue` / `próximo job` | 1 job da QUEUE (ou HANDOFF Next) |
| `pode decidir e seguir` | Decide GO/NO-GO e **executa** o próximo step lógico (ex.: scaffold após P0+P1) sem re-perguntar |
| `siga até decisão minha` | Encadeia jobs **só** enquanto não precisar de: measure humano, key nova, billing, domínio, ou produto ambíguo |
| UI feia / apelo visual | **Não codar UI** → gerar prompt denso em `workbench/prompts-glm/` (GLM 5.2 MAX) |
| commit / push / deploy liberado | Fazer até o ship path documentado; se faltar token, fallback + HANDOFF |
| `outra ideia` / `próximo app` / `setar ideia nova` | Ver **Como setar outra ideia** abaixo + `docs/PLAYBOOK.md` + prompt `docs/prompts/L0-NOVA-IDEIA.md` |

---

## Como setar outra ideia (app anterior terminou)

Quando um app saiu do build (ex. anime-quiz em Pages) e o user quer a **próxima aposta**:

1. **Done** nos jobs de build do app anterior na `QUEUE.md` (P4 measure humano pode ficar no Backlog, à parte)
2. Liberar `CLAIMS.md`
3. Backlog: `- [ ] **L0/P0** Scorecard: <app-id> — <frase>`
4. `HANDOFF.md`: Loop ativo = ideia nova; Next = P0 → P1 → B1
5. Rodar `docs/prompts/L0-P0-scorecard.md` (ou `L0-NOVA-IDEIA.md`)
6. GO → P1 hooks; **não** B1 sem P0 GO (e preferir P1 antes do scaffold)

**Não** reescrever o app antigo “só mudando tema” se for produto novo — novo L0 / novo `apps/<id>`.

Passo a passo completo + frase mágica: **`docs/PLAYBOOK.md`** § *Como setar outra ideia*.

---

## Lições de produção (2026-07 · waifu-chat + anime-quiz)

| Lição | Implicação no loop |
|-------|-------------------|
| B1 YAGNI = “funciona, texto seco” (~4/10 visual) | **Esperado.** Não polish no B1. Enfileirar **B3** com prompt denso. |
| Prompt GLM vago → UI meh; prompt denso → ~7.5/10 | B3 = **brief de design** (checklist `workbench/prompts-glm/README.md`) |
| GLM constrói bem; direção fraca se brief ralo | Quem gera o prompt (Grok/Codex) é dono da qualidade visual |
| Content-first (P0→P1) reduz scaffold inútil | **Proibido B1** sem P0 GO (e preferir P1 hooks antes) |
| Porta :3001 Docker devolve “Running” | Preferir :3000 ou portas livres; smoke real = curl HTML, não só “process up” |
| Vercel sem login / CF token sem Pages | Ship matrix: static → **GitHub Pages**; server → Vercel com token |
| `output: "export"` só se app sem API no free path | Quiz static OK; chat precisa Node |
| 1 sessão ≠ app inteiro | P0→P1→B1→B3→B5→SIMULATE em **várias** iterações (exceto “siga até decisão” com gates claros) |

Detalhe visual/prompts: `workbench/prompts-glm/README.md`.

---

## Keys do produto (tabela canônica)

| Key | Agent faz o quê? | Para quê |
|-----|------------------|----------|
| `ZAI_API_KEY` / `GLM_API_KEY` | Lê se `PRODUCT_AI_PROVIDER=zai` | App chat (default atual) |
| `OPEN_ROUTER_API_KEY` | Lê env sistema se openrouter | App — smoke |
| `OPENROUTER_API_KEY` | Lê se existir | Fallback `.env.local` |
| `OPENROUTER_MODEL` / `ZAI_MODEL` | Lê se existir | Modelo |
| `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_API_KEY` paygo | **Não** | Coding agent |

Smoke chat: `GET /api/health`. Quiz estático: **sem** key.

Guia: `docs/GUIA-VISUAL.html` · Gemini sub: `GEMINI.md`

---

## L0 — Product Loop

Uma volta = uma aposta de app. **Não** abra L0 novo com L1 vermelho no app atual.

| Step | Nome | Output | Agente |
|------|------|--------|--------|
| P0 | Scorecard | GO/NO-GO + arquivo `docs/scorecard-<id>.md` | Grok/Gemini |
| P1 | Content hooks | `docs/content-hooks-<id>.md` (15 PT-BR) | Grok/Gemini |
| P2 | Enter L1 | B1…B5 + SIMULATE | Codex/Grok/Claude/GLM |
| P3 | Ship | URL pública | Grok/Codex + CI |
| P4 | Measure | 5–7d bio/CTR | **Humano** (+ Grok resume) |
| P5 | Kill/Scale | matar ou novos jobs L1 | Grok + user |

```
P0 ──go──► P1 ──(sinal ou “pode decidir”)──► P2 (L1) ──► P3 ship ──► P4 ──► P5
 │ no-go      sem sinal / wait human                         │
 └─ fim       └─ NÃO scaffold                                 ├─ kill → novo P0
                                                              └─ scale → B3/B2/image na QUEUE
```

### Gates L0 (não pular)

1. **P0 GO** obrigatório antes de B1  
2. **P1 hooks** obrigatório antes de declarar “content-ready”; B1 com só P0 exige user **“pode decidir e seguir”**  
3. **P3 URL** antes de P4 measure sério  
4. Capability nova (`image`) sem score → **só conteúdo**, sem L1  

Prompts: `docs/prompts/L0-*.md`.

---

## L1 — Build Loop

Uma sessão = **1 job** (salvo “siga até decisão” com lista de jobs não-ambíguos).

```
CLAIM → IMPLEMENT|PROMPT → VERIFY → FIX* → HANDOFF
```

### Jobs e qualidade esperada

| Job | O que entrega | O que **não** entrega | Preferência |
|-----|---------------|----------------------|-------------|
| **B1 Scaffold** | App roda, fluxo core, build verde | Beleza anime / share card final | Codex/Grok |
| **B2 Personas** | Pack JSON originais | UI | Grok/Gemini |
| **B3 UI** | Apelo visual shareable | Lógica nova / API | **GLM preferido; player do time em strict** |
| **B4 Wire API** | chat/credits/health | Redesign | Codex |
| **B5 Ship check** | Checklist PASS/N-A + Next P3/P4 | Features novas | qualquer |
| **SIMULATE** | JSON+HTML com 5 personas e fixes priorizados | Pesquisa real / métricas inventadas | qualquer |
| **P3 Deploy** | URL (Pages/Vercel) | Measure | Grok + CI |

### Split B1 / B3 (crítico)

```
B1  = “dá pra usar”     → texto seco OK
B3  = “dá pra printar”  → implementação direta no full_auto; prompt GLM nos modos legados
```

Agente em B3 no `full_auto`:
1. Implementar a UI diretamente com `docs/prompts/L1-B3-ui-implement.md`.
2. Seguir a proposta escolhida automaticamente a partir de `design-system.md`.
3. Alterar arquivos reais de interface e manter o fluxo funcional.
4. Passar o build; sem diff visual real, o verify reprova.
5. Respeitar time strict: Grok-only continua Grok-only, sem fallback escondido.

Nos modos legados, manter o fluxo de prompt denso em `workbench/prompts-glm/` e handoff manual para GLM.

Template: `docs/prompts/L1-B3-TEMPLATE.md` · exemplos em `workbench/prompts-glm/`.

### VERIFY por tipo de app

| Tipo | Comando | Smoke extra |
|------|---------|-------------|
| Chat (waifu) | `npm run build` | `GET /api/health`; 1 stream se key ok |
| Quiz estático | `npm run build:quiz` | curl HTML contém título app; **sem** health key |
| Qualquer | port livre | se :3001 = Docker “Running”, mudar porta |

Máx 3 fix no mesmo erro → BLOCK + L2.

---

## P3 — Ship matrix

| App free path | Host preferido | Notas |
|---------------|----------------|-------|
| Static (`output: "export"`) | **GitHub Pages** (workflow no repo) | `PAGES_BASE_PATH=/<repo>` no CI |
| Server (API routes) | **Vercel** | precisa `vercel login` ou `VERCEL_TOKEN` |
| CF Pages | se token com **Pages write** | token “whoami only” não basta |

Checklist ship:
- [ ] B5 PASS (ou N/A documentados)
- [ ] SIMULATE válido; qualquer auto-fix passou por no máximo 1× ITERATE→B5
- [ ] Push `master` (autorizado)
- [ ] Workflow verde **ou** deploy CLI OK
- [ ] URL no HANDOFF + hooks CTA apontam pra URL
- [ ] Secrets fora do git

Exemplo live: `https://gbbragadev.github.io/anime-forge/` (AnimeQuiz).

---

## L2 — Agent Handoff

```
rate-limit / contexto sujo → HANDOFF (Next + Blockers + Files)
  → claim paused-L2 → outro provedor → MESMO job
```

| Situação | Próximo |
|----------|---------|
| Claude limit | Codex B1/B4 · Grok L0 · GLM B3 |
| Codex limit | Grok L0/B2 · Claude/GLM B3 |
| Grok limit | Gemini L0 · Codex L1 |
| UI job na fila | Gerar/atualizar prompt GLM; user executa GLM |

---

## Mapa S0–S6 → loops

| Antes | Agora |
|-------|--------|
| S0 | L0/P0 |
| S1 | L1/B1 |
| S2 | L1/B2 |
| S3 | L1/B3 |
| S4 | L1/B4 |
| S5 | L0/P1 |
| S6 | L1/B5 |

---

## Anti-colisão

1. Um claim = uma iteração  
2. Dois agents: apps diferentes **ou** `content/` vs `packages/`  
3. Kernel (`packages/*`): claim exclusivo  
4. Não L0 de app B com L1 vermelho em A  
5. Frontend forte ≠ coding agent default (usa GLM prompt)

## Skill

`.agents/skills/ship-niche-app/SKILL.md`

## workbench

| Arquivo | Papel |
|---------|--------|
| `QUEUE.md` | Backlog / Doing / Done + loop/job |
| `HANDOFF.md` | Last agent, Next, Blockers, **URL ship**, Lessons |
| `CLAIMS.md` | slot ativo |
| `prompts-glm/` | briefs B3 densos |

## Bernstein (opcional L1)

`docs/BERNSTEIN-PILOT.md` — progresso multi-CLI; **não** substitui workbench L0/L2.
