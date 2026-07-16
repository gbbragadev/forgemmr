# Novo app com 1 prompt

Cole o bloco abaixo no **Claude Code**, **Codex**, **Grok** ou **Gemini**  
com a pasta aberta em `C:\Dev\forge`.

Substitua só o que está entre `<<< >>>`.

---

## Prompt (copiar tudo)

```
Repo: C:\Dev\forge
Leia AGENTS.md + workbench/HANDOFF.md + workbench/QUEUE.md + docs/prompts/L1-B1-scaffold.md.

## Missão
Criar um NOVO app da factory Anime Forge a partir do template existente.

## Spec do app (preencher)
- id (slug pasta/npm): <<< ex: anime-quiz >>>
- name (display): <<< ex: AnimeQuiz >>>
- capability: chat   # só chat no v0; image só se já existir package
- one-liner (PT-BR): <<< o que o app faz em 1 frase >>>
- freePerDay: 2
- modelo OpenRouter: usar default do monorepo (OPEN_ROUTER_API_KEY no Windows — NÃO pedir key no chat)
- 4–6 personas ORIGINAIS / arquétipos (não copiar diálogo de obra): nomes + tags + starter + system curto PT-BR
- SEO title + description PT-BR
- 5 hooks TikTok/Reels no app.config share.tiktokHookTemplates

## Regras
- Coding agent = subscription (não configurar API Anthropic/OpenAI/Gemini paga)
- OpenRouter = ler env OPEN_ROUTER_API_KEY (não pedir no chat)
- YAGNI / surgical / karpathy: mínimo que funciona
- NÃO mexer em apps/waifu-chat além de copiar como base
- NÃO implementar billing Stripe/Pix nem image gen neste prompt
- Claim em workbench/CLAIMS.md (loop L1, job B1, app = id)
- Uma entrega só: app rodando localmente

## Passos (execute na ordem)
1. Claim + mover job na QUEUE se ainda não estiver
2. Copiar apps/waifu-chat → apps/<id>
3. Ajustar package.json name para @forge/<id>
4. app.config.ts: id, name, seo, monetization, personas (inline ou content/personas/<id>-pack-v1.json)
5. Ajustar copy da landing (page/layout) para o one-liner
6. npm install na root se preciso; npm run build -w @forge/<id> (ou build root)
7. Se build falhar: fix até 3 tentativas; senão BLOCK no HANDOFF
8. Atualizar workbench/HANDOFF.md (done + next: content hooks L0/P1 ou smoke dev)
9. Liberar claim; QUEUE → Done no scaffold

## Done when
- [ ] pasta apps/<id> existe
- [ ] npm run build passa
- [ ] personas ≥ 4
- [ ] HANDOFF + QUEUE + CLAIMS atualizados
- [ ] me diga: cd + comando npm run dev -w @forge/<id> (ou script root se aplicável)

Comece agora.
```

---

## Depois do 1º prompt (próximas 1-prompt sessions)

| Ordem | Prompt | Objetivo |
|-------|--------|----------|
| 2 | `docs/prompts/L0-P1-content-hooks.md` | 15 hooks com o nome do app |
| 3 | `docs/prompts/L1-B5-ship-check.md` | smoke + checklist |
| 4 | (opcional) Bernstein | só se L1 code-heavy paralelo |

Não faça billing/image no mesmo prompt do scaffold.
