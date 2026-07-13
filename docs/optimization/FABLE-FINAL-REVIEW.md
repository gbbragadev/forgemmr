# Revisão adversarial Fable (Modo B) — implementação GPT-5.6

**Data:** 13/07/2026 · **Branch:** `feat/gpt56-optimization`
**Base:** `240fd22` (confirmado: é o meu commit de handoff) · **Head funcional:** `539afac` (confirmado: era o HEAD quando esta revisão começou)
**Revisor:** Claude Fable 5 · método: `05-REVIEW-CHECKLIST.md`, tudo re-executado por mim.

---

## 1. Verificação global — executada por MIM, não aceita do relatório

| Comando | Alegado pelo GPT | Medido por mim | Veredito |
|---|---|---|---|
| `npm test` | 97/97 | **97/97 PASS, 0 fail (39.9s)** | ✅ bate |
| `npm run typecheck` | 8 workspaces, exit 0 | **exit 0** | ✅ bate |
| `npm run build:all` | 4 apps, exit 0 | **exit 0, 4× "Compiled successfully"** | ✅ bate |
| `forge stats` | tabelas com dados reais | **imprime PASS/player-job com dados reais** (inclusive o honesto `ggg-grok1 L0/P1 1/16 = 6%`) | ✅ bate |

**Prova de que os testes novos não são teatro** — rodei os 10 arquivos de teste novos num
worktree no commit-base `240fd22`:

```
ℹ tests 18 · pass 2 · fail 16
```

**16/18 falham no base** e passam no head → provam mudança de comportamento real. Os 2 que
passam no base são guardas de não-regressão (ex.: "GO simples não recebe gate"), o que é o
comportamento correto para eles.

**Scan de segredos** no diff completo: vazio. **Dependências novas:** nenhuma. **Banco/fila/serviço
novo:** nenhum. **Push/deploy:** nenhum foi executado pelo GPT (confirmado: `origin` não tem a branch).

## 2. Resultado por tarefa (evidência que eu mesmo li/rodei)

