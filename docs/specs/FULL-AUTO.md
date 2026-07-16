# Full auto real

## Objetivo

Fazer a Central, CLI e Forge Operator executarem uma ideia com o time escolhido sem transformar
decisões locais verificáveis em trabalho manual disfarçado.

## Requisitos

1. `full_auto` é o padrão das entradas voltadas ao usuário; modos persistidos antigos continuam
   válidos.
2. O orquestrador pode decidir automaticamente somente gates locais com evidência objetiva:
   `p0-go` após verdict GO/GO condicionado, `foundation-review` após verify estrutural,
   `ds-pick` pela recomendação explícita do design-system e gates visuais após verify.
3. Decisões automáticas persistem gate, escolha, ator e motivo e aparecem nos eventos/logs.
4. B3 em `full_auto` usa o Designer do time escolhido para implementar a UI diretamente. Prompt
   para um terceiro não conta como execução; o verify exige diff real de interface e build verde.
5. Times `strict` não fazem fallback oculto nem trocam provider no B3 ou em qualquer outro job.
6. A pipeline para em fronteiras externas ou humanas: sinal de mercado, deploy, domínio, billing,
   provider login, segredo, alegação legal, P4/P5, blocker e qualquer gate sem evidência suficiente.
7. `autopilot_to_gate` preserva o comportamento legado de parar em todo gate contratual; `guided`
   e `manual` preservam suas pausas por fase e job.
8. Alterar uma pipeline pausada para `full_auto` resolve e retoma apenas se o gate pendente for
   local e tiver evidência suficiente.

## Não objetivos

- Autorizar push, deploy, compra, domínio, login ou uso de segredo.
- Ignorar verify, inventar validação de mercado ou converter NO-GO em GO.
- Alterar o provider/modelo escolhido fora da política explícita do time.

## Aceite

- Integração dry-run chega sozinha ao gate externo de deploy e registra as decisões locais.
- GO condicionado para em `p1-signal`.
- B3 direto rejeita execução que só alterou documentação ou prompt.
- Entradas da API, CLI, Operator e Central oferecem/defaultam `full_auto`.
- Testes legados de `autopilot_to_gate`, `guided` e `manual` continuam verdes.
