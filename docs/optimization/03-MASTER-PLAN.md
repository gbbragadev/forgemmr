# 03 — Plano-mestre: backlog priorizado e ondas

**Commit-base:** `0423528` · **Executor previsto:** GPT-5.6 Sol Ultra · **Revisor:** Fable 5 (Modo B)

---

## 1. Fórmula de priorização (transparente, mas não soberana)

Cada item recebe 1–5 em nove eixos. O score é um **ordenador**, não um juiz — onde o julgamento
técnico discorda da fórmula, o julgamento manda e a divergência está anotada.

```
score = (2·MRR + 2·Confiabilidade + Qualidade + Throughput + 2·Aprendizado) × Confiança
        ─────────────────────────────────────────────────────────────────────────────────
                              (Esforço + Risco) ÷ Reversibilidade
```

MRR, Confiabilidade e Aprendizado pesam o dobro: são os três eixos do objetivo declarado (receita,
não quebrar, acertar mais na próxima). Confiança multiplica — finding sem evidência não sobe na
fila por ser interessante.

## 2. Backlog

| ID | Finding | MRR | Conf | Qual | Thru | Apr | Confiança | Esf | Risco | Rev | Score | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **T-01** | `build:all` quebrado | 2 | 5 | 5 | 3 | 1 | 5 (executado) | 1 | 1 | 5 | **~163** | **P0** |
| **T-02** | `gh-pages` mismatch | 3 | 5 | 3 | 2 | 1 | 5 | 1 | 1 | 5 | **~145** | **P0** |
| **T-03** | rate-limit falso positivo destrói trabalho | 3 | 5 | 4 | 5 | 2 | 5 (executado) | 2 | 2 | 5 | **~106** | **P0** |
| **T-04** | escrita de estado não-atômica | 2 | 5 | 3 | 2 | 2 | 5 | 1 | 1 | 5 | **~120** | **P0** |
| **T-05** | cooldown por-pipeline | 2 | 4 | 2 | 5 | 2 | 5 | 2 | 2 | 4 | **~75** | **P1** |
| **T-06** | times gerados sem fallback | 2 | 5 | 2 | 5 | 2 | 5 | 2 | 2 | 4 | **~80** | **P1** |
| **T-07** | `errorTail` some do snapshot | 2 | 3 | 3 | 3 | 4 | 5 | 1 | 1 | 5 | **~100** | **P1** |
| **T-08** | P0 não pergunta comprador/canal/preço | **5** | 1 | 3 | 1 | **5** | 5 | 2 | 2 | 5 | **~106** | **P1** |
| **T-09** | gate `p1-signal` (GO condicionado não vincula) | **5** | 2 | 2 | 2 | 4 | 5 | 2 | 3 | 4 | **~74** | **P1** |
| **T-10** | telemetria durável + P4 estruturado | **5** | 1 | 2 | 1 | **5** | 5 | 3 | 2 | 4 | **~76** | **P1** |
| **T-11** | contexto colado = dado, não instrução | 1 | 4 | 3 | 1 | 1 | 5 | 2 | 2 | 5 | **~60** | **P1** |
| **T-12** | pin de versões no deploy | 1 | 4 | 2 | 1 | 1 | 5 | 1 | 1 | 5 | **~72** | **P1** |
| **T-13** | doki-call promete o que não entrega | **5** | 1 | 4 | 1 | 3 | 5 (fetch) | 1 | 2 | 5 | **~117** | **P1** |
| **T-14** | CI não roda testes | 1 | 5 | 4 | 2 | 2 | 5 | 1 | 1 | 5 | **~105** | **P2**→sobe p/ Onda 0 |
| **T-15** | `verify` raso (FOUNDATION/DS-GEN/P1) | 2 | 3 | 4 | 2 | 2 | 5 | 2 | 2 | 5 | **~59** | P2 |
| **T-16** | improver sem cache (até 24 min mortos/job) | 2 | 1 | 1 | 5 | 1 | 4 | 2 | 2 | 5 | **~46** | P2 |
| **T-17** | `history-reader` (agregar runs que já existem) | 3 | 1 | 1 | 2 | **5** | 5 | 2 | 1 | 5 | **~73** | P2 |
| **T-18** | hardcodes `anime-forge` / templates com path morto | 2 | 2 | 3 | 2 | 2 | 5 | 2 | 1 | 5 | **~57** | P2 |
| **T-19** | `deploy.mjs` sem teste · `FORGE_FAKE_FAIL` sem teste | 1 | 4 | 4 | 1 | 1 | 5 | 3 | 1 | 5 | **~47** | P2 |
| **T-20** | segurança de borda: CORS do SSE, `mode 600`, limpeza de `.prompts/` | 1 | 3 | 2 | 1 | 1 | 4 | 2 | 1 | 5 | **~40** | P2 |
| — | workbench sem lock · `.run-goal.txt` compartilhado · preview 404 em chat · taskkill async · explicabilidade de dispatch | — | — | — | — | — | — | — | — | — | baixo | P3 |

**Divergência fórmula × julgamento:** T-14 (CI) sai como P2 pela fórmula, mas **sobe para a Onda 0**.
Motivo: sem CI verde, nenhuma onda seguinte tem rede de segurança — e o custo é de 6 linhas de YAML.

**NÃO FAZER** (justificado em `00` §4 e `01` §6): scheduler adaptativo por histórico · worktree por
job · kernel de MRR com 4 archetypes · banco/fila/vector DB · reescrita da engine.

---

## 3. Ondas

