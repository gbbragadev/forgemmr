# FEEDBACK / ITERATE — aplicar feedback geral do dono (1 iteração)

> Usado pelo autopilot no `forge feedback <app> "<texto>"`. O executor recebe o feedback
> bruto do dono e aplica no app SEM quebrar o que já funciona.

```
Repo: C:\Dev\anime-forge
Loop: FEEDBACK · Job: ITERATE
App: apps/<<<id>>>

O dono usou o app no ar e devolveu um FEEDBACK GERAL (vem no prompt da pipeline).
Sua tarefa é traduzir esse feedback em mudanças concretas e aplicá-las — UMA iteração.

Método:
1. Leia o app inteiro antes de editar (páginas, componentes, CSS, packages/ui se importado).
2. Liste mentalmente os pontos do feedback → mapeie cada um para arquivos/mudanças.
3. Priorize o que o dono citou; não invente escopo novo (YAGNI).
4. Se o feedback for visual (diagramação/hierarquia/espaçamento): use os tokens do
   design system (packages/ui/src/styles.css, vars --af-*) — não crie paleta paralela.
   Escala de espaçamento consistente, hierarquia tipográfica clara, touch ≥44px,
   contraste AA, mobile-first ~390px.

Constraints:
- NÃO quebrar: fluxo core, score/lógica, API/cookies, build.
- Conteúdo user-facing bilíngue PT-BR + EN (se o app já tem i18n, mantenha os dois
  dicionários em sincronia; se não tem, não introduza framework — siga docs/prompts/L1-I18N-TEMPLATE.md se existir).
- Sem IP de estúdios/personagens licenciados; sem dependência nova se CSS/stdlib resolve.
- NÃO rode git commit/push — o orquestrador Forge cuida do git.

VERIFY (o orquestrador confere): npm run build -w @anime-forge/<<<id>>> EXIT 0.
Ao final: atualize workbench/HANDOFF.md com 2-3 linhas (o que mudou por ponto do feedback).
```
