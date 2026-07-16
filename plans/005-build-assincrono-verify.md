# Plan 005: Tornar o build do verify assíncrono — destravar o event loop do maestro

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ab9f479..HEAD -- maestro/engine.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (toca o coração do verify; mitigado pela suíte de 204 testes)
- **Depends on**: none (mas rode a suíte inteira antes E depois)
- **Category**: perf | bug
- **Planned at**: commit `ab9f479`, 2026-07-16

## Why this matters

O verify de build roda `execSync("npm run build ...")` com timeout de **10
minutos**, síncrono, **dentro do processo do server** (`maestro/server.mjs`
importa o engine). Durante qualquer build de app (B5 ship-check, ITERATE), o
event loop inteiro congela: o cockpit SSE para de atualizar, a API não responde,
gates não podem ser decididos e as outras N pipelines param — exatamente o
oposto da promessa "N pipelines concorrentes" da arquitetura (README §3). Um
build de Next.js leva de 30s a minutos; multiplicado por pipelines paralelas, o
maestro fica cego boa parte do tempo. Trocar por exec assíncrono preserva a
semântica (mesmo shell, timeout, captura) e libera o event loop.

Nota do que NÃO é problema: os `execFileSync` de **git** (`engine.mjs:728, 740`)
são operações de milissegundos e a serialização deles é decisão documentada
(comentário em `engine.mjs:1563-1564`). **Não tocar no git.**

## Current state

- `maestro/engine.mjs:924` — `function verify(job) {` (função SÍNCRONA hoje).
- `maestro/engine.mjs:1026-1033` — o build síncrono (excerto real):
  ```js
  try {
    execSync(`npm run build -w ${profile.namespace}/${p.appId}`, {
      cwd: root,
      stdio: "pipe",
      timeout: 10 * 60 * 1000,
      encoding: "utf8",
    });
    return { pass: true, detail: "build exit 0" };
  } catch (e) {
    const tail = `${e.stdout || ""}\n${e.stderr || ""}`.slice(-4000);
  ```
  Logo acima (linhas 1021-1025) há guards de validação de `p.appId`
  (`/^[a-z0-9-]+$/`) e `profile.namespace` (`/^@?[a-z0-9._-]+$/`) porque o
  comando é interpolado em shell — **preservar os guards intactos**.
- Call sites de `verify` (só 2): `engine.mjs:1233` e `engine.mjs:1413` —
  ambos `const v = verify(job);`. Confirme que cada um está dentro de função
  `async` (runJob e o fluxo do advanceLoop são async).
- Import atual no topo do engine: `child_process` (o arquivo já importa de lá —
  `grep -n "child_process" maestro/engine.mjs`).
- A suíte (`npm test`, 204 testes) exercita o verify via dry-run/fake-exec e
  testes de regressão do engine (`engine-generic-regression.test.mjs`,
  `characterization.test.mjs`) — é o guard-rail deste plano.
- Convenções: comentários pt-BR explicando "porquê", diffs mínimos, sem
  dependências novas.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar deps | `npm install` | exit 0 |
| Suíte completa | `npm test` | `tests 204 · fail 0` (~80-110s) |
| Typecheck | `npm run typecheck --workspaces --if-present` | exit 0 |

## Scope

**In scope**:
- `maestro/engine.mjs` — somente: a assinatura de `verify`, o bloco do
  `execSync` do build, e os 2 call sites (`await`).

**Out of scope** (NÃO tocar):
- `git()` / `gitApp()` (`engine.mjs:725-741`) — sync deliberado e documentado.
- Qualquer outro `execSync`/`execFileSync`/`spawn` do repo.
- `maestro/server.mjs`, `maestro/adapters.mjs`.
- Refatorar o verify além do necessário (nada de quebrar em funções menores).

## Git workflow

- Branch: `advisor/005-async-build-verify`
- Commit: `fix(maestro): build do verify assíncrono — event loop livre durante builds`
- NÃO fazer push nem abrir PR.

## Steps

### Step 1: Rodar a suíte ANTES (baseline)

**Verify**: `npm test` → `tests 204 · fail 0`. Anote o tempo.

### Step 2: Trocar execSync por exec assíncrono

