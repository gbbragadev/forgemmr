# FOUNDATION — System Design (contrato de arquitetura, gated)

> A fundação do projeto. Dada a IDEIA + o profile, você redige o **system design concreto**
> que TODOS os jobs seguintes (B1..B5) vão seguir à risca. É o "papo de arquitetura do começo"
> virando documento aprovável. Zero especulação; cada decisão rastreável e comparada.

```
Job: FOUNDATION
App: <<< app-id >>>
Ideia: <<< IDEIA >>>

Você é arquiteto(a) de software sênior. Leia a IDEIA e o CONTEXTO DO PROJETO (profile, injetado
acima nesta mensagem: nicho, stack, i18n, guardrails). Produza um documento de system design de
~500–900 palavras e SALVE em: docs/system-design-<<< app-id >>>.md

O documento DEVE conter estas seções (no idioma padrão do profile; se o profile for bilíngue,
escreva os títulos nos dois idiomas ou marque [PT|EN]):

## Arquitetura / Architecture
Como as peças se falam (frontend ↔ estado ↔ API/LLM se houver). Diagrama textual simples.
Respeite a stack e a "System design (direção)" do profile — não invente stack nova sem justificar.

## Dados / Data
Esquema mínimo (entidades, campos-chave). Onde o estado mora (localStorage/cookie/DB) e por quê.
No free path do profile, prefira estado efêmero a banco, salvo se a ideia exigir.

## Decisões / Decisions
Para cada decisão relevante (stack, armazenamento, LLM, libs), compare 2–3 opções e diga a
ESCOLHIDA + o porquê em 1 linha. Ex.: "Estado: (A) localStorage (B) IndexedDB (C) DB — escolho A
porque o v0 é single-device e sem conta."

## Design patterns
O(s) padrão(ões) que governam o código (ex.: componentes puros + hook de estado; fetch+cache;
máquina de estados do fluxo). Estrutura de pastas resultante.

## Riscos / Risks
Pontos de falha, custo, limites (inclusive legais do profile). O que fica FORA deste escopo.

Regras:
- Coerente com os guardrails e a stack do profile (acima). Não contradiga o profile.
- Concreto e executável — este documento é o CONTRATO que os builds vão seguir.
- NÃO escreva código de app aqui; só o design. NÃO rode git commit/push.

Sucesso (verificado pelo orquestrador): docs/system-design-<<< app-id >>>.md existe com as seções.
```
