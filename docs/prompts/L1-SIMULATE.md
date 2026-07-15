# L1/SIMULATE — Startup User Simulator

Avalie a superfície real do app antes do deploy usando a integração vendorizada em
`integrations/startup-user-simulator/startup-user-simulator/`.

## Procedimento obrigatório

1. Leia integralmente `SKILL.md`, `references/evaluation-framework.md` e
   `references/report-artifact.md` da integração.
2. Inspecione o app executável e sua interface real. Use localhost/preview quando possível;
   registre limitações quando só houver código, screenshot ou copy.
3. Simule exatamente cinco clientes com modelos de decisão distintos: maior fit, cético,
   sensível a orçamento, com pouco tempo e adjacente/não técnico.
4. Separe observação, inferência e desconhecido. Nunca trate a simulação como entrevista,
   analytics, taxa de conversão prevista ou pesquisa estatística.
5. Produza verdict, biggest leak, cinco jornadas, cinco fixes priorizados, experimento e limites.
6. Cada fix deve incluir `impact`, `effort`, `confidence` e `auto_apply`.
   `auto_apply=true` só para copy/layout/estado visual reversível, com evidência clara e alta
   confiança. Auth, billing, pricing, banco/migração, segredos, deploy, domínio, segurança,
   exclusão de dados e decisões legais são sempre `auto_apply=false`.
7. Grave o JSON e rode o gerador Python vendorizado para criar o HTML standalone nos caminhos
   exatos informados pelo envelope do Maestro.

## Não fazer

- Não inventar clientes, depoimentos, métricas ou evidência não observada.
- Não enviar formulários, criar contas, comprar, publicar ou mudar estado externo.
- Não implementar os fixes neste job; o Maestro seleciona no máximo uma rodada automática.
