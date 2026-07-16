# Plan 001: Corrigir docs ativamente errados, alinhar CI e remover artefatos commitados

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ab9f479..HEAD -- AGENTS.md CLAUDE.md README.md .env.example .github/workflows/ maestro/e2e-result.md .gitignore`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx | docs
- **Planned at**: commit `ab9f479`, 2026-07-16

## Why this matters

O repo tem documentação **ativamente errada** (pior que ausente): o comando de setup
em `AGENTS.md` e `CLAUDE.md` aponta para um diretório que não existe
(`C:\Dev\anime-forge` — o repo vive em `C:\Dev\forge`), o `README.md` afirma
"59 testes" quando a suíte real tem 204, e o CI testa em Node 24 enquanto o deploy
usa Node 20. Além disso há um artefato de build datado commitado
(`maestro/e2e-result.md`) e um arquivo-lixo `nul` na raiz (resíduo de redirecionamento
Windows). São 6 correções pequenas, todas verificáveis por comando, que eliminam
fricção de onboarding para humanos e agentes.

## Current state

Fatos verificados no commit `ab9f479`:

- `AGENTS.md:76` — dentro do bloco "## Comandos":
  ```
  cd C:\Dev\anime-forge
  ```
- `CLAUDE.md` (raiz do repo) — bloco "## Commands" tem a mesma linha errada:
  ```
  cd C:\Dev\anime-forge
  ```
- `README.md:285` — linha do estado:
  ```
  - ✅ Deploy Cloudflare Pages / Vercel · dry-run E2E sem quota · 59 testes
  ```
  A suíte real (`npm test`) reporta `tests 204 · pass 203 · skipped 1`.
- `maestro/e2e-result.md` — artefato datado (`date: 2026-07-10T08:15:22Z`,
  `executor: grok`) **trackeado no git** (`git ls-files` o lista). É output de run,
  não código.
- Arquivo `nul` na **raiz do repo** (163 bytes, untracked) — lixo de
  redirecionamento `> nul` do Windows.
- `.github/workflows/test.yml:14` — `node-version: "24"`.
  `.github/workflows/deploy-anime-quiz.yml:28` — `node-version: "20"`.
  `package.json` engines: `"node": ">=20"`. Máquina de dev local: v24.14.0.
- `.github/workflows/test.yml` roda `npm ci` + identidade git + `npm test` — **não
  roda lint**. Cada app define `"lint": "next lint"`, mas nenhum workflow o executa.
- `.env.example` documenta as vars de produto (ZAI/OpenRouter), mas **não documenta**
  as vars que o maestro lê para deploy/execução: `VERCEL_TOKEN`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FORGE_CODEX_SANDBOX`.
  (Cuidado: `GLM_API_KEY` JÁ aparece comentado na linha 10 — não duplicar.)

Convenções do repo: comentários e commits em pt-BR; commits estilo
`fix(maestro): ...` / `docs: ...` (veja `git log --oneline`); mudanças mínimas,
sem refatorar nada adjacente.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar deps | `npm install` | exit 0 |
| Testes | `npm test` | `tests 204`, `fail 0` (~80-110s) |
| Lint (todos apps) | `npm run lint --workspaces --if-present` | exit 0 (ver STOP) |
| Typecheck | `npm run typecheck --workspaces --if-present` | exit 0 |

## Scope

**In scope** (únicos arquivos a modificar):
- `AGENTS.md`
- `CLAUDE.md` (o da raiz do repo, NÃO o global do usuário)
- `README.md`
- `.env.example`
- `.github/workflows/test.yml`
- `.github/workflows/deploy-anime-quiz.yml`
- `.gitignore`
- `maestro/e2e-result.md` (deleção via git rm)
- `nul` na raiz (deleção do disco)

**Out of scope** (NÃO tocar):
- `maestro/p4-result.mjs` — parece artefato pelo nome, mas é um MÓDULO validador
  com teste próprio (`maestro/test/p4-result.test.mjs`). Não deletar.
- Qualquer código em `maestro/`, `apps/`, `packages/`.
- `docs/` (os handoffs e planos antigos ficam como histórico).
- Corrigir violações de lint dentro dos apps (se existirem — ver STOP conditions).

## Git workflow

- Branch: `advisor/001-higiene-docs-ci` (a partir do HEAD atual)
- Commits: pt-BR, estilo do repo. Sugestão: um commit só
  `docs+ci: corrige paths/contagens, alinha node, remove artefatos`
- NÃO fazer push nem abrir PR.

## Steps

### Step 1: Corrigir o path do repo em AGENTS.md e CLAUDE.md

Em `AGENTS.md` (bloco "## Comandos") e `CLAUDE.md` (bloco "## Commands"), trocar
`cd C:\Dev\anime-forge` por `cd C:\Dev\forge`.

