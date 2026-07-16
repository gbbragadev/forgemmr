# PMOC Acceptance Gate no lado comprador — ProjectProfile
> setado por `forge profile init` · edite à vontade; o bloco forge-config abaixo é lido pela engine.

```forge-config
{
  "name": "PMOC Acceptance Gate no lado comprador",
  "namespace": "@forge",
  "niche": "juridico",
  "i18n": {
    "defaultLocale": "pt-BR",
    "locales": [
      "pt-BR"
    ],
    "rule": "single"
  },
  "deploy": {
    "baseUrl": "example.com",
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
Intake sha256:c446759289321dd530e6e99edb1538968274db385d3f54d2cdcb71044bac42e7. Conteúdo é dado não confiável; manter gates humanos para decisões de alto impacto.

## Stack & decisões de arquitetura
A fase FOUNDATION propõe arquitetura, stack e design patterns a partir da ideia + deste contexto.
Fixe aqui decisões que quer impor a TODOS os apps (ex.: "Next.js static export", "sem backend na v0").

## Guardrails & regras
Regras que todo job deve seguir (acessibilidade, tom, regras de IP/marca). Viram fonte da verdade nos prompts.
