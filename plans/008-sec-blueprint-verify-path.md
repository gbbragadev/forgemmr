# Plan 008: Confinar blueprint id e `verify.path` no load e no verify

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 895cc63..HEAD -- maestro/blueprint-loader.mjs maestro/engine.mjs maestro/fake-exec.mjs maestro/control/blueprint-admin.mjs maestro/test/`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `895cc63`, 2026-07-16

## Why this matters

O studio (`blueprint-admin`) rejeita paths absolutos e `..` **no save**, mas
`loadBlueprint` e `verify()` do engine confiam no JSON em disco. Blueprint
hand-edited ou legado com `verify.path` tipo `../../.env` ou id `../other`
pode false-PASS verify ou escrever fora do repo no dry-run (`FORGE_FAKE_OUTFILE`).
O chokepoint certo é o loader + assert reutilizado no verify/fake-exec.

## Current state

- `maestro/blueprint-loader.mjs:18-23`:
  ```js
  export function loadBlueprint(name, { root }) {
    const bpName = name || "generic";
    if (bpName === "generic") return { name: "generic", external: false };
    const dir = path.join(root, "blueprints", bpName);
  ```
  Sem regex no `bpName`.

- `maestro/control/blueprint-admin.mjs` (~60) já rejeita absolute/`..` no save —
  copiar a regra, não reinventar com semântica diferente.

- `maestro/engine.mjs` verify file (~932-934):
  ```js
  const f = path.join(root, spec.verify.path);
  if (!fs.existsSync(f)) return { pass: false, ...};
  ```

- `maestro/fake-exec.mjs` escreve `FORGE_FAKE_OUTFILE` se set — pode ser absoluto.

- Helper `insideDir` existe em `maestro/server.mjs:64-67` — **não** importar de
  server (ciclo). Reimplementar mini helper em `blueprint-loader.mjs` ou
  `maestro/paths.mjs` se precisar de arquivo novo (preferir export do loader).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Testes blueprint | `node --test maestro/test/blueprint*.test.mjs` (ajuste ao glob real) | fail 0 |
| Suíte | `npm test` | fail 0 |

Liste testes existentes: `rg -l blueprint maestro/test`.

## Scope

**In scope**:
- `maestro/blueprint-loader.mjs`
- `maestro/engine.mjs` (só verify path check — mínimo)
- `maestro/fake-exec.mjs` (rejeitar outfile fora do root se root conhecido)
- `maestro/test/*` novos/ajustados

**Out of scope**:
- UI do blueprint studio (já valida save)
- Deploy
- Conteúdo dos blueprints gameads/pmoc existentes (só se um path for inválido — STOP)

## Git workflow

- Branch: `advisor/008-sec-blueprint-path`
- Commit: `fix(maestro): confina blueprint id e verify.path`

## Steps

### Step 1: Helpers exportados

Em `blueprint-loader.mjs` (ou `maestro/safe-path.mjs` se o loader ficar feio):

```js
export function assertSafeBlueprintId(id) {
  const s = String(id || "");
  if (s !== "generic" && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(s)) {
    throw new Error(`blueprint id inválido: ${s.slice(0, 40)}`);
  }
  return s;
}

export function assertSafeRepoRelPath(root, rel) {
  const raw = String(rel || "");
  if (!raw || path.isAbsolute(raw) || raw.includes("\0")) throw new Error("path inválido");
  if (raw.split(/[/\\]/).some((p) => p === "..")) throw new Error("path não pode conter ..");
  const resolved = path.resolve(root, raw);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("path fora do repo");
  }
  return resolved;
}
```

### Step 2: Wire loadBlueprint

No início de `loadBlueprint` (após generic): `assertSafeBlueprintId(bpName)`.  
Para cada `spec.verify.type === "file"`: `assertSafeRepoRelPath(root, spec.verify.path)`.

### Step 3: Wire engine verify

Antes de `path.join(root, spec.verify.path)`, chamar o mesmo assert (import do loader).

### Step 4: fake-exec

Se `FORGE_FAKE_OUTFILE` for absoluto ou contiver `..`, exit 1 com mensagem clara.
Se o env tiver `FORGE_ROOT` ou cwd for root do monorepo, confinar sob root.
(Mínimo: rejeitar absolute e `..` sem precisar de root.)

### Step 5: Testes

- id `../x` throws
- id `gameads` ok (se existir) ou id sintético
- verify.path `../../etc/passwd` throws
- verify.path `docs/scorecard.md` resolve ok

**Verify**: `npm test` fail 0.

## Done criteria

- [ ] Blueprint id fora do padrão rejeitado
- [ ] verify.path com `..` ou absoluto rejeitado no load e no verify
- [ ] Testes novos passam
- [ ] `plans/README.md` DONE

## STOP conditions

- Blueprints em `blueprints/` usam ids com underscore ou maiúsculas — se algum
  quebrar o regex, STOP e reporte a lista em vez de alargar silenciosamente.

## Maintenance notes

- Qualquer novo consumer de path de blueprint deve importar `assertSafeRepoRelPath`.