| ID | Veredito | Evidência da revisão |
|---|---|---|
| T-01 | **VERIFIED** | `package.json` → `--workspaces --if-present`; build:all exit 0 rodado por mim |
| T-02 | **VERIFIED** | `deploy.mjs:506` aceita `gh-pages` **e** `gh-pages-path`; mensagem de erro atualizada; teste falha no base |
| T-03 | **VERIFIED** | Guard `res.exitCode !== 0 &&` em `engine.mjs:978`; teste de **integração** com `FORGE_FAKE_ECHO` existe e falha no base (31s de run real); os 8+ casos unitários passam; a alternativa permissiva `\brate.?limit exceeded\b` é a exigida pelo contrato (o discriminador é o exit code) |
| T-04 | **VERIFIED** | tmp+rename em `save()`; recovery loga e preserva o arquivo corrompido (`engine.mjs:1644-1647`); teste de JSON truncado falha no base |
| T-05 | **VERIFIED com ressalva** | `Map` no manager compartilhado entre engines; `p.cooldowns` continua persistido p/ cockpit. **Ressalva: F-B2 (restart), abaixo** |
| T-06 | **VERIFIED** | `composeTeam` encadeia todos os colegas como fallback, preserva colisão primeiro, solo fica vazio; 3 testes |
| T-07 | **VERIFIED** | Snapshot devolve `errorTail` truncado ≤500; caracterização atualizada **com justificativa** (quebra intencional documentada — exigência I-9 cumprida); TUI mostra as 3 últimas linhas via `tuiLogRows` |
| T-08 | **VERIFIED** | `validateP0Market` exige Comprador/Canal/Preço-alvo/Recorrência, reprova placeholder (<8 chars úteis, TBD/TODO/n/a); NO-GO **completo** continua indo ao gate humano (decisão preservada); prompt e PLAYBOOK atualizados |
| T-09 | **VERIFIED** | `p.conditionalGo` setado no verify do P0; `GATES_AFTER["L0/P1"]` cria `p1-signal` só quando condicionado; retorno `null` é tratado no caller (`engine.mjs:1198`); teste E2E de 22s falha no base |
| T-10a | **VERIFIED (local) / BLOCKED (prod)** | doki-call `edc2298`: JSONL local sobrevive a restart; produção responde **503 `telemetry_sink_required`** em vez de fingir que gravou. Honesto. Decisão de sink é do dono |
| T-10b | **VERIFIED** | `p4-result.mjs` valida schema fixo (strings, números ≥0 finitos, verdict enum); prompt P4 manda registrar 0 e explicar — não inventar |
| T-11 | **VERIFIED** | `untrustedBlock` envelopa TODO conteúdo colado (narrative, system-design, DS, feedbacks, inputs, erro de retry). Tentei escapar: ``` ``` vira ` ``​` ` (não fecha fence), `<<<`/`>>>` ganham ZWSP, `--- FIM` vira `-​--` — as três rotas de escape que tentei estão neutralizadas |
| T-12 | **VERIFIED** | wrangler pinado `4.108.0`; vercel `--no-install` (falha fechado — pacote não está no lockfile; decisão correta, e a dúvida foi levantada por escrito) |
| T-13 | **VERIFIED (local)** | doki-call `32ba6df`: checkout **não** concede mais entitlement, `status: "waitlist"`, sem `orderId`; copy honesta. Li o diff da rota inteira. Não publicado — correto |
| T-14 | **PARCIAL → VERIFIED no push desta revisão** | `test.yml` correto (npm ci + npm test, workflow separado do deploy morto F-28). Actions só confirma com push — o push desta revisão valida |
| T-15 | **VERIFIED** | `thinMarkdownSections`/`isSubstantialHtml`/`hasSubstantialText` endurecem FOUNDATION/DS-GEN/P1. **O fake-exec foi endurecido junto, não afrouxado** — comparei os dois diffs lado a lado; o fake agora gera artefatos substanciais (a armadilha nº1 da checklist NÃO aconteceu) |
| T-16 | **VERIFIED** | Improver roda 1× por (runId, job, player, hash do prompt-base); retries anexam o erro novo **depois** da reescrita, envelopado; feedback novo muda o hash → invalida cache. Caracterização afirma o cache-hit |
| T-17 | **VERIFIED com ressalva** | `forge stats` agrega os runs reais; rodei. **Ressalva: F-B3 (arquivo binário), abaixo** |
| T-20 | **VERIFIED** | SSE perdeu `Access-Control-Allow-Origin: *`; `log()` do server passa pelo redactor; arquivos sensíveis via `writePrivateFile`/`openPrivateFile` (0600 + chmod); `.prompts/` limpo no fim do run. No Windows os bits POSIX não aparecem no `stat` — a ressalva do GPT está correta e foi honesta |
| T-18/T-19 | **DEFERRED** | conforme contrato — corretamente não tentadas |

## 3. Findings

### MUST FIX

**F-B1 · A entrega estava órfã de commit.** O `HANDOFF-TO-FABLE-REVIEW.md` afirmava *"Head
entregue: o commit de fechamento que contém este arquivo"* — **esse commit não existia**. Os dois
relatórios estavam untracked e `GPT56-IMPLEMENTATION-PLAN.md` + `workbench/*` modificados sem
commit. Um `git clean`/`checkout` teria apagado a evidência da entrega inteira.
**Resolvido nesta revisão:** commit de fechamento feito por mim (ver histórico). Para a próxima
leva: entregável sem commit não é entregável.

### SHOULD FIX (pequenos, vão no HANDOFF-BACK)

**F-B2 · Cooldown global esquece tudo num restart.** `dispatchPlayer` agora só consulta o `Map`
em memória (`engine.mjs:631`); no boot, ninguém ressemeia o `Map` a partir do `p.cooldowns`
persistido. No commit-base o cooldown **sobrevivia** a restart (o dispatch lia o estado
persistido). Regressão de comportamento: `forge restart` no meio de um cooldown de 60 min
libera o player na hora e a fábrica volta a martelar um provedor estourado.
**Fix mínimo:** ao carregar estado no `createEngine`, semear: para cada `p.cooldowns[id]` com
data futura, `cooldowns.set(id, epoch)`.

**F-B3 · `stats.mjs` é binário para o git.** Há um **byte NUL cru** no fonte (offset 1026:
`` `${player}\0${job}` `` como separador de chave composta). Funciona no Node, mas o git marca o
arquivo como binário **para sempre**: sem diff, sem blame, sem review de mudanças futuras.
**Fix mínimo:** trocar o byte cru pela sequência de escape `"\u0000"` (6 chars ASCII) — mesma
semântica, arquivo volta a ser texto.

### NICE TO HAVE

**F-B4 · `\b` no fim do regex de seções é latente.** `verify()` monta `^${section}\b` — se um
blueprint futuro tiver seção terminando em caractere não-word (ex.: `"CTA (principal)"`), o `\b`
nunca casa e a seção é dada como ausente. Hoje nenhuma seção real termina assim (conferi o
blueprint gameads). Trocar `\b` por `(?=\s|$)` quando alguém mexer nesse código.

### REJECTED (ataques meus que o código refutou — registrados para não voltarem)

- **"O fake-exec foi afrouxado para o verify passar"** — o oposto: o verify endureceu E o fake
  passou a gerar artefatos substanciais. As duas mudanças são coerentes, não compensatórias.
- **"`rate limit exceeded` sem âncora pega prosa do agente"** — pega mesmo, e é **contratual**
  (a frase é idêntica nos dois mundos; o discriminador é o exit code, que está no engine e tem
  teste de integração que falha no base).
- **"`untrustedBlock` escapável"** — tentei fence, marcadores `<<<>>>` e `--- FIM` falso; os três
  são neutralizados com ZWSP antes de entrar no envelope.
- **"Gate `null` quebra o `advanceLoop`"** — `engine.mjs:1198` trata `gateFactory(pipeline)`
  retornando `null` (nenhum gate é criado; o loop segue).

## 4. Riscos residuais (nenhum bloqueia merge)

1. **T-14 remoto:** validado apenas com o push desta revisão (o `test.yml` roda em qualquer
   branch; o workflow morto do anime-quiz só roda em `master` — não dispara daqui).
2. **T-10a produção** espera decisão do dono (sink durável). O 503 honesto é o comportamento certo
   até lá.
3. **T-13 não publicado** — o doki-call no ar ainda mostra o checkout antigo. Publicar exige
   autorização explícita (e é a próxima decisão de negócio óbvia).
4. **Dry-run E2E via server (porta 8799) não foi re-executado por mim** — os fluxos E2E foram
   exercitados no nível do engine pelos testes novos (rodados por mim, com runs reais de 20-30s);
   evitei mexer no server vivo do dono.

## 5. Prontidão

- **Pronto para merge em `master`:** SIM, após os dois SHOULD FIX (F-B2, F-B3) — nenhum dos dois
  muda API ou comportamento de caminho feliz; são ~10 linhas somadas.
- **Pronto para uso real:** o gate P0 agora pergunta quem paga; o P4 tem schema; o rate-limit não
  destrói mais trabalho; o estado não corrompe em crash. A fábrica está mais confiável **e** mais
  apontada para receita. O que falta de verdade não é código: é o dono decidir sink de telemetria,
  publicar o doki-call honesto e rodar um P0 real com a seção Mercado.
