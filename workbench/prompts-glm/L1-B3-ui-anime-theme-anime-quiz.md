# Prompt GLM 5.2 MAX — L1/B3 Anime theme / visual punch (anime-quiz)

> Cole o bloco **PROMPT** abaixo no GLM 5.2 MAX (repo `C:\Dev\anime-forge`).  
> Grok **não** implementa frontend forte — só este prompt + workbench.  
> Feedback do user (2026-07-10): *“podia ter apelo maior ao tema anime; partes só texto puro; mais atrativo.”*  
> Causa raiz: B1 do Grok foi **scaffold lógico** (YAGNI), não falha do GLM. Agora é o job visual.

---

## PROMPT

```
Você é um product designer + front-end senior especializado em apps mobile de nicho anime (JP-inspired UI, sem copiar IP de estúdios). Objetivo: transformar um quiz “funcional mas texto-puro” num produto com **apelo visual imediato** — o tipo de tela que vira print no TikTok.

# Contexto
Repo: C:\Dev\anime-forge
App: apps/anime-quiz (Next.js 15 App Router)
Dev: npm run dev:quiz → http://localhost:3000  (NÃO usar :3001 — Docker devolve "Running")
Contrato: AGENTS.md · claim L1/B3 · workbench/
Kernel: packages/ui (tokens CSS em styles.css — reutilizar --af-* )
Lógica de score: apps/anime-quiz/src/lib/quiz.ts — **NÃO quebrar**
Banco: content/quizzes/anime-archetype-v1.json (8 perguntas)
Arquétipos: content/personas/quiz-archetypes-v1.json (soft, rival, cyber, idol, sage, gamer)

# Diagnóstico (o que o user sentiu)
- Intro / perguntas / opções = blocos de texto com pouca personalidade
- Poucos “sinais de anime” (silhueta, medalha, estrelas, speech bubble, frame de card)
- Resultado tem glow, mas o caminho até lá é seco
- Parece formulário, não “episódio curto”

# Job (UMA iteração — só polish visual + microcopy)
L1/B3 — **Anime theme / visual punch** no anime-quiz.

## Metas de UX/visual (obrigatório fechar todas)
1) **Intro com gancho visual** — não só título + botão:
   - Badge/kicker estilo anime (“EP. 01 · QUIZ”)
   - Ilustração CSS/SVG original (ex.: silhueta de personagem genérico + sparkles / sakura) — **sem** assets de obras protegidas, **sem** baixar PNGs de terceiros se evitar dep
   - Preview mini dos 6 arquétipos (bolinhas coloridas com inicial ou ícone + nome curto) — “você pode ser um destes”
2) **Perguntas com frame de cena**:
   - Número da pergunta em pill grande (01/08)
   - Título da pergunta com hierarquia forte
   - Fundo com pattern sutil (dots/stars CSS) sem atrapalhar leitura
3) **Opções que parecem “escolha de diálogo”**, não lista HTML crua:
   - Cada option = card com (a) glyph/emoji-safe OU ícone SVG mínimo por tipo de resposta (se mapear for difícil, use letra A/B/C/D em medalhão com borda glow)
   - Hover/press: lift + borda accent
   - Touch ≥ 48px
4) **Resultado = share card “photocard”** (melhorar o que já existe):
   - Aspect ratio 9:16 mobile-friendly
   - Frame duplo / corner ornaments CSS
   - Avatar monograma grande com cor do arquétipo (displayName[0] ou id)
   - Tags em chips
   - Blurb (starter) legível
   - Watermark “arquétipos originais · AnimeQuiz”
   - Micro-animação de reveal (fade+scale 200–300ms; respeitar prefers-reduced-motion)
5) **Share** — manter Web Share + clipboard; botão com ícone; feedback toast/nota visível
6) **Tom de copy** PT-BR levemente anime/internet (sem cringe excessivo):
   - Botão start: ex. “Começar o arco” / “Descobrir meu vibe”
   - Progress: “Cena 3 de 8”
   - Não copiar falas de obras reais

## Restrições (crítico)
- NÃO alterar scoring / JSON de pesos (salvo se precisar de campo opcional visual no JSON — preferir CSS/map no front)
- NÃO adicionar capability image, billing, API OpenRouter, deps pesadas (html2canvas ok só se já for necessário; preferir HTML/CSS screenshot-friendly)
- NÃO redesenhar packages/ui inteiro; pode reusar tokens e, se fizer componente reutilizável de verdade, só com justificativa
- NÃO usar nomes de personagens/estúdios de IP
- YAGNI: zero lib de animação se CSS der conta
- Mobile-first ~390px; safe-area

# Arquivos principais a editar
- apps/anime-quiz/src/components/AnimeQuizApp.tsx
- apps/anime-quiz/src/app/globals.css
- apps/anime-quiz/src/app/page.tsx (hero se precisar)
- Opcional: apps/anime-quiz/src/components/* novos (ResultPhotocard.tsx, ArchetypeChip.tsx, SceneDecor.tsx)

# Referência de tokens (já existem)
packages/ui/src/styles.css — --af-bg, --af-primary, --af-primary-2, --af-sakura, --af-glow, etc.

# Anti-padrões (NÃO fazer)
- Purple gradient genérico sem hierarquia
- Emoji spam em toda linha
- Lottie/video pesado
- Wall of text no intro
- Dark pattern / paywall falso

# VERIFY
1. Claim workbench/CLAIMS.md: A | glm | L1 | B3 | anime-quiz | <hora>
2. QUEUE: B3 anime-quiz → Doing → Done
3. npm run build:quiz (raiz) deve passar
4. Smoke mental: intro → 2 cliques de opção → resultado → share
5. HANDOFF.md: last agent glm, next = B5 ou P4 measure
6. Liberar claim

# Definition of Done (user-facing)
- [ ] Em 2s de tela, dá pra “sentir” app de anime (não form genérico)
- [ ] Opções com presença visual (não só texto em botão flat)
- [ ] Resultado printável / share-worthy
- [ ] build:quiz OK
- [ ] workbench coerente

Comece lendo os arquivos listados, implemente o mínimo com máximo impacto visual, rode build:quiz, feche workbench.
```

---

## Nota pro user

| Quem | O quê |
|------|--------|
| **Grok (B1)** | Fez scaffold “funciona + barato” → texto-puro é esperado nessa fase |
| **GLM (B3)** | Deve fechar o **apelo anime** com este prompt (mais explícito que o B3 do waifu-chat) |

**Como usar:** abra o repo no GLM 5.2 MAX, cole o bloco `PROMPT` inteiro, deixe rodar `build:quiz`.

**Dev local:** `npm run dev:quiz` → http://localhost:3000
