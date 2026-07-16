# Plan 009: Operator intake — bloquear SSRF e confinar paths ao root do repo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/operator.mjs maestro/test/`

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (pode reusar helper de path do plano 008 se já merged; senão duplique o mínimo)
- **Category**: security
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

`readIntakeSource` no operator aceita qualquer URL `http(s)` (com redirects) e
qualquer path absoluto legível no disco. O control plane exige token, mas o
processo Maestro roda com as credenciais do dono: isso vira **SSRF** (IMDS/LAN)
e **exfiltração de arquivos** para `.control/intake/`. Confinar URL e path é o
mínimo para intake seguro.

## Current state

`maestro/operator.mjs:145-183` (trecho):

```js
export async function readIntakeSource(input, { fetchImpl = globalThis.fetch } = {}) {
  ...
  if (/^https?:\/\//i.test(value)) {
    kind = "url";
    const response = await fetchImpl(value, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    ...
  } else if (fs.existsSync(path.resolve(value))) {
    const resolved = path.resolve(value);
    // lê arquivo ou pasta sem checar se está sob o monorepo
  }
}
```

`createForgeOperator` / handlers passam `root` — garantir que `readIntakeSource`
receba `{ root, fetchImpl }` e use `root`.

Procure callers: `rg "readIntakeSource" maestro`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes operator | `node --test maestro/test/*operator*.test.mjs` (glob real) | fail 0 |
| Suíte | `npm test` | fail 0 |

## Scope

**In scope**:
- `maestro/operator.mjs`
- `maestro/test/` (novos testes de intake)
- Callers se a assinatura de `readIntakeSource` ganhar `root` obrigatório

**Out of scope**:
- Mudar UX do control center
- Baixar PDF/DOCX com parsers novos
- Allowlist de domínios de negócio além do default seguro

## Git workflow

- Branch: `advisor/009-sec-operator-intake`
- Commit: `fix(maestro): confina intake URL e path do operator`

## Steps

### Step 1: Path confinement

Assinatura: `readIntakeSource(input, { root, fetchImpl })`.
- Exigir `root` (string resolvida).
- Para path local: `resolved = path.resolve(root, value)` se relativo; se
  absoluto, só aceitar se `resolved === root || resolved.startsWith(root + sep)`.
- Rejeitar path fora com erro claro `fonte fora do repositório`.

### Step 2: URL / SSRF guards

Antes do fetch:
1. Parse `new URL(value)` — só `http:` e `https:`.
2. Hostname não pode ser `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`,
   `*.local`, nem IP literal em ranges privadas (127/8, 10/8, 172.16/12, 192.168/16,
   169.254/16, `::1`, `fc00::/7`).
3. **Redirect**: preferir `redirect: "manual"` ou `error` e **não** seguir para
   host privado; ou `redirect: "follow"` com max 3 e re-validar cada Location
   (mais trabalho). Mínimo aceitável: `redirect: "error"` + documentar que
   URLs com redirect precisam ser finais — OU follow com recheck de host.

Implementação sugerida (simples e segura):
- `redirect: "manual"`; se status 3xx, rejeitar com "redirect não permitido" **ou**
  revalidar Location e fetch uma vez (cap 2 hops).

### Step 3: Wire callers

Passar `root` de todos os call sites. Se teste mocka fetch, manter `fetchImpl`.

### Step 4: Testes

1. path `../` fora do tmp root → throws  
2. path arquivo dentro do tmp root → ok  
3. URL `http://127.0.0.1/` → throws  
4. URL `http://169.254.169.254/` → throws  
5. URL pública mock `fetchImpl` → ok  

Use tmpdir como em `maestro/test/deploy.test.mjs`.

**Verify**: `npm test` fail 0.

## Done criteria

- [ ] Path fora de `root` rejeitado
- [ ] Hosts loopback/privados rejeitados
- [ ] Redirects não abrem pivot privado (política documentada no comentário do código)
- [ ] Testes novos passam
- [ ] `plans/README.md` DONE

## STOP conditions

- Produto depende de ingest de `file://` ou de pastas absolutas fora do monorepo
  por design documentado — reporte; não reintroduza sem flag explícita
  `FORGE_OPERATOR_ALLOW_ABSOLUTE=1` (só se o dono pedir).

## Maintenance notes

- Reviewer: SSRF tests cobrem IMDS e localhost.
- Futuro: allowlist de hosts (GitHub raw, etc.) se precisar afrouxar.
