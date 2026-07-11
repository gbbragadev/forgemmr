# HANDOFF — Onboarding unificado + fixes de gate + controle de git / repo-por-app / concorrência

> **Para a nova sessão do Claude Code (ou Codex/GLM) aberta em `C:\Dev\forge`.**
> Este arquivo é o briefing completo. O diagnóstico das causas-raiz **já foi feito** na sessão
> anterior — está aqui com `arquivo:linha`. **Re-leia o código antes de editar** (as linhas podem
> ter mudado), mas não precisa re-diagnosticar do zero.

---

## 0. O que é o forge (contexto de 30s)

- `C:\Dev\forge` = **fork genérico** do anime-forge: pipeline autônoma `ideia → P0 → FOUNDATION →
  DS-GEN → P1 → B1..B5 → gates → ship`, orquestrando CLIs de **subscription** (grok/claude/glm/
  codex/gemini). **Nunca API paga por chamada.**
- Vertical é configurável via `.forge/profile.md` (bloco ```forge-config``` JSON + narrativo),
  lido por `loadProfile()` em `engine.mjs`.
- Server em **:8799** (`maestro/server.mjs`), CLI `forge` (`maestro/forge.mjs`, TUI full-screen +
  cliente REST/SSE), motor `maestro/engine.mjs`. Cockpit web = `maestro/index.html`.
- Guia primário do repo: **`AGENTS.md`** (loops L0/L1/L2). **Repo é local-only** (sem remote) —
  não criar remote/push sem o dono pedir.

## Regras de trabalho (valem a sessão toda)

1. **Ground antes de editar.** Leia o arquivo/função antes de mexer. Use `codebase-memory`/grep.
2. **Testar sem gastar limite:** use o team **`dry-run`** (fake executor, zero quota) pra exercitar
   a pipeline E2E; `node --check` em todo `.mjs` editado; teste as funções puras direto com node.
   **Só rodar executor real (grok/glm/etc.) com OK explícito do dono.**
3. **Commit por unidade lógica**, mensagem `fix(forge): …`/`feat(forge): …`. **Não push** (local-only).
4. **Não reiniciar o server no meio de um run vivo** (mata o pipeline). Agora não há run vivo
   (o dono parou), então reiniciar após as mudanças é esperado e OK.
5. pt-BR com acentuação no conteúdo user-facing. Effort é **real** só em grok/codex; etiqueta em
   claude/glm/gemini.

---

## PASSO 0 — Higiene de git (FAÇA ANTES DE QUALQUER EDIÇÃO)

Estado atual (verificado): working tree na branch **`pipeline/o-anima-deck`** (um run
ABANDONADO — projeto errado, começou como "anima-deck" por causa do arquivo de ideia). O tree está
"limpo" porque um checkpoint do pipeline commitou tudo nessa branch — **incluindo uma correção de 1
linha que precisa ir pro master** (veja abaixo). O `master` NÃO tem essa linha.

```bash
cd C:\Dev\forge
git branch --show-current          # deve dizer: pipeline/o-anima-deck
git checkout master                # volta pro baseline bom (NÃO use reset --hard: perderia a linha abaixo)
git status -sb                     # master deve estar limpo
```

**Re-aplique a correção de descoberta do cockpit** (perdida na branch abandonada). Em
`maestro/forge.mjs`, no render de gate do TUI, logo após a linha do prompt do gate
(`out.push(row(bold(fg(YELLOW, `⏸ ${g.id}`)) + ...))`), insira:

```js
        out.push(row(fg(CYAN, `🔍 revise no navegador: ${API}`) + dim("  · doc/preview renderizado + botões")));
```

Depois descarte a branch abandonada:

```bash
git branch -D pipeline/o-anima-deck
git branch --list "pipeline/*"     # deve ficar vazio
node --check maestro/forge.mjs && git add maestro/forge.mjs && git commit -m "fix(forge): TUI mostra URL do cockpit em todo gate"
```

