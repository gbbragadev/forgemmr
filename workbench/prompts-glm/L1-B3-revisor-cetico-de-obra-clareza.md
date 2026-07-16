# Prompt GLM 5.2 MAX — L1/B3 UI polish · revisor-cetico-de (Obra Clareza)

> Cole o bloco **PROMPT** abaixo no GLM 5.2 MAX (repo `C:\Dev\forge`).  
> Coding agents (Grok/Codex/Claude) **não** implementam frontend forte — só este prompt + workbench.  
> **ds-pick:** proposta **2** · direção visual **Obra Clareza** (`maestro/proposals/revisor-cetico-de/proposal-2.html`).  
> Causa: B1/B2 = scaffold lógico + perspectivas densas; visual ainda “form dark + âmbar mínimo” (~4–5/10). B3 = apelo de **backoffice de obra** com hierarquia, densidade e print-ready.

---

## PROMPT

```
Você é product designer + front-end senior de produtos B2B/ops brasileiros (mobile-first, dark, densidade profissional — sem AI slop, sem “dashboard genérico roxo”).

# Contexto
Repo: C:\Dev\forge
App: apps/revisor-cetico-de (Next.js 15 App Router, output: "export", static)
Package: @forge/revisor-cetico-de
Dev: npm run dev:revisor → http://localhost:3000  (NÃO usar :3001 — Docker devolve "Running")
Build: npm run build:revisor   OU   npm run build -w @forge/revisor-cetico-de
Contrato: AGENTS.md · claim L1/B3 · workbench/
Kernel tokens: packages/ui/src/styles.css (--af-*) — reusar se ajudar; tokens de produto = --rx-* em globals.css

Produto: **Raio-X do Orçamento** — backoffice INTERNO de revisão documental/comercial de orçamentos de reforma leve (Grande SP). Humano aprova todo relatório. NÃO é app consumidor, NÃO é laudo/parecer de engenharia.

Fluxo já implementado (NÃO quebrar lógica):
intro → case → matrix → findings → report → gate
Demo: 2 propostas banheiro; aritmética determinística (checkProposalArithmetic); findings com basis/evidência; resumo WhatsApp copiável; gate humano (approve / needs_information).

Perspectivas (B2, content/personas/revisor-pack-v2.json):
scope-reviewer · commercial-reviewer · evidence-validator · spec-reviewer · escalation-reviewer
(IDs dos 3 findings demo devem continuar batendo com perspectiveId.)

# Direção visual OBRIGATÓRIA — Obra Clareza (ds-pick = 2)
Referência canônica: maestro/proposals/revisor-cetico-de/proposal-2.html
Ler o HTML da proposta antes de codar. Traduzir o feeling para o app real.

Paleta / tokens alvo (alinhar --rx-*):
- bg #1a1510 (ou #12100c se já existir — unificar no mais próximo da proposta)
- surface #241e18 / surface-2 #2e261e
- ink #f7f1e8 · muted #b5a794 · faint #8a7b68
- primary âmbar #f59e0b · secondary #fb923c · accent sky #38bdf8
- ok #4ade80 · danger #f87171
- border rgba(247,241,232,0.12) / strong 0.22
- radius ~14px · shadow denso com glow âmbar sutil
- Tipografia: display bold/uppercase em títulos-chave; mono para IDs, totais, badges (Outfit + IBM Plex Mono já linkados em layout.tsx — pode reforçar pesos 700–800; NÃO next/font se offline quebrar)
- Pattern sutil de “obra/trama” (repeating-linear-gradient no hero) como na proposta
- Botões primary: âmbar sólido + sombra glow; uppercase letter-spacing leve; min-height ≥ 44–46px
- Badges severidade: filled (ok/warn/risk/info), não só outline fraco

Sensação em 2s: “ferramenta de canteiro + clareza documental”, NÃO SaaS startup genérico, NÃO anime, NÃO hospital white.

# Diagnóstico (estado B1/B2 atual)
- Shell funcional mas “form dark genérico” — pouca hierarquia de capa
- Steps = pills planas sem progress bar / sem peso de pipeline operacional
- Cards sem shadow/hot-state; métricas de caso não gravam na retina
- Matriz legível mas sem legenda visual de status (included/excluded/ambiguous)
- Findings OK estruturalmente, mas pouco “raio-X” (capa fraca, sem scorecards documentais)
- Relatório sem capa imprimível / share-worthy do veredito
- Gate humano sem urgência visual de “bloqueio de envio”
- Eyebrow ainda “Backoffice interno · B2” — atualizar para branding de produto

# Job (UMA iteração — só polish visual + microcopy de UI)
L1/B3 — **Obra Clareza visual punch** no revisor-cetico-de.

## Metas por tela (obrigatório fechar todas)

1) **Intro (capa do backoffice)**
   - Hero card com badge “OBRA CLAREZA · BACKOFFICE”, título com destaque âmbar em “Raio-X” ou palavra-chave
   - 3 metric chips no hero (ex.: vertical Reforma leve · região Grande SP · gate Humano obrigatório) — estilo .metric da proposta
   - Perspectivas: cards com borda left colorida, tags mono, hover sutil; grid responsivo
   - Disclaimer em callout com borda left âmbar (não sumir no muted)
   - CTA primário forte: “Abrir caso demo” (ou microcopy equivalente, sem cringe)

2) **Caso**
   - Header do caso com ID mono + status badge
   - DL de metadados em grid “ficha de obra” (labels uppercase mono 0.72–0.8rem)
   - Cada proposta = card com total grande mono; header sticky-feel; bloco aritmética OK/BAD com ícone/glyph CSS (não emoji spam)
   - Tabelas de itens: zebra sutil, sticky thead se couber CSS, scope status com chips coloridos (included=ok, excluded/not_stated=danger, ambiguous/client_provides=warn)

3) **Matriz**
   - Título + legenda de 4–5 status com swatches
   - Células com background tint + peso tipográfico por status (não só cor de texto)
   - Observação com ênfase quando “alto risco de aditivo”
   - Overflow-x suave em mobile (shadow edge opcional)

4) **Findings / Riscos**
   - Card por finding com border-left por severidade + header com ID mono, chips severidade (filled) e basis
   - Bloco evidência com fundo mais escuro, aspas tipográficas no excerpt
   - Footer mono: confiança % · perspectiva · flag “escalar profissional” em badge sky/warn se true
   - Ordem visual: critical/high primeiro se já não ordenado (só CSS/ordem de render se dados permitirem; NÃO inventar findings)

5) **Relatório (capa “Raio-X do seu orçamento”)**
   - Capa no topo: título display + versão mono + 2–3 metric cards (total A, total B, gaps/abertos)
   - Veredito em bloco “hot” (borda âmbar + gradient surface) — printável
   - Seções numeradas com kicker uppercase
   - Resumo WhatsApp: terminal-like (já existe .rx-pre) + botão copiar com feedback toast/inline forte
   - Sensação: primeira página do PDF futuro (mesmo sem gerar PDF)

6) **Gate humano (Gate 6)**
   - Banner de bloqueio: “Nenhum envio automático” com visual de trava
   - Status badge grande; textarea com label uppercase
   - Botões: secondary Voltar · danger “Pedir informação” · primary “Aprovar para entrega” com hierarquia clara
   - Estados approved / needs_information com banners filled (ok / warn), não só parágrafo colorido

7) **Shell global**
   - Header sticky sutil com título + badge de status do caso
   - Stepper com número em medalhão, estado on/done/todo, progress (linha ou contador “3/6”)
   - Fundo: radial âmbar + sky como na proposta (não flat único)
   - Mobile ~390px + safe-area; touch ≥ 44px; focus-visible acessível
   - prefers-reduced-motion: desligar animação de reveal se houver

## Copy / tom PT-BR
- Profissional, direto, obra/documental — zero anime slang
- Proibido na UI: “é golpe”, “desonesto”, “laudo”, “aprovado pela engenharia”, “preço absurdo”
- Permitido: “risco de…”, “não foi possível verificar…”, “precisa esclarecer…”, “não comparável diretamente…”
- Atualizar eyebrow: ex. “Backoffice · revisão documental” (tirar “· B2”)

## Restrições (crítico)
- NÃO alterar: lib/domain.ts (aritmética, labels de basis/severity), demo-case.ts (valores/totais/findings/evidence), app.config.ts monétização/capabilities, JSON de personas (ids/system)
- NÃO adicionar: API routes, upload, DB, PDF real, WhatsApp webhook, billing, auth, deps de animação (framer etc.)
- NÃO quebrar static export (output: "export")
- CSS-first; SVG inline original ok; zero assets de terceiros / IP
- YAGNI: não refatorar em design system package; local em globals.css + RevisorApp
- Pode ajustar classNames/markup em RevisorApp.tsx para hierarquia — sem mudar estado/lógica de approve/copy/go

## Arquivos principais
- apps/revisor-cetico-de/src/app/globals.css          ← tokens + polish principal
- apps/revisor-cetico-de/src/components/RevisorApp.tsx ← markup/hierarquia/microcopy UI
- apps/revisor-cetico-de/src/app/layout.tsx            ← fonts só se necessário
- apps/revisor-cetico-de/src/app/page.tsx              ← wrapper se houver
- Referência visual (somente leitura): maestro/proposals/revisor-cetico-de/proposal-2.html
- NÃO tocar: src/lib/domain.ts, src/lib/demo-case.ts, content/personas/revisor-pack-v2.json (salvo typo de display se inevitável)

## Anti-padrões (NÃO fazer)
- Purple gradient / glassmorphism genérico / “Inter everywhere”
- Emoji spam em todo heading
- Wall of text no intro
- Redesenhar fluxo (não adicionar steps, não remover gate)
- Inventar scores de “confiabilidade do fornecedor”
- next/font se build offline quebrar
- Gold-plating: charts libs, virtualização de tabela, dark/light toggle

## VERIFY
1. Claim workbench/CLAIMS.md: A | glm | L1 | B3 | revisor-cetico-de | <hora>
2. QUEUE: B3 revisor-cetico-de → Done
3. npm run build -w @forge/revisor-cetico-de  (ou npm run build:revisor) → EXIT 0 + static export
4. Smoke mental: intro → caso → matriz → riscos → relatório (copiar) → gate (aprovar / pedir info)
5. Confirmar: totais/aritmética/findings demo INALTERADOS
6. HANDOFF.md: last agent glm, next = B5 ship check (ou P3 se B5 ok) — sem push sem autorização
7. Liberar claim

## Definition of Done (user-facing)
- [ ] Em 2s parece backoffice de obra (Obra Clareza), não form genérico dark
- [ ] Matriz e findings legíveis em 390px com status visual óbvio
- [ ] Capa do relatório “printável” / diga-se “wow” operacional
- [ ] Gate humano grita “humano no loop”
- [ ] build EXIT 0 + workbench coerente
- [ ] Nenhuma string de linguagem proibida introduzida

Comece lendo proposal-2.html + RevisorApp.tsx + globals.css, implemente o mínimo de máximo impacto visual, rode o build, feche workbench.
```

---

## Nota pro user / orquestrador

| Quem | O quê |
|------|--------|
| **Grok (B1/B2)** | Scaffold + pack de perspectivas — visual seco esperado |
| **GLM 5.2 MAX (B3)** | Executa o bloco PROMPT — apelo Obra Clareza |

**Como usar:** abra o repo no GLM 5.2 MAX, cole o bloco `PROMPT` inteiro, deixe rodar `npm run build:revisor`.

**Dev local:** `npm run dev:revisor` → http://localhost:3000

**Referência visual:** abra `maestro/proposals/revisor-cetico-de/proposal-2.html` no browser antes/durante o polish.
