# EXPERIENCE-PLAN — Plano de experiência detalhado (GameAds)

> Expanda o conceito aprovado num plano de produção concreto. Este documento é o BRIEF técnico
> para os times de design, produto e engenharia.

```
Job: EXPERIENCE-PLAN
Projeto: <<< app-id >>>

Você é líder de produto/design sênior. Leia o BRIEF, a ESTRATÉGIA e o CONCEITO ESCOLHIDO
(concepts.md, com feedback do dono na mensagem acima). Produza um plano de experiência de
~1000–1500 palavras e SALVE em: docs/<<< app-id >>>/experience-plan.md

O dono escolheu o Conceito [A|B|C]. Use ESSE conceito como base — ignore os outros 2.

Seções obrigatórias (pt-BR):

## Objetivo
Reafirmação do objetivo da campanha em 1–2 linhas.

## Público
Descrição concreta do público-alvo (idade, comportamento, plataforma).

## Jornada
Onboarding → progresso → conclusão. Marcos, pontos de risco, tempo estimado.

## Telas ou momentos
Descrição dos principais estados/telas: menu, gameplay, ranking, loja de rewards.

## Mecânicas
Detalhe cada loop: Como se ganha pontos? Qual a progressão? Há queda/perda? Balanceamento.

## Direção visual
Estética, paleta, tom de voz, referências de UI/UX (links ou screenshots).

## Interação
Tipos de input (tap, drag, swipe, tilt, etc.) e feedback (haptic, áudio, visual).

## CTA
Ação de conversão: compra, download, cadastro, compartilhamento. Como o jogo motiva isso?

## Rewards
Detalhe intrínseco (unlock, progresso visual) e extrínseco (prêmio real).

## Dados coletados
Eventos e métricas: cada ação rastreada, propósito, conformidade com privacidade.

## Canais
Onde isso vive: web, app mobile, SMS, email, social media. Sincronização entre canais.

## Devices
Responsividade: mobile-first por padrão. Testado em quais dispositivos/resoluções?

## Assets
Lista de materiais a produzir: ilustrações, ícones, animações, áudio, vídeos. Qty/especificação.

## Integrações
Conecta a que? (Produção, CRM, payment, analytics, SMS, push). APIs e fluxo.

## Tecnologias
Stack escolhido (cliente, servidor, infraestrutura) + justificativa vs. alternativas.

## Escopo incluído
Tudo que ENTRA nesta fase (v1). Be specific: "Leaderboard top 100", "3 achievements".

## Escopo excluído
Tudo que FICA PARA DEPOIS: "Multiplayer", "Web analytics", "A/B testing". Justifique trade-offs.

## Riscos
Pontos técnicos, de negócio e UX que podem falhar. Contingência para cada.

## Dependências
Quem mais precisa fazer algo? (Arte, conteúdo, integração com backend, aprovação legal).

## Plano de produção
Fases, timelines, checkpoints. Exemplo:
- Fase 1 (1 sem): prototipagem e validação de mecânica
- Fase 2 (2 sem): desenvolvimento front-end + assets finais
- Fase 3 (1 sem): integração, testes, deploy

Regras:
- Executável: cada seção deve esclarecer o que FAZ, não apenas o que PODERIA fazer.
- Coerente com a estratégia e os guardrails do profile.
- Referência o Conceito escolhido por nome (A, B ou C).
- NÃO rode git commit/push.

Sucesso (verificado pelo orquestrador): docs/<<< app-id >>>/experience-plan.md com as 6 seções obrigatórias (Jornada, Mecânicas, CTA, Escopo incluído, Escopo excluído, Plano de produção).
```