> **Por que a linha importa:** o dono não sabia que o cockpit (http://127.0.0.1:8799) **renderiza**
> o scorecard/system-design como página (função `md()` em `index.html` + `renderGate`), com botões.
> O TUI só mostrava o caminho do `.md` → ele achava que o forge "só gera doc". Essa linha aponta
> pro cockpit em todo gate.

---

## FASE 1 — Fixes mecânicos + onboarding (confiante, dá pra testar com dry-run)

### P1 · Propostas do DS-GEN dão "Not found" no cockpit  ⟶ `maestro/server.mjs`

**Causa-raiz:** as 3 propostas existem em `maestro/proposals/<app>/proposal-{1,2,3}.html`, mas o
`server.mjs` **não tem rota `/proposals/`**. O cockpit (`index.html`, no `renderGate` do payload
`proposals:<app>`) faz `<iframe src="/proposals/<app>/proposal-N.html">` → 404.

**Fix:** adicionar rota `/proposals/` espelhando a rota `/docs/` (procure `url.pathname.startsWith("/docs/")`
em `server.mjs`, ~linha 762). **Atenção:** propostas ficam sob `maestro/` (isto é, `__dirname`),
não sob `ROOT`. Servir de `path.join(__dirname, "proposals")` com guard `insideDir` e `contentType`.

```js
// Propostas do DS-GEN (gate ds-pick): /proposals/<app>/proposal-N.html
if (url.pathname.startsWith("/proposals/")) {
  const propDir = path.join(__dirname, "proposals");
  const f = path.resolve(propDir, "." + url.pathname.slice("/proposals".length));
  if (insideDir(propDir, f) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { "Content-Type": contentType(f) });
    fs.createReadStream(f).pipe(res);
    return;
  }
  res.writeHead(404); res.end("proposta não encontrada"); return;
}
```
Confirme que `__dirname`/`insideDir`/`contentType` existem no escopo (o `/docs/` usa os mesmos).

### P2 · Gate `ds-pick` no TUI não deixa escolher 1/2/3  ⟶ `maestro/forge.mjs`

**Causa-raiz:** o gate `ds-pick` tem `choices: ["1","2","3","retry","kill"]`, mas o **render** do
gate no TUI (procure `if (g.choices.includes("go"))`, ~linha 338-342) só monta opções pra
`go`/`retry`/`kill`; e o **keypress** (procure `if (key.name === "g")`, ~linha 254+) só mapeia
`g/k/r/f`. Nunca os numéricos. (`decideKey` já valida `g.choices.includes(choice)` e posta — então
basta mapear as teclas.)

**Fix (2 pontos):**
1. No render, antes/junto das opções, para cada `n` de `["1","2","3"]` que esteja em `g.choices`:
   `opts.push(`${bold("["+n+"]")} escolher ${n}`)`.
2. No keypress, adicionar: `if (["1","2","3"].includes(str) && gate()?.choices.includes(str)) await decideKey(str);`
   (colocar junto dos outros `decideKey`; cuidar pra não conflitar com digitação de feedback —
   só quando `!state.input`).

O cockpit web **já tem** os botões "Escolher 1/2/3" (`index.html`) — depois do P1 eles funcionam.
Este P2 é pra paridade no terminal.

### P3 · 🔴 BLOQUEANTE pro onboarding — profile é lido 1× no boot  ⟶ `maestro/engine.mjs`

**Causa-raiz:** `const profile = loadProfile(root)` é chamado **uma vez** dentro de `createEngine()`
(~linha 305) e as funções (`buildPrompt`/`verify`/`pipelineFooter`/`start`) leem esse `profile` por
closure. Consequência: **trocar `.forge/profile.md` NÃO afeta o server já rodando** até reiniciar.
Se o onboarding (Fase 1/P4) deixa o usuário escolher o profile e só reescreve o arquivo, o run vai
usar o profile do boot → **o seletor fica cosmético.** (Provado nesta sessão: o dono trocou pra
"gameads" e um run novo ainda pegaria "anime".)

**Fix:** tornar `profile` um `let` e **recarregar no início de cada run** — em `start()` e
`startFeedback()`, fazer `profile = loadProfile(root)` antes de montar o pipeline. **Verifique de
verdade que a reatribuição propaga** para `buildPrompt`/`verify`/`pipelineFooter` (se elas
capturam `profile` por referência do escopo, propaga; se recebem cópia, ajustar). Teste: com o
server no ar, trocar `.forge/profile.md`, iniciar um dry-run e conferir no log/prompt que o niche/
namespace novo aparece **sem reiniciar**.

### P4 · Onboarding unificado no `forge` sem args  ⟶ `maestro/forge.mjs` (função `wizard()`, ~linha 375)

Hoje `forge` sem args chama `wizard()` (passos: ideia → time → tipo → confirmar). O dono quer, **num
único fluxo antes do P0, sem `--flags` e sem editar arquivo:**

1. **PROFILE explícito** — escolher de uma lista; o escolhido **vira o ativo** e fica **sempre
   visível no header** do TUI e nos logs. Opção "➕ criar novo" inline. (Decisão travada com o dono:
   *"vira o ativo + fica explícito"*.)
2. **IDEIA + NOME editável** — o nome do app hoje sai de `slugify()` (`engine.mjs:87`, 3 primeiras
   palavras da ideia) → deu "o-anima-deck" pra uma ideia em prosa. **O nome tem que ser editável**
   (default = `slugify(idea)`, o usuário corrige).
3. **TIME inline** — escolher um **preset** do roster **OU** "➕ montar time custom"
   (provedor→modelo→effort→funções + salvar como preset). (Decisão travada: *"preset + opção de
   montar"*.) Reusar as peças puras (`composeTeam`, `PROVIDERS`, `TEAM_ROLES`, `writeTeamToRoster`,
   `buildProfileMd`, `slugify` — já exportadas/definidas).
4. **TIPO** (static/quiz/chat) e **CONFIRMAR** → `POST /api/pipeline/start`.

**Arquitetura (IMPORTANTE — não improvisar):** faça **UM wizard self-contained: um único keyloop,
um único ciclo de vida** (alt-screen + keypress). **NÃO aninhe telas** e **não faça re-entrada
sequencial** chamando `profileWizard()`/`teamWizard()` de dentro — alt-screen (`?1049h/l`) e stdin
**não empilham**, e isso só dá pra validar rodando (não dá pra testar interativo aqui). Copie o
*padrão* dos 3 wizards que já funcionam (`wizard`, `profileWizard` ~509, `teamWizard` ~697) e reuse
os **dados** (`fields`, `i18nOpts`, `PROVIDERS`, `TEAM_ROLES`) e as **funções puras**. Mais linhas,
porém cada uma copia código que já roda — é a escolha segura sem teste interativo.

**Modelo de profiles (definir e implementar):**
- Biblioteca de profiles: `profiles/<slug>/profile.md`. Ativo = cópia em `.forge/profile.md` (o que
  a engine lê). Rastrear o ativo em `.forge/active.txt` (1 linha = slug) p/ pré-seleção + header.
- `listProfiles()`: varre `profiles/*/profile.md`, extrai `name`/`niche`. Marca ativo via active.txt.
- `activateProfile(slug)`: copia `profiles/<slug>/profile.md` → `.forge/profile.md` + grava active.txt.
- **Seed/migração:** o `.forge/profile.md` atual (o dono acabou de gerar um "gameads" via
  `forge profile init`, que grava direto em `.forge/`, **não** em `profiles/`) precisa aparecer na
  lista. No start do wizard, se `.forge/profile.md` existe e não tem correspondente em `profiles/`,
  importe-o pra `profiles/<slug-do-name>/`. (O anime já está em `profiles/anime-arcana/`.)
- Ajuste `forge profile init` pra gravar em `profiles/<slug>/` **e** ativar (hoje só grava `.forge/`).

**Header sempre explícito:** troque o título `🎼 MAESTRO · NOVO APP` por
`🎼 MAESTRO · NOVO APP · Profile: <name-ativo>` no render, e logue o profile ativo ao iniciar o run.

> **Depende do P3.** Sem o reload de profile em `start()`, o seletor não muda nada no run.

**Verificação da Fase 1:** `node --check` nos 3 arquivos; subir o server; **dry-run E2E** com team
`dry-run` do onboarding até o `ds-pick`, conferindo no cockpit que (a) o profile ativo aparece no
header, (b) as 3 propostas abrem no iframe (P1), (c) dá pra escolher 1/2/3 no TUI (P2) e no cockpit;
e que trocar de profile no wizard muda o niche no prompt sem restart (P3). Commit por P (P1, P2,
P3, P4 separados).

---

## FASE 2 — Controle de git: repo-por-app + worktrees + concorrência (DESIGN-FIRST, gated)

O dono pediu: *"um bom controle de git, worktrees, branches, commits, repos — seria bom cada app
ter repo"* e **rodar mais de 1 pipeline ao mesmo tempo**. Isto é **redesenho**, não patch — trate
como fase própria: **proponha o design ao dono e obtenha OK antes de implementar** (é decisão de
arquitetura com trade-offs reais).

### Por que hoje só roda 1 pipeline

- `pipeline` é **singleton** na engine e `start()` (`engine.mjs:970`) barra se já houver um ativo.
- Motivo real: todo run dirige o **working tree único** — `git checkout -b pipeline/<app>`
  (`engine.mjs:991`), checkpoint-commit por job, e no ship `checkout master; merge --no-ff; push`
  (`engine.mjs:748-761`). Dois runs simultâneos brigariam pelo mesmo working tree.

### Modelo desejado (recomendação a validar com o dono)

**Opção A — repo por app (alinhada com o pedido "cada app ter repo") — recomendada:**
- Cada app gerado tem **seu próprio repo git** (ex.: `git init` em `apps/<app>`, ou mover apps p/ um
  diretório dedicado). O pipeline opera no repo **do app** (branches/commits/checkpoints lá) → N
  pipelines em N repos independentes rodam **concorrentes sem contenção**. A "fábrica" (maestro/
  engine/packages/docs) fica intacta.
- Cada app pode depois ganhar **remote próprio no GitHub** + histórico/deploy independentes.
- **Tensão a resolver (nomear pro dono):** os apps hoje são **workspaces npm** (`@forge/<app>`,
  compartilham `packages/ui`, `packages/config`, `node_modules` da raiz). Se cada app é repo
  próprio: (a) manter como workspace **e** ter `.git` próprio (repos aninhados — git ignora `.git`
  aninhado; o repo externo deve `.gitignore` `apps/*/` pra não duplicar rastreio) — recomendado
  agora; ou (b) apps 100% standalone (vendorizar/publicar os packages) — mais trabalho. Recomendar
  (a): app segue workspace pro build/deps, mas tem `.git` próprio pro histórico/branch/remote.

**Opção B — git worktrees sobre o monorepo:** `git worktree add ../wt-<app> pipeline/<app>` por
run → isolamento de working dir sem repo por app. Dá concorrência, mas o histórico fica emaranhado
num repo só (não atende "cada app ter repo"). Menos alinhada; citar como alternativa.

### Mudanças de engine/server pra concorrência (esboço)

- Trocar `pipeline` singleton por **`pipelines: Map<appId, state>`**; `start()` cria entrada nova
  (barra só se o **mesmo** appId já roda), operando no repo/worktree daquele app.
- O `advanceLoop` vira **por-pipeline** (N loops async). Cuidar de recursos compartilhados: **log e
  SSE precisam ser marcados por pipeline** (tag appId); `/api/pipeline` passa a devolver o mapa (ou
  um selecionado); `broadcastPipeline` por app.
- **Cockpit + TUI:** listar pipelines ativos e escolher qual ver/decidir (hoje assumem 1).
- **Superfície de git-control no `forge`:** `git init` no scaffold do app; checkpoint-commits com
  boa mensagem (`profile.git.commitPrefix`); branch-por-run **dentro** do repo do app; opção
  `git remote add` + push quando o dono optar (ex.: criar repo no GitHub por app via `gh`).

**Entregável desta fase:** primeiro um **doc de design curto** (`docs/system-design-git-control.md`)
com a Opção A detalhada, a tensão de workspace resolvida, e o plano de migração dos apps existentes
→ **gate com o dono** → então implementar em incrementos testáveis (repo-por-app primeiro, depois
o `Map` de pipelines + SSE por app, depois cockpit/TUI multi-pipeline).

---

## Gotchas herdados (não redescobrir — custaram horas)

- **Grok headless = `grok -p <goal>`** (posicional abre TUI que trava). GLM = `claude -p` + env
  Z.ai (`ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`, `ANTHROPIC_AUTH_TOKEN=$GLM_API_KEY`,
  models `glm-5.2[1m]`/`glm-4.7`). Gemini = `agy -p --dangerously-skip-permissions` (binário em
  `%LOCALAPPDATA%\agy\bin`). Codex honra effort via `-c model_reasoning_effort`. Ver `adapters.mjs`.
- **Deploy CF:** token de escrita = env **`CF_GBBRAGADEV_ADM`** (o `CLOUDFLARE_API_TOKEN` é
  read-only). **CNAME do Pages tem que ser DNS-only** (proxied → Error 1014). O subdomínio pages.dev
  **não** é `<app>.pages.dev` (colide e a CF sufixa: `anime-quiz-9r7`) — pegar o `subdomain` real
  via API do projeto. NÃO subir deploy real sem OK do dono.
- **Engine recusa working tree suja** (`ensureCleanTree`) — commitar antes de rodar pipeline. O
  `forge stop` **não** volta pro master sozinho (`git checkout master` na mão).
- **Segredos:** nunca ecoar valores (`GLM_API_KEY`, `CF_GBBRAGADEV_ADM`, etc.); `makeRedactor()` em
  `adapters.mjs` já mascara em logs.
- **`maestro/proposals/` é gitignored** (as propostas geradas não entram no git — ok).

## Ordem sugerida (budget-safe)

1. **Passo 0** (git higiene) → commit da linha do cockpit.
2. **P1 + P2** (rota proposals + teclas 1/2/3) — baratos, destravam o ds-pick — commit cada.
3. **P3** (reload de profile) — bloqueante do onboarding — commit.
4. **P4** (onboarding unificado) — o maior da Fase 1 — commit.
5. **Fase 2** — design doc → gate com o dono → implementar. Provavelmente **sessão própria.**

Se o limite acabar no meio: as fases 0–1 já entregam um forge coeso (nome certo, profile explícito,
ds-pick funcionando); a Fase 2 fica pro próximo host com este mesmo arquivo como spec.
