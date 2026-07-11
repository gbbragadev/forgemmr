# Project Profile

> Este arquivo é o **vertical** do projeto: define contexto, stack, design system,
> padrões e guardrails que a pipeline `forge` injeta em TODO job. Edite-o (ou rode
> `forge profile init`) para iniciar um projeto diferente. O bloco ```forge-config```
> abaixo são os knobs que a engine lê (JSON, zero-dep); o corpo em markdown é o
> contexto narrativo, injetado nos prompts como fundação do projeto.

```forge-config
{
  "name": "Anime Forge",
  "namespace": "@forge",
  "niche": "anime",
  "ai": { "provider": "zai", "model": "glm-4.5-flash", "envKey": "ZAI_API_KEY" },
  "i18n": { "defaultLocale": "pt-BR", "locales": ["pt-BR", "en"], "rule": "bilingual" },
  "ui": { "theme": "y2k-otaku", "designSystem": "arcana", "tokenPrefix": "--af-" },
  "deploy": { "baseUrl": "gbbragadev.com", "staticHost": "cf-pages", "serverHost": "vercel" },
  "git": { "targetBranch": "master", "commitPrefix": "forge" },
  "legal": {
    "ipRules": [
      "Apenas personagens e arquétipos ORIGINAIS — nunca copiar nome, uniforme, universo ou identidade visual de franquia existente.",
      "Nunca reproduzir diálogo de obra protegida.",
      "Incluir disclaimer de não-afiliação a estúdios/publishers na UI."
    ]
  },
  "capabilities": ["static", "quiz", "chat"]
}
```

## Contexto & temas

Factory de webapps de anime, divulgados na página IG @otaku_sincero69 (memes/edits, público
otaku BR 16–28). Cada app é social-first, mobile-first, feito pra printar e compartilhar — o
compartilhamento É o produto. Estética retrô Y2K/otaku (ARCANA): dark, neon rosa/roxo, cyan
ácido, scanlines. Todo conteúdo user-facing bilíngue PT-BR + EN.

## Stack

Monorepo npm workspaces (`@forge/*`). Apps em Next.js (App Router) + TypeScript; estáticos via
`output: "export"` → Cloudflare Pages (`<app>.gbbragadev.com`); apps server → Vercel. Design
system compartilhado em `packages/ui` (tokens CSS `--af-*`). Sem backend/API paga no free path.

## System design (direção)

Client-first: a maior parte da lógica roda no navegador (quiz/scoring/geração cosmética). Quando
há IA de produto, é via provider configurado (`ai.provider`), nunca como motor de coding. Estado
efêmero (cookie/localStorage) antes de banco. i18n client-only com toggle persistido.

## Design patterns & convenções

Componentes pequenos e focados; CSS-first (tokens do DS, sem lib pesada); mobile ~390px primeiro,
touch ≥44px, contraste AA, `prefers-reduced-motion`. Nada de dependência nova quando stdlib/CSS
resolve. Selo discreto "by @otaku_sincero69".

## Guardrails

Subscription-only como motor de código (sem API paga por chamada). Personagens 100% originais
(ver `legal.ipRules`). Não pivotar a conta/identidade da página. Deploy só com gate humano.
