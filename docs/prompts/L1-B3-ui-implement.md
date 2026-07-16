# L1 / B3 — implementação visual full-auto

Implemente o polish visual diretamente no app. Você é o executor final deste job; não gere um prompt para outro modelo e não deixe trabalho manual para o usuário.

## Trabalho obrigatório

1. Leia a interface atual, o system design e o design system injetados no prompt.
2. Se houver proposta escolhida, abra `maestro/proposals/<<< app-id >>>/proposal-N.html` e aplique sua direção — não copie apenas cores.
3. Melhore hierarquia, tipografia, espaçamento, estados, responsividade e acabamento das telas reais.
4. Preserve domínio, conteúdo, fluxos, acessibilidade e funcionalidades existentes.
5. Altere arquivos reais de interface dentro de `apps/<<< app-id >>>/` (`src`, `app`, `pages`, `components`, estilos ou HTML).
6. Rode o build do workspace e corrija falhas.

## Restrições

- Não criar apenas brief, prompt, relatório ou mockup separado.
- Não trocar provider, framework, capability, billing, auth ou deploy.
- Não remover comportamento para simplificar o visual.
- Não fazer commit, push ou deploy.

## Definition of Done

- Há diff real em arquivos de interface do app.
- A direção escolhida é reconhecível no produto, não só documentada.
- O fluxo principal continua funcional e responsivo.
- `npm run build -w <namespace>/<<< app-id >>>` termina com exit 0.
