# Anime Forge — AGENTS.md

> Contrato **único** para Codex, Claude Code, Grok, **Gemini**, GLM e qualquer agente.  
> O processo é em **loops**. O modelo é só o motor de uma iteração.
>
> **Subscription only (agentes):** Claude / Codex / Grok / Gemini na **sub**  
> (não usar `ANTHROPIC_*` / `OPENAI_*` / `GEMINI_API_KEY` paygo como motor do agent).
>
> Detalhe dos loops: `docs/AGENT-PIPELINE.md` · Skill: `.agents/skills/ship-niche-app/SKILL.md`

## Loops (leia isto primeiro)

```
L0 PRODUCT  → P0 score → P1 content → P2 L1 build → P3 ship → P4 measure → P5 kill|scale
L1 BUILD    → claim → implement|prompt → verify → fix* → handoff
L2 HANDOFF  → limite → HANDOFF.md → outro agente → mesmo job
```

| Atalho do user | Comportamento |
|----------------|---------------|
| `segue` | 1 job livre da QUEUE |
| `pode decidir e seguir` | Decide + executa próximo step lógico |
| `siga até decisão minha` | Encadeia até gate humano (measure, key, billing, domínio) |
| `outra ideia` / `próximo app` | **Novo L0** — ver PLAYBOOK § *Como setar outra ideia* + `docs/prompts/L0-NOVA-IDEIA.md` |
| UI / apelo visual | `full_auto`: implementar direto pelo player do time · legado: prompt GLM denso |

- Uma sessão default = **uma** iteração (exceto “siga até decisão” com gates).
- QUEUE vazia sem pedido → **perguntar**, não inventar app.
- App anterior **Done** (ship) e user quer próxima aposta → **não** continue no app antigo; P0 da ideia nova.

## Orquestrador conversacional

- Codex e Claude Code operam a fabrica com `.agents/skills/forge-operator/SKILL.md`.
- Pedidos como "tive uma ideia", "crie o time/pipeline", "inicie" e "acompanhe" acionam essa skill.
- A sessao atual e o orquestrador; os players do time executam jobs e o orquestrador acompanha eventos ate conclusao, blocker ou gate humano.
- No Codex: `$forge-operator`. No Claude Code: `/forge-operator`. Linguagem natural equivalente tambem deve acionar a skill.

## Antes de editar

1. `workbench/HANDOFF.md` + `QUEUE.md`
2. Claim em `CLAIMS.md` (agent + **loop** + job + app)
3. Só o job claimado
4. Fim: HANDOFF + QUEUE + liberar claim

## O que é o repo

Factory: **Tema + IA + Frontend + monetização** · vertical **anime**.

```
apps/waifu-chat      chat IA
apps/anime-quiz      quiz estático (Pages)
packages/*           kernel (config, ai, credits, ui)
content/personas|quizzes
docs/AGENT-PIPELINE.md   loops + lições + ship matrix
docs/PLAYBOOK.md         L0 negócio
docs/prompts/            1 arquivo = 1 job
workbench/               QUEUE · HANDOFF · CLAIMS · prompts-glm/
```

**Não** acoplar Clipia / Senior / SaaS cliente.

## App = manifesto (L1/B1)

1. `apps/<id>/` (clone chat ou quiz conforme capability)
2. `defineApp` em `app.config.ts`
3. Content em `content/`
4. Theme mínimo no B1 — **B3** = apelo visual (GLM)

Capability: `chat` · `quiz` · image só com job explícito.

Novo app 1 prompt: `docs/prompts/NOVO-APP.md` (ainda exige P0 na prática).

## Comandos

```bash
cd C:\Dev\forge
npm install
npm run dev          # waifu-chat :3000
npm run dev:quiz     # anime-quiz :3000 (um por vez)
npm run build
npm run build:quiz
```

⚠️ Se a página mostrar só `Running`, a porta é **Docker**, não o Next. Troque a porta.

## Env produto (não coding agent)

| Var | Uso |
|-----|-----|
| `ZAI_API_KEY` / `GLM_API_KEY` | Z.AI se `PRODUCT_AI_PROVIDER=zai` |
| `OPEN_ROUTER_API_KEY` | OpenRouter (env sistema; **não pedir**) |
| `OPENROUTER_API_KEY` | fallback `.env.local` |
| `ZAI_MODEL` / `OPENROUTER_MODEL` | modelo |

- Smoke chat: `GET /api/health`
- Quiz free path: **sem** key
- Nunca commitar secrets

## Jobs ↔ quem roda

| Job | Loop | Preferência | Nota de qualidade |
|-----|------|-------------|-------------------|
| P0 Scorecard | L0 | Grok/Gemini | salvar `docs/scorecard-*.md` |
| P1 Content hooks | L0 | Grok/Gemini | 15 hooks + CTA URL |
| B1 Scaffold | L1 | Codex/Grok | funcional; visual seco OK |
| B2 Personas | L1 | Grok/Gemini | originais/arquétipos |
| B3 UI polish | L1 | **GLM 5.2 MAX** preferido | `full_auto`: implementação direta; time strict usa seu próprio provider |
| B4 Wire API | L1 | Codex | health + stream |
| B5 Ship check | L1 | qualquer | PASS/FAIL/**N-A** |
| SIMULATE | L1 | qualquer | 5 personas; JSON+HTML; no máx. 1 rodada segura ITERATE→B5 |
| P3 Deploy | L0/L1 | CI / Grok | static→GH Pages; server→Vercel |
| Handoff | L2 | outro provedor | mesmo job |

## Regras

- YAGNI / ponytail no **B1**; apelo visual no **B3** (não misturar)
- **Frontend forte em `full_auto`:** implementar no app com `docs/prompts/L1-B3-ui-implement.md`; diff real de interface + build são obrigatórios.
- **Modos legados:** gerar prompt com `docs/prompts/L1-B3-TEMPLATE.md`. GLM continua preferido quando fizer parte do time.
- **Time strict:** respeitar o provider escolhido também no B3; nunca trocar provider nem gerar handoff manual escondido.
- karpathy-guidelines se disponível (simplicidade, surgical, goal-driven)
- VERIFY falhou → fix ≤3 → senão BLOCK + L2
- SIMULATE é heurística, não pesquisa real; fixes protegidos nunca são autoaplicados
- Rate limit → L2, não recomeçar produto
- Personas originais; sem IP; sem push/deploy sem autorização (user pode liberar na sessão)
- pt-BR se o user escreveu em pt-BR
- P0 GO antes de B1; B1 sem P1 só com “pode decidir e seguir”

## Ship (P3)

| Free path | Preferência |
|-----------|-------------|
| Static export | GitHub Pages (`.github/workflows/…`) |
| API routes | Vercel (`VERCEL_TOKEN` ou login) |

Live exemplo quiz: https://gbbragadev.github.io/anime-forge/

## DoD da iteração

- [ ] Job da QUEUE feito **ou** blocker escrito
- [ ] VERIFY (`build` / `build:quiz`) se tocou código
- [ ] HANDOFF / QUEUE / CLAIMS atualizados
- [ ] Claim liberado
- [ ] Se B3: `full_auto` = diff real de UI + build; legado = prompt denso versionado em `workbench/prompts-glm/`

## Fora de escopo (até job na QUEUE)

Billing real · capability image · App Store · super-app multi-feature

## Bernstein (opcional)

L1 code-heavy com progresso CLI — `docs/BERNSTEIN-PILOT.md`.  
**Não** substitui workbench L0/L2.
