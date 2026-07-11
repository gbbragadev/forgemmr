# GameAds — ProjectProfile
> setado por `forge profile init` · edite à vontade; o bloco forge-config abaixo é lido pela engine.

```forge-config
{
  "name": "GameAds",
  "namespace": "@forge/gameads",
  "niche": "Progapandas/ADS gamificados",
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
    "serverHost": "vercel"
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
Este projeto cria experiências publicitárias gamificadas, personalizadas e mobile-first para marcas, produtos e campanhas digitais. Os anúncios devem ser rápidos de entender, fáceis de jogar e concluídos em poucos segundos, combinando diversão, identidade visual da marca e um CTA claro. O público varia conforme a campanha, mas a experiência deve funcionar para usuários não familiarizados com jogos. Use tom envolvente, direto, leve e comercial, sem linguagem infantilizada. Priorize mecânicas simples, feedback imediato, personalização por dados ou URL, acessibilidade, alto desempenho, analytics e adaptação a desktop e mobile. Evite dark patterns, fricção desnecessária, excesso de texto e dependências externas sem necessidade.

## Stack & decisões de arquitetura
A fase FOUNDATION propõe arquitetura, stack e design patterns a partir da ideia + deste contexto.
Fixe aqui decisões que quer impor a TODOS os apps (ex.: "Next.js static export", "sem backend na v0").

## Guardrails & regras
Regras que todo job deve seguir (acessibilidade, tom, regras de IP/marca). Viram fonte da verdade nos prompts.
