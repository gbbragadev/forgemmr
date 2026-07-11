# DS-GEN — Design System (3 propostas visuais, gated)

> Dada a IDEIA + o profile + o system design aprovado, você gera **3 propostas de identidade
> visual** distintas para o dono ESCOLHER (gate ds-pick). A escolhida vira o design system que os
> builds de UI (B3) seguem à risca. Cada proposta é um HTML self-contained que dá pra ABRIR e ver.

```
Job: DS-GEN
App: <<< app-id >>>
Ideia: <<< IDEIA >>>

Você é diretor(a) de arte + design engineer. Leia a IDEIA, o CONTEXTO DO PROJETO (profile: nicho,
temas, tom, guardrails — injetado acima) e o DESIGN APROVADO (system design, acima). Proponha
3 direções visuais DISTINTAS (não 3 variações da mesma) — ex.: (1) minimalista/clean,
(2) vibrante/expressiva, (3) editorial/sofisticada — cada uma coerente com o nicho e o tom.

Crie EXATAMENTE estes 4 arquivos:

1) maestro/proposals/<<< app-id >>>/proposal-1.html
2) maestro/proposals/<<< app-id >>>/proposal-2.html
3) maestro/proposals/<<< app-id >>>/proposal-3.html

Cada proposal-N.html é UM arquivo HTML self-contained (CSS inline no <style>, ZERO dependências
externas — sem CDN, sem fonte remota; use font stacks do sistema) que funciona como mini style
guide navegável, mostrando a linguagem visual:
- um hero/título com o nome do projeto e o tom da direção;
- a paleta (swatches com os HEX das cores: bg, surface, ink, primária, secundária, acento);
- escala tipográfica (h1/h2/body/caption) com a font stack escolhida;
- componentes de referência: botões (primário/secundário/ghost), 2–3 cards, 1 input de formulário,
  1 badge/tag — nos estilos da direção;
- os design tokens visíveis (radius, spacing, sombra) aplicados de verdade nos componentes.
Responsivo (max-width, sem scroll horizontal). Cada proposta com paleta e personalidade próprias.

4) apps/<<< app-id >>>/docs/design-system.md — documenta as 3 propostas para a escolha ser aplicável em
código. Para CADA proposta: nome da direção + tabela de tokens (cores HEX, font stack, radius,
spacing base, sombra) + 1 linha de "quando escolher esta". Assim, seja qual for a escolhida (1/2/3),
o build de UI tem os tokens exatos para aplicar.

Regras:
- Coerente com guardrails/nicho/tom do profile e com o system design aprovado. Não contradiga.
- Self-contained de verdade: nada de recurso externo (o preview roda no Maestro HQ, offline).
- NÃO mexa em apps/ nem em packages/ aqui — só nos 4 arquivos acima. NÃO rode git commit/push.

Sucesso (verificado pelo orquestrador): os 3 proposal-N.html + apps/<<< app-id >>>/docs/design-system.md existem.
```
