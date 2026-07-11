# L1 / B3 — UI polish (1 iteração)

> **Regra de ouro:** frontend forte → **não implementar** no Grok/Codex/Claude coding.  
> Gerar prompt **denso** com `docs/prompts/L1-B3-TEMPLATE.md` → salvar em  
> `workbench/prompts-glm/L1-B3-<app>-<slug>.md` → user cola no **GLM 5.2 MAX**.

## O que o agente coding faz nesta iteração

```
Repo: C:\Dev\anime-forge
Loop: L1 · Job: B3 (delegado GLM)
Claim: gerar prompt (não código UI pesado), salvo se VERIFY pós-GLM.

1. Ler app atual (tsx/css) + feedback HANDOFF/user
2. Preencher L1-B3-TEMPLATE com paths e metas por tela reais
3. Salvar em workbench/prompts-glm/
4. QUEUE: “prompt GLM pronto” · HANDOFF Next = user→GLM
5. Liberar claim (ou claim notes: prompted-glm)

NÃO: redesign “no escuro” com 3 bullets vagos.
SIM: diagnóstico + metas por tela + anti-padrões + VERIFY + DoD.

App: <<< >>>
Escopo: <<< share | empty states | anime theme | mobile >>>
```

## Pós-GLM (outra sessão)

- User: “GLM fechou B3” → agent roda `npm run build[:quiz]`, confere workbench, marca Done se faltar.
- Score visual target: ≥7/10 “dá pra printar”; se <6, **reforçar prompt** (não aceitar form genérico).

Exemplos reais:  
`workbench/prompts-glm/L1-B3-ui-polish-waifu-chat.md`  
`workbench/prompts-glm/L1-B3-ui-anime-theme-anime-quiz.md`