No topo do engine, garanta os imports (mantendo o estilo de import existente):
```js
import { exec } from "node:child_process"; // junto do import atual de child_process
import { promisify } from "node:util";
const execAsync = promisify(exec);
```
Trocar `verify(job)` para `async function verify(job)`. No bloco do build:
```js
try {
  // async: um build de minutos NÃO pode congelar o event loop do server (SSE/gates/N pipelines)
  await execAsync(`npm run build -w ${profile.namespace}/${p.appId}`, {
    cwd: root,
    timeout: 10 * 60 * 1000,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return { pass: true, detail: "build exit 0" };
} catch (e) {
  const tail = `${e.stdout || ""}\n${e.stderr || ""}`.slice(-4000);
```
Semântica preservada: `promisify(exec)` roda em shell (npm.cmd no Windows OK),
respeita `timeout` (mata o processo e rejeita), e no erro `e.stdout`/`e.stderr`
existem com o output capturado — o `tail` continua funcionando igual. O
`stdio: "pipe"` do execSync é o comportamento default do exec (remova a opção).
`maxBuffer` de 32 MB evita rejeição espúria em build verboso (o default é 1 MB —
menor que output real de Next build; o execSync não tinha esse limite explícito
mas usa o mesmo default: confira se o código atual passa `maxBuffer`; se o build
real já funcionava, 32 MB é seguro).

**Verify**: `node --check maestro/engine.mjs` → exit 0.

### Step 3: Await nos 2 call sites

Em `engine.mjs:1233` e `engine.mjs:1413`: `const v = await verify(job);`.
Confirme (leitura) que ambas as funções envolventes são `async`. Procure
qualquer OUTRO uso de `verify(` que este plano não conheça:
`grep -n "verify(job)\|= verify(" maestro/engine.mjs` — se aparecer um call site
extra não-async, STOP.

**Verify**: `grep -n "await verify(job)" maestro/engine.mjs` → 2 matches;
`node --check maestro/engine.mjs` → exit 0.

### Step 4: Suíte DEPOIS

**Verify**: `npm test` → `tests 204 · fail 0` (mesma contagem do Step 1; nenhuma
regressão). `npm run typecheck --workspaces --if-present` → exit 0.

## Test plan

Sem teste novo obrigatório: a mudança é de mecânica de execução com semântica
idêntica, e o comportamento do verify (pass/fail/detail/tail) já é coberto por
`engine-generic-regression.test.mjs` e `characterization.test.mjs` — que DEVEM
passar inalterados. Se algum teste do engine falhar, é sinal de semântica
quebrada: analise antes de "ajustar o teste" (ver STOP).

## Done criteria

- [ ] `grep -n "execSync" maestro/engine.mjs` → 0 matches
- [ ] `grep -n "await verify(job)" maestro/engine.mjs` → 2 matches
- [ ] Guards de `appId`/`namespace` (linhas ~1021-1025) intactos (diff não os toca)
- [ ] `git()`/`gitApp()` intocados (diff não contém as linhas 725-741)
- [ ] `npm test` → `tests 204 · fail 0`
- [ ] `git status`: só `maestro/engine.mjs`

## STOP conditions

- Existir um 3º call site de `verify(` fora dos 2 mapeados, em contexto síncrono.
- Qualquer teste do engine falhar após a troca e a causa não for óbvia em UMA
  leitura — NUNCA edite o teste para passar; reporte o teste e o erro.
- O timeout do exec assíncrono se comportar diferente no Windows (processo não
  morre) — reporte; não adicione tree-kill nem dependências.
- Excertos de "Current state" não baterem com o código atual.

## Maintenance notes

- Com o build async, DUAS pipelines podem buildar ao mesmo tempo — npm workspaces
  aguenta builds `-w` paralelos de apps distintos, mas se surgir flakiness de
  build concorrente, a correção é uma fila de builds (semáforo de 1) no engine,
  não voltar ao sync.
- Revisor: conferir no diff que o `tail` de erro continua alimentando o
  `errorTail`/history exatamente como antes (contrato do cockpit).
- Follow-up explícito fora deste plano: os `advanceLoop()` fire-and-forget são
  by-design (têm try/catch interno) — não "corrigir" de carona.
