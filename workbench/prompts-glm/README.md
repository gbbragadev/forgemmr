# Prompts para GLM 5.2 MAX (frontend forte)

Grok/Codex/Claude coding **não** implementam UI pesada — geram prompt **aqui**; o user cola no GLM.

## Lição canônica (2026-07-10 · anime-quiz B3)

| | B1 / prompt fraco | B3 / prompt elaborado |
|--|-------------------|------------------------|
| Sensação | form texto-puro | app anime printável |
| Score user | ~**4/10** | ~**7.5/10** |
| Causa | YAGNI visual + brief vago | brief denso + metas por tela |

**GLM é forte na construção; fraco em inventar direção se o brief for ralo.**  
Hoje o apelo visual **é** o produto — o prompt é o design brief.

## Checklist obrigatório (todo B3)

1. **Diagnóstico** — feedback literal (“só texto”, “sem anime”…)  
2. **Metas por tela** — intro / fluxo / empty / resultado / share  
3. **Arquivos-alvo** — paths reais  
4. **Restrições** — score/API intactos, sem IP, YAGNI deps, mobile  
5. **Anti-padrões** — purple slop, emoji spam, next/font offline…  
6. **VERIFY** — `npm run build` ou `build:quiz`  
7. **DoD user-facing** — “em 2s sente X”, não só “código ok”  
8. **Porta** — não mandar GLM testar :3001 se for Docker  

Template: `docs/prompts/L1-B3-TEMPLATE.md`.

## Arquivos

| Prompt | App / job |
|--------|-----------|
| `L1-B3-ui-polish-waifu-chat.md` | waifu-chat share + empty + mobile |
| `L1-B3-ui-anime-theme-anime-quiz.md` | anime-quiz tema / visual punch |

## Ao gerar um prompt novo

1. Copiar template ou exemplo acima  
2. Anexar feedback literal do user  
3. QUEUE: `prompt GLM pronto` + path do arquivo  
4. HANDOFF Next = `user → GLM 5.2 MAX`  
5. Pós-GLM: VERIFY build se pedido  

## Anti-padrões do *gerador* de prompt

- “Melhora o visual” sem listar telas  
- Sem paths de arquivo  
- Sem DoD user-facing  
- Misturar B1 lógica + B3 no mesmo prompt sem necessidade  