Cada onda é independente, verificável e reversível. **Não iniciar uma onda com a anterior vermelha.**

### Onda 0 — Rede de segurança (antes de tocar em comportamento)

> Sem isto, nenhuma mudança seguinte é auditável.

- **T-14** CI rodando `npm test` em push/PR
- **T-01** `build:all` funcionando (é parte do "a suíte compila?")
- Testes de caracterização **já criados** (`maestro/test/characterization.test.mjs`, 4/4 verde) —
  o GPT-5.6 deve mantê-los verdes ou justificar por escrito cada quebra.

**Definição de pronto:** CI verde no GitHub · `npm test` 63/63 (59 + 4) · `npm run build:all`
exit 0 · nenhum comportamento de runtime alterado.

---

### Onda 1 — A fábrica para de se sabotar

> Bugs que destroem trabalho, corrompem estado ou quebram a autonomia. Todos com fix pequeno.

- **T-03** rate-limit só com `exitCode !== 0` + evidência de recebimento
- **T-04** escrita atômica de `pipelines/<app>.json` + log no recovery
- **T-02** `gh-pages` unificado
- **T-06** `composeTeam` gera fallback real
- **T-05** cooldown global no manager
- **T-07** `errorTail` (truncado) volta ao snapshot

**Definição de pronto:** teste novo para cada item (rate-limit não dispara com "429" no texto do
agente e dispara com exit≠0; `save()` sobrevive a JSON truncado; `composeTeam` produz fallback;
cooldown de um app afeta o outro) · caracterização verde · dry-run E2E verde.

---

### Onda 2 — Aproveitar melhor o que já se paga

> Tokens, tempo e contexto. Nada aqui muda o produto — muda o custo de produzi-lo.

- **T-11** contexto colado tratado como dado (envelopado + marcadores neutralizados)
- **T-16** improver com cache por base de prompt (não re-improva a cada tentativa)
- **T-15** `verify` exige seções preenchidas em FOUNDATION/DS-GEN/P1
- **T-12** versões pinadas no deploy
- **T-20** borda de segurança (CORS do SSE, `mode 0o600`, limpeza de `.prompts/`)

**Definição de pronto:** teste de injeção (um `system-design.md` com "IGNORE AS INSTRUÇÕES
ANTERIORES" não vira instrução) · improver não roda 2× para a mesma base · artefato oco reprova ·
`npm test` verde.

---

### Onda 3 — A fábrica passa a construir coisa vendável

> **É a onda que justifica todas as outras.** Sem ela, o resto é engenharia bonita sem receita.

- **T-08** scorecard P0 com seção **Mercado** obrigatória (comprador · canal · preço · recorrência)
  e `verify` que a exige
- **T-09** gate `p1-signal` para "GO condicionado"
- **T-13** doki-call para de prometer o que não entrega (CTA vira captura de interesse honesta)
- **T-10a** beacon de funil → `events.jsonl` durável (por app, no kernel)

**Definição de pronto:** um P0 sem comprador/canal **reprova no verify** (teste) · um scorecard
"GO condicionado" cria o gate `p1-signal` (teste) · `doki-call` no ar não retorna mais
`status: "paid"` sem PSP · um evento de funil sobrevive a restart do processo.

---

### Onda 4 — A fábrica aprende entre lançamentos

> O que transforma "lançar mais" em "acertar mais".

- **T-10b** P4 emite `p4-result.json` (schema fixo) além da prosa
- **T-17** `history-reader`: lê os `maestro/runs/*.json` **que já existem** e agrega taxa de
  acerto por player/job, tempo por job, causa de morte
- Registro de motivo de kill no `decide()`

**Definição de pronto:** `forge stats` (ou equivalente) responde, com dados reais do repo: "qual
player passa mais em B3?", "quanto tempo custa um app?", "por que o app X morreu?" · dois apps
diferentes produzem `p4-result.json` comparáveis.

---

## 4. Dependências

```
Onda 0 ──▶ Onda 1 ──▶ Onda 2
                 └──▶ Onda 3 ──▶ Onda 4
```

- Onda 1 exige Onda 0 (sem CI e sem `build:all`, não há como provar que nada quebrou).
- Onda 3 exige Onda 1 (não adianta o P0 fazer a pergunta certa se a fábrica descarta o trabalho
  do agente por um falso rate-limit).
- Onda 4 exige Onda 3 (não há o que agregar sem coleta).
- Onda 2 é **paralelizável** com a 3 — não se tocam.

## 5. Rollback

Cada tarefa é um commit isolado, atrás de um teste. Rollback = `git revert <sha>`.
Duas exceções que exigem cuidado:

- **T-05 (cooldown global)** muda estado compartilhado no manager. Se der ruim, o revert é limpo
  (o campo por-pipeline continua existindo até a tarefa apagá-lo — **não apagar no mesmo commit**).
- **T-13 (doki-call)** mexe em app **em produção**. Deploy só com autorização explícita do dono
  (ver `HANDOFF-TO-GPT56.md` §"exige autorização").

## 6. Ordem recomendada

`T-14 → T-01 → T-03 → T-04 → T-02 → T-06 → T-05 → T-07 → T-08 → T-09 → T-13 → T-10a → T-11 → T-16 → T-15 → T-12 → T-20 → T-10b → T-17`

Racional: rede de segurança → parar a sabotagem → **fazer a pergunta certa antes de construir** →
medir → só então economizar token e polir. Um dia de trabalho na Onda 3 vale mais que uma semana
na Onda 2, porque a Onda 2 otimiza a produção de algo que talvez ninguém queira.
