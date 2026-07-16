import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertSafeBlueprintId,
  assertSafeRepoRelPath,
  loadBlueprint,
} from "../blueprint-loader.mjs";

test("assertSafeBlueprintId rejeita traversal e aceita generic/slug", () => {
  assert.equal(assertSafeBlueprintId("generic"), "generic");
  assert.equal(assertSafeBlueprintId("gameads"), "gameads");
  assert.throws(() => assertSafeBlueprintId("../x"), /inválido/i);
  assert.throws(() => assertSafeBlueprintId("Has_Underscore"), /inválido/i);
});

test("assertSafeRepoRelPath confina sob root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-bp-"));
  try {
    const ok = assertSafeRepoRelPath(root, "docs/scorecard.md");
    assert.equal(ok, path.resolve(root, "docs/scorecard.md"));
    assert.throws(() => assertSafeRepoRelPath(root, "../../etc/passwd"), /\.\./i);
    assert.throws(() => assertSafeRepoRelPath(root, path.resolve(os.tmpdir(), "out.md")), /inválido|fora/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadBlueprint rejeita id e verify.path inseguros", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-bp-load-"));
  try {
    assert.throws(() => loadBlueprint("../evil", { root }), /inválido/i);
    const dir = path.join(root, "blueprints", "safebp");
    fs.mkdirSync(path.join(dir, "versions", "v1"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({ activeVersion: "v1" }),
      "utf8"
    );
    fs.writeFileSync(
      path.join(dir, "versions", "v1", "blueprint.json"),
      JSON.stringify({
        jobs: ["L0/P0"],
        jobSpecs: {
          "L0/P0": { verify: { type: "file", path: "../../.env" } },
        },
      }),
      "utf8"
    );
    assert.throws(() => loadBlueprint("safebp", { root }), /inseguro/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
