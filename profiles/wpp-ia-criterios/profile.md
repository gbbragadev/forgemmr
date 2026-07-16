# WPP + IA + CRITERIOS — ProjectProfile
> setado por `forge profile init` · edite à vontade; o bloco forge-config abaixo é lido pela engine.

```forge-config
{
  "name": "WPP + IA + CRITERIOS",
  "namespace": "@forge",
  "niche": "reforma",
  "i18n": {
    "defaultLocale": "pt-BR",
    "locales": [
      "pt-BR"
    ],
    "rule": "single"
  },
  "deploy": {
    "baseUrl": "gbbragadev.com",
    "staticHost": "cf-pages",
    "serverHost": "cf-workers"
  },
  "git": {
    "targetBranch": "master",
    "commitPrefix": "forge"
  },
  "capabilities": [
    "static",
    "quiz",
    "chat"
  ]
}
```

## Contexto & temas
Raio-X do Orçamento

Promessa

Antes de assinar, descubra o que está faltando, o que está ambíguo e onde provavelmente surgirão custos extras.

Evite vender como “laudo”, “parecer de engenharia” ou “aprovação técnica” enquanto não houver um profissional habilitado formalmente responsável pelo serviço.

Escopo inicial
Dimensão	MVP recomendado
Vertical	Reforma residencial leve
Região	Grande SP ou uma única região metropolitana
Tipos de obra	Banheiro, cozinha, pintura, piso, revestimento, forro, marcenaria, impermeabilização e instalações simples
Valor típico	R$ 10 mil a R$ 200 mil
Entrada	1 a 3 propostas, fotos, prints, áudios e descrição do objetivo
Saída	PDF comparativo + resumo para WhatsApp + perguntas prontas para os fornecedores
Prazo	Até 24 horas
Responsabilidade	Revisão documental e comercial, com escalonamento de riscos técnicos
Operação	Humano aprova todos os relatórios
Fora do MVP
Alterações estruturais.
Fundação, contenção, demolição estrutural e cálculo de carga.
Instalação de gás.
Avaliação técnica de telhados comprometidos.
Energia solar.
Reparação automotiva.
Marketplace de fornecedores.
Ranking público ou acusação de fraude.
Dashboard para o cliente acompanhar a obra.
Negociação automática com fornecedores.

Solar, automotivo e reforma são três produtos diferentes. Os critérios, benchmarks, documentos e responsabilidades mudam demais. Misturar os três impediria a criação de uma base de avaliação confiável.

2. Estratégias possíveis
Estratégia	Descrição	Vantagem	Risco
A. Serviço + copiloto interno	Atendimento manual no WhatsApp e software interno para produzir o relatório	Receita imediata, aprendizado real e menor risco	Exige operação humana
B. Bot de WhatsApp	Cliente envia tudo diretamente ao bot	Aparência mais escalável	Automatiza erros antes de entender o domínio
C. SaaS completo	Portal do cliente, pagamentos, projetos e dashboard	Produto visualmente forte	Meses de desenvolvimento antes de validar demanda

## Stack & decisões de arquitetura
A fase FOUNDATION propõe arquitetura, stack e design patterns a partir da ideia + deste contexto.
Fixe aqui decisões que quer impor a TODOS os apps (ex.: "Next.js static export", "sem backend na v0").

## Guardrails & regras
Regras que todo job deve seguir (acessibilidade, tom, regras de IP/marca). Viram fonte da verdade nos prompts.