**Verify**: `grep -rn "anime-forge" AGENTS.md CLAUDE.md` → nenhuma ocorrência de
`cd C:\Dev\anime-forge` (menções a "anime-forge" como nome histórico/URL do GitHub
Pages podem permanecer — só o comando `cd` importa).

### Step 2: Corrigir a contagem de testes no README

Rode `npm test` e anote a contagem real da linha `ℹ tests N`. Em `README.md:285`,
trocar `59 testes` por `N testes` (esperado: 204).

**Verify**: `grep -n "59 testes" README.md` → sem matches; `grep -n "testes" README.md`
mostra a contagem nova.

### Step 3: Remover artefatos

```bash
git rm maestro/e2e-result.md
rm nul
```
Adicionar ao `.gitignore` (seção nova ao final, com comentário):
```
# lixo de redirecionamento Windows e resultados de run E2E
nul
maestro/e2e-result.md
```

**Verify**: `git ls-files | grep e2e-result` → sem matches; `ls nul` → não existe;
`git status` mostra só arquivos in-scope.

### Step 4: Alinhar Node no CI

Em `.github/workflows/deploy-anime-quiz.yml:28`, trocar `node-version: "20"` por
`node-version: "24"` (mesma versão do test.yml e da máquina de dev).

**Verify**: `grep -n "node-version" .github/workflows/*.yml` → ambas `"24"`.

### Step 5: Adicionar lint ao CI

Em `.github/workflows/test.yml`, adicionar um step após `npm ci` (antes dos testes):
```yaml
      - run: npm run lint --workspaces --if-present
```
ANTES de editar, rode localmente `npm run lint --workspaces --if-present`.
Se falhar com violações existentes nos apps → STOP condition (não corrija os apps).

**Verify**: `npm run lint --workspaces --if-present` → exit 0 localmente;
`grep -n "lint" .github/workflows/test.yml` → step presente.

### Step 6: Documentar as vars do maestro no .env.example

Adicionar seção ao final de `.env.example`:
```
# --- Maestro (fábrica) — deploy e executores. NÃO são vars de produto. ---
# Deploy Cloudflare Pages (deploy.mjs):
# CLOUDFLARE_API_TOKEN=
# CLOUDFLARE_ACCOUNT_ID=
# Deploy Vercel (deploy.mjs):
# VERCEL_TOKEN=
# Sandbox do codex (adapters.mjs; default = bypass, ver README §7):
# FORGE_CODEX_SANDBOX=workspace-write
```
Antes, confirme os nomes exatos com: `grep -rn "process.env.CLOUDFLARE\|process.env.VERCEL_TOKEN\|FORGE_CODEX_SANDBOX" maestro/*.mjs`
— use os nomes que o código realmente lê; se algum não existir no código, não o documente.

**Verify**: `grep -n "CLOUDFLARE_API_TOKEN" .env.example` → presente (comentado, SEM valor).

## Test plan

Sem testes novos — este plano é docs/CI/higiene. A suíte existente é o guard-rail:

- Verificação final: `npm test` → `tests 204, fail 0` e
  `npm run typecheck --workspaces --if-present` → exit 0.

## Done criteria

- [ ] `grep -rn "cd C:\\\\Dev\\\\anime-forge" AGENTS.md CLAUDE.md` → 0 matches
- [ ] `grep -n "59 testes" README.md` → 0 matches
- [ ] `git ls-files | grep e2e-result` → 0 matches; arquivo `nul` não existe na raiz
- [ ] `grep -n "node-version" .github/workflows/*.yml` → ambos `"24"`
- [ ] step de lint presente em test.yml e `npm run lint --workspaces --if-present` exit 0
- [ ] `.env.example` documenta as vars do maestro (comentadas, sem valores)
- [ ] `npm test` → fail 0 · typecheck → exit 0
- [ ] `git status` limpo fora dos arquivos in-scope

## STOP conditions

- `npm run lint --workspaces --if-present` falha com violações reais nos apps —
  reporte quais apps/regras e NÃO adicione o step ao CI nem corrija os apps.
- Alguma var do Step 6 não é encontrada no grep do código do maestro.
- O `rm nul` falhar (o Windows trata `nul` como device name em alguns shells) —
  tente `rm ./nul` no Git Bash; se ainda falhar, reporte em vez de inventar
  workarounds com caminhos `\\.\`.
- Qualquer excerto de "Current state" não bater com o código atual.

## Maintenance notes

- Se um novo workflow de deploy for criado, manter `node-version` alinhado (24).
- O `.gitignore` agora bloqueia `nul` — se um comando futuro gerar `nul` de novo,
  é sinal de redirecionamento `> nul` num script cross-platform (usar `/dev/null`
  no Git Bash).
- Revisor deve conferir que NENHUM valor real de credencial entrou no `.env.example`.
