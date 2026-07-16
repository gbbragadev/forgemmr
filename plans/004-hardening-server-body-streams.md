# Plan 004: Hardening do server.mjs — limite de body e streams com tratamento de erro

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ab9f479..HEAD -- maestro/server.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: MED (toca caminho de request de produção; mitigado pelos testes)
- **Depends on**: none (autocontido; sinergia com 003 se já tiver landado)
- **Category**: security | bug
- **Planned at**: commit `ab9f479`, 2026-07-16

## Why this matters

Duas fraquezas confirmadas por leitura no `maestro/server.mjs`:

1. **`readBody()` não tem limite de tamanho** — acumula chunks sem checar total.
   Um POST de centenas de MB (acidental ou malicioso via página que faça
   requests contra 127.0.0.1:8799) derruba o processo por OOM — e o maestro é o
   orquestrador de TODAS as pipelines.
2. **7 rotas de arquivo estático fazem `fs.createReadStream(f).pipe(res)` sem
   handler de erro** — se o arquivo sumir/falhar I/O no meio do stream (apps/out
   é reescrito por builds!), a response fica pendurada ou truncada sem status.

Ambos os fixes são pequenos, localizados e testáveis.

## Current state

- `maestro/server.mjs:597-611` — readBody atual (excerto real):
  ```js
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }
  ```
  Callers embrulham `await readBody(req)` em try/catch e respondem erro.
- Os 7 sites de pipe sem handler (linhas em `ab9f479`): `server.mjs:975, 991,
  1005, 1019, 1033, 1062, 1081`. Padrão típico (excerto real, rota `/_next/`):
  ```js
  res.writeHead(200, { "Content-Type": contentType(candidate) });
  fs.createReadStream(candidate).pipe(res);
  ```
- Path traversal JÁ é defendido (`insideDir(...)` antes de cada stream) — NÃO
  mexer nessa lógica.
- Padrão de teste do server: `maestro/test/server-http.test.mjs` (fakeEngine +
  `mkdtempSync` root + `start(server)` — copie o setup de lá).
- Convenções: comentários pt-BR curtos explicando o "porquê"; http puro sem
  dependências novas.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar deps | `npm install` | exit 0 |
| Testes deste plano | `node --test maestro/test/server-hardening.test.mjs` | todos passam |
| Suíte completa | `npm test` | `fail 0` |

## Scope

**In scope**:
- `maestro/server.mjs` (somente: `readBody` + os 7 sites de pipe + um helper novo)
- `maestro/test/server-hardening.test.mjs` (criar)

**Out of scope** (NÃO tocar):
- A lógica `insideDir`/validação de path das rotas estáticas (segurança existente).
- Rotas SSE e broadcast (`sseClients`) — comportamento atual é deliberado.
- `maestro/test/server-http.test.mjs` (referência read-only).
- Qualquer outro arquivo do maestro.

## Git workflow

- Branch: `advisor/004-server-hardening`
- Commit: `fix(maestro): limita body de POST e trata erro de stream estático`
- NÃO fazer push nem abrir PR.

## Steps

### Step 1: Limite de tamanho no readBody

Adicionar limite (5 MB é folgado — os payloads reais são decisões de gate e
imports de memória):
```js
const MAX_BODY_BYTES = 5 * 1024 * 1024; // requests reais são KB; protege o processo de OOM
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        const err = new Error("body excede o limite");
        err.statusCode = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(c);
    });
    // end/error como hoje
  });
}
```
Depois, localizar os call sites (`grep -n "readBody(req)" maestro/server.mjs`) e
garantir que o catch responda **413** quando `e.statusCode === 413` (hoje
respondem um erro genérico). Se os catches forem todos iguais, um helper
`bodyErrorResponse(res, e)` é aceitável — mas mantenha o diff mínimo.

**Verify**: teste do Step 3 (413) passa.

### Step 2: Helper de stream com tratamento de erro

Criar UM helper perto das rotas estáticas e usá-lo nos 7 sites:
```js
// stream com guarda: arquivo pode sumir no meio (apps/out é reescrito por builds)
function streamFile(res, filePath, type) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    } else {
      res.destroy(); // headers já foram: derruba a conexão p/ sinalizar truncamento
    }
  });
  res.writeHead(200, { "Content-Type": type });
  stream.pipe(res);
}
```
Substituir os 7 sites `res.writeHead(200, ...); fs.createReadStream(f).pipe(res);`
por `streamFile(res, f, contentType(f))` (atenção: um site usa `candidate`, outro
`filePath` — confira cada um pela linha).

**Verify**: `grep -n "createReadStream" maestro/server.mjs` → só DENTRO de
`streamFile` (1 ocorrência).

### Step 3: Testes

Novo `maestro/test/server-hardening.test.mjs` (setup copiado do
`server-http.test.mjs`):
1. POST numa rota com body de 6 MB (`"x".repeat(6*1024*1024)`) → resposta **413**
   e o servidor continua respondendo requests seguintes.
2. POST com body JSON válido pequeno → segue funcionando (não regrediu).
3. Rota estática servindo arquivo real de um tmpdir (crie `root/marketing/ig-kit/x.html`
   e chame `/ig-kit/x.html`) → 200 com o conteúdo.
4. Rota estática com arquivo inexistente → 404 (comportamento atual preservado).

**Verify**: `node --test maestro/test/server-hardening.test.mjs` → todos passam.

### Step 4: Suíte completa

**Verify**: `npm test` → `fail 0` (nenhum teste existente regrediu — em especial
`server-http.test.mjs` e `security-boundaries.test.mjs`).

## Test plan

Step 3 acima. Padrão: `maestro/test/server-http.test.mjs`. Os testes de
segurança existentes (`security-boundaries.test.mjs`) são o guard-rail de que a
validação de path não mudou.

## Done criteria

- [ ] `readBody` rejeita > 5 MB com `statusCode 413` e destrói o request
- [ ] Call sites respondem 413 nesse caso (teste prova)
- [ ] `grep -c "createReadStream" maestro/server.mjs` → 1 (só no helper)
- [ ] 4 testes novos passam; `npm test` → `fail 0`
- [ ] `git status`: só os 2 arquivos in-scope

## STOP conditions

- Algum dos 7 sites de pipe tiver headers/status diferentes de `200 +
  Content-Type` (ex.: cache headers) que o helper não cobre — reporte em vez de
  generalizar o helper.
- O teste de 413 travar (indicaria que destruir o request antes do fim interage
  mal com o client de teste) — reporte com o comportamento observado.
- `npm test` regredir em teste que você não criou.
- Excertos de "Current state" não baterem com o código atual.

## Maintenance notes

- Se algum endpoint futuro legitimamente precisar de body > 5 MB (import de
  memória grande?), subir o limite NESSE endpoint, não globalmente.
- O `res.destroy()` com headers enviados é deliberado: truncamento silencioso é
  pior que conexão derrubada (o browser refaz; um arquivo pela metade não).
- Revisor: conferir que `insideDir` continua sendo chamado antes de todo
  `streamFile`.
