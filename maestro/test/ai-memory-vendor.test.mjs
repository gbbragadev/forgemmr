import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), "utf8");

test("ai-memory vendorizado está pinado na release auditada e mantém MIT", () => {
  const cargo = read("integrations/ai-memory/Cargo.toml");
  const license = read("integrations/ai-memory/LICENSE");
  const manifest = JSON.parse(read("maestro/memory/runtime-manifest.json"));
  const notice = read("THIRD_PARTY_NOTICES.md");

  assert.match(cargo, /version = "1\.13\.0"/);
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Fabio Akita/);
  assert.equal(manifest.source.tagObject, "39a1e2482348107751f5a40861238e97ca7eba8b");
  assert.equal(manifest.source.commit, "94626aad1aa254901cdc6437c270894f5bb70340");
  assert.equal(manifest.platforms["win32-x64"].sha256.length, 64);
  assert.match(notice, /Fabio Akita/);
  assert.match(notice, /94626aad1aa254901cdc6437c270894f5bb70340/);
});
