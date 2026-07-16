# Plan 006: Validar `profile.ai.envKey` e não interpolar em shell no deploy Workers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/deploy.mjs maestro/test/deploy.test.mjs maestro/test/deploy-targets.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

No deploy Cloudflare Workers, o nome da secret de IA (`profile.ai.envKey`) é
colado numa string e executado via `cmd.exe`/`bash`. Um `envKey` com metacaracteres
de shell (vindo de profile/forge-config) vira **command injection** no momento do
P3, com token Cloudflare no ambiente do processo. O `appId` já é validado; o
`envKey` não. Fechar isso é S e impede o único sink de shell injection no caminho
de ship de apps com API.

## Current state

- `maestro/deploy.mjs` — `run()` usa shell:
  ```js
  // ~70-77
  function run(cmd, env = {}, timeout = ..., cwd = ..., input = undefined) {
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";
    const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];
    const result = spawnSync(shell, shellArgs, { ... });
  }
  ```
- `maestro/deploy.mjs` deploy Workers (~516-519):
  ```js
  const aiKey = aiEnvKey || "ZAI_API_KEY";
  if (process.env[aiKey]) {
    const put = run(`npx --yes wrangler secret put ${aiKey} --name ${appId}`, ...);
  }
  ```
- `appId` já é checado com `/^[a-z0-9-]+$/` no início de `deployToCloudflareWorkers`.
- `aiEnvKey` vem de `profile.ai.envKey` (JSON livre no profile).
- Testes existentes: `maestro/test/deploy.test.mjs`, `deploy-targets.test.mjs`
  (padrão node:test + assert).

Convenções: commits `fix(maestro): ...` / `test(maestro): ...`; pt-BR em
comentários; YAGNI; não reescrever `run()` inteiro se um allowlist + argv bastar.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Testes deploy | `node --test maestro/test/deploy.test.mjs maestro/test/deploy-targets.test.mjs` | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/deploy.mjs`
- `maestro/test/deploy.test.mjs` e/ou novo `maestro/test/deploy-envkey.test.mjs`

**Out of scope**:
- Trocar todo `run()` para execFile (só o sink `secret put` + validação)
- Deploy Pages / gh-pages
- Profiles / UI

## Git workflow

- Branch: `advisor/006-sec-deploy-envkey`
- Commit style: `fix(maestro): valida envKey no wrangler secret put`
- Do NOT push unless operator asks

## Steps

### Step 1: Helper de allowlist

Em `deploy.mjs`, exportar ou definir:

```js
export function assertSafeEnvKey(name) {
  const key = String(name || "").trim();
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)) {
    throw new Error(`ai.envKey inválido: ${key.slice(0, 40)}`);
  }
  return key;
}
```

Antes de `wrangler secret put`, `const aiKey = assertSafeEnvKey(aiEnvKey || "ZAI_API_KEY")`.

Preferível: montar o comando **sem** interpolar raw — se ainda usar `run()` com
string, só depois do allowlist (allowlist já remove injection). Ideal: usar
`spawnSync`/`execFile` com argv `["npx", "--yes", "wrangler", "secret", "put", aiKey, "--name", appId]`
e `input: process.env[aiKey]` no stdin (o código já passa secret por stdin).

**Verify**: `node -e "import { assertSafeEnvKey } from './maestro/deploy.mjs'"` —
se não exportar, testar via teste unitário no step 2.

### Step 2: Testes

Casos:
1. `assertSafeEnvKey("ZAI_API_KEY")` → `"ZAI_API_KEY"`
2. `assertSafeEnvKey("evil; calc")` → throws
3. `assertSafeEnvKey("a$(id)")` → throws
4. (opcional) mock: deploy path rejeita envKey sujo antes de chamar shell

Modelar em `maestro/test/deploy.test.mjs` (imports nomeados do deploy.mjs).

**Verify**: `node --test maestro/test/deploy.test.mjs` → pass, novos testes incluídos.

### Step 3: Suíte

**Verify**: `npm test` → fail 0.

## Test plan

- Unit: allowlist positivo + 2 negativos
- Não precisa rede/Cloudflare

## Done criteria

- [ ] `aiKey` validado com `^[A-Z][A-Z0-9_]{0,63}$` antes de qualquer shell
- [ ] Testes cobrem reject de metacaracteres
- [ ] `npm test` fail 0
- [ ] Nenhum arquivo fora do scope
- [ ] `plans/README.md` status → DONE

## STOP conditions

- `run()` / signature de deploy Workers mudou de forma que o excerpt não existe
- Validar envKey quebra profiles reais com nomes legítimos (ex.: `Z_AI_API_KEY` com underscore no meio é OK; lowercase não — se profile usa lowercase, STOP e reporte em vez de afrouxar o regex sem perguntar)

## Maintenance notes

- Qualquer novo `run(\`...\${user}\`)` no deploy deve passar por allowlist ou argv.
- Reviewer: confirmar que secret continua no STDIN, nunca no argv logado.
