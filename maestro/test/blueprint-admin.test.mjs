import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createBlueprintAdmin } from "../control/blueprint-admin.mjs";
import { loadBlueprint } from "../blueprint-loader.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-blueprint-"));
}

const draft = {
  name: "Revisão cética",
  title: "Revisão cética de orçamentos",
  purpose: "Encontrar lacunas verificáveis antes da aprovação humana.",
  jobs: ["TRIAGE", "REPORT"],
  jobSpecs: {
    TRIAGE: { verify: { type: "file", path: "docs/${appId}/triage.md" } },
    REPORT: { verify: { type: "file", path: "docs/${appId}/report.md" } },
  },
};

test("blueprint versions are immutable, content addressed and load through active manifest", () => {
  const root = tempRoot();
  const admin = createBlueprintAdmin({ root, now: () => new Date("2026-07-14T22:00:00.000Z") });
  const first = admin.save(draft);
  assert.equal(first.id, "revisao-cetica");
  assert.match(first.activeVersion, /^sha256-[a-f0-9]{64}$/);

  const loaded = loadBlueprint(first.id, { root });
  assert.deepEqual(loaded.jobs, ["TRIAGE", "REPORT"]);
  assert.equal(loaded.version, first.activeVersion);

  const second = admin.save({ ...draft, title: "Revisão cética v2" }, { id: first.id, reason: "clarify" });
  assert.notEqual(second.activeVersion, first.activeVersion);
  assert.equal(second.versions.length, 2);
  assert.ok(fs.existsSync(path.join(root, "blueprints", first.id, "versions", first.activeVersion, "blueprint.json")));
});

test("derive records lineage; archive hides blueprint until restored", () => {
  const root = tempRoot();
  const admin = createBlueprintAdmin({ root });
  const base = admin.save(draft);
  const child = admin.derive(base.id, { ...draft, name: "Revisão jurídica", title: "Revisão jurídica" });
  assert.equal(child.derivedFrom.blueprintId, base.id);
  assert.equal(admin.list().some((item) => item.id === child.id), true);

  admin.archive(child.id);
  assert.equal(admin.list().some((item) => item.id === child.id), false);
  assert.equal(admin.list({ includeArchived: true }).find((item) => item.id === child.id).archived, true);
  assert.throws(() => loadBlueprint(child.id, { root }), /arquivado/);
  admin.restore(child.id);
  assert.equal(admin.list().some((item) => item.id === child.id), true);
});

test("legacy blueprint remains readable and can be migrated without changing jobs", () => {
  const root = tempRoot();
  const legacyDir = path.join(root, "blueprints", "legacy");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "blueprint.json"), JSON.stringify({
    name: "legacy",
    jobs: ["ONE"],
    jobSpecs: { ONE: { verify: { type: "file", path: "docs/${appId}/one.md" } } },
  }));
  const admin = createBlueprintAdmin({ root });
  const migrated = admin.migrate("legacy");
  assert.equal(migrated.id, "legacy");
  assert.equal(loadBlueprint("legacy", { root }).jobs[0], "ONE");
  assert.ok(fs.existsSync(path.join(legacyDir, "manifest.json")));
});

test("blueprint may inherit built-in verification from the generic pipeline", () => {
  const root = tempRoot();
  const admin = createBlueprintAdmin({ root });
  const saved = admin.save({
    name: "Generic focused",
    title: "Generic focused",
    jobs: ["L0/P0", "L1/B1"],
    jobSpecs: {
      "L0/P0": { verify: { type: "builtin" } },
      "L1/B1": { verify: { type: "builtin" } },
    },
  });
  const loaded = loadBlueprint(saved.id, { root });
  assert.equal(loaded.jobSpecs["L0/P0"].verify.type, "builtin");
});
