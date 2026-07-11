# L1 / B3 — Template de prompt denso (GLM 5.2 MAX)

> Agente de coding **não implementa** UI forte. Copia este template para  
> `workbench/prompts-glm/L1-B3-<app>-<slug>.md`, preenche `<<< >>>`,  
> atualiza QUEUE “prompt GLM pronto”. User cola o bloco PROMPT no GLM.

## Por que denso?

Sessão real anime-quiz: UI B1 ~**4/10** → B3 com brief completo ~**7.5/10**.  
GLM executa bem; **sem direção visual o resultado é form genérico**.

## Checklist (preencher antes de soltar)

- [ ] Diagnóstico literal do user / do B1 (“só texto”, “sem anime”…)
- [ ] Metas **por tela** (intro / core / resultado / share)
- [ ] Paths reais de arquivos
- [ ] Restrições (não quebrar score/API, sem IP, YAGNI deps)
- [ ] Anti-padrões (purple slop, emoji spam, next/font offline…)
- [ ] VERIFY (`npm run build` / `build:quiz`)
- [ ] DoD user-facing (“em 2s sente anime app”)

---

## PROMPT (copiar daqui pra baixo, dentro de fence no arquivo final)

```
Você é front-end senior mobile-first de apps anime (dark, glow, hierarchy — sem AI slop).

# Contexto
Repo: C:\Dev\anime-forge
App: apps/<<<id>>>
Dev: <<<comando e porta — checar se porta não é Docker 3001 “Running”>>>
Contrato: AGENTS.md · claim L1/B3 · workbench/
Tokens: packages/ui/src/styles.css (--af-*)

# Diagnóstico
<<< o que está fraco / feedback do user >>>

# Job (UMA iteração)
L1/B3 — <<< tema: polish mobile | anime punch | share card >>>

## Metas por tela (obrigatório)
1) Intro: <<< >>>
2) Fluxo principal: <<< >>>
3) Empty / loading / erro: <<< >>>
4) Resultado ou chat share: <<< >>>
5) Copy PT-BR: <<< tom >>>

## Restrições
- Não quebrar: <<< score / API / cookies >>>
- Sem IP de estúdios/personagens licenciados
- Sem billing/image/capability nova
- CSS-first; zero lib animação se CSS bastar
- Mobile ~390px + safe-area
- Touch ≥ 44px

## Arquivos
- <<<lista>>>

## Anti-padrões
- Purple gradient sem hierarquia
- Emoji spam
- Wall of text
- next/font se build offline quebrar (preferir <link> se necessário)

## VERIFY
1. Claim CLAIMS.md: A | glm | L1 | B3 | <<<app>>> | <hora>
2. QUEUE B3 → Done
3. <<<npm run build | build:quiz>>> EXIT 0
4. HANDOFF last agent glm + Next
5. Liberar claim

## DoD user-facing
- [ ] Em 2s parece app de anime, não form
- [ ] Share/print path existe se o job pedir
- [ ] build OK + workbench coerente

Comece lendo os arquivos, implemente o mínimo de máximo impacto visual, VERIFY, feche workbench.
```
