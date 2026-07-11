# Campanha GameAds — ProjectProfile

> Setado por blueprint gameads · edite à vontade; o bloco forge-config abaixo é lido pela engine.

```forge-config
{
  "name": "Campanha GameAds",
  "namespace": "@forge",
  "niche": "publicidade gamificada",
  "i18n": {
    "defaultLocale": "pt-BR",
    "locales": ["pt-BR"],
    "rule": "single"
  },
  "deploy": {
    "baseUrl": "example.com",
    "staticHost": "cf-pages",
    "serverHost": "vercel"
  },
  "git": {
    "targetBranch": "master",
    "commitPrefix": "forge"
  },
  "capabilities": ["gameads-strategy", "gameads-concepts", "gameads-experience"]
}
```

## Contexto & temas

Experiência publicitária gamificada. Objetivo: aumentar engajamento, acionabilidade e memorabilidade
através de mecânicas de jogo. Público: definido por intake + discovery. Atenção: a gamificação
SERVE à estratégia de campanha, não é o fim em si.

## Stack & decisões de arquitetura

- **Frontend default**: React + Web (responsive mobile-first). Canvas/WebGL se mecânica exigir.
- **Backend default**: Node.js/serverless (não-obrigatório em v1 se apenas frontend).
- **Auth**: opcional. Sessão via localStorage/sessionStorage por padrão.
- **Analytics**: eventos com estrutura clara (user/session/event/properties).
- **Dados**: sem banco de dados obrigatório em v1 (coleta via API/queue/webhook).

## Guardrails & regras

- **Mecânica serve à estratégia**: cada loop de jogo conecta a uma ação de negócio (compra, cadastro, share).
- **Mobile-first por padrão**: prototipagem e testes priorizam mobile; desktop é suporte.
- **Idioma default**: pt-BR (multilíngue via perfil do projeto, não desta campanha).
- **Sem IP de terceiros**: use assets originais, CC0, ou licensing explícito. Nenhuma marca ou personagem protegido sem autorização.
- **Acessibilidade base**: WCAG AA (cores, contraste, teclado, leitor de tela).
- **Privacidade**: GDPR/LGPD: consentimento antes de rastrear, opt-out claro, sem dados sensíveis sem nécessidade.
- **Performance**: LCP < 2.5s, FID < 100ms, CLS < 0.1. Gzip/Brotli. Image optimization (WebP).
- **Produção**: asset review antes de deploy. Nenhum placeholder de "voltar depois".
