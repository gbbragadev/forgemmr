import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryImporter } from "../memory/importer.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-import-root-"));
  const local = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-import-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(local, { recursive: true, force: true }));
  for (const dir of [
    "docs",
    "workbench",
    "maestro/pipelines",
    "maestro/runs/probe",
    "node_modules/pkg",
  ]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "README.md"), "# Forge\n\nOPEN_ROUTER_API_KEY=secret memória da fábrica");
  fs.writeFileSync(path.join(root, "docs", "decision.md"), "# Decisão\n\nUsar gateway local.");
  fs.writeFileSync(path.join(root, "workbench", "HANDOFF.md"), "# Handoff\n\nPróximo gate.");
  fs.writeFileSync(path.join(root, ".env"), "OPEN_ROUTER_API_KEY=secret");
  fs.writeFileSync(path.join(root, "node_modules", "pkg", "readme.md"), "não importar");
  fs.writeFileSync(path.join(root, "maestro", "runs", "probe", "L1-B1.raw.log"), "segredo bruto");
  fs.writeFileSync(
    path.join(root, "maestro", "pipelines", "probe.json"),
    JSON.stringify({
      appId: "probe",
      status: "paused_gate",
      currentJob: "L1/B1",
      prompt: "não importar prompt",
      privatePath: "C:\\secret",
      gates: [{ id: "review", choices: ["go", "kill"], decision: null, createdAt: "2026-07-14T00:00:00.000Z" }],
      history: [{ job: "L0/P0", pass: true, errorTail: "não importar tail", startedAt: "2026-07-13T00:00:00.000Z", endedAt: "2026-07-13T00:01:00.000Z" }],
      startedAt: "2026-07-13T00:00:00.000Z",
      endedAt: null,
    }),
  );
  return { root, checkpointPath: path.join(local, "import-checkpoint.json") };
}

test("discover usa allowlist fechada e preview redige sem escrever", async (t) => {
  const { root, checkpointPath } = fixture(t);
  const writes = [];
  const importer = createMemoryImporter({
    root,
    checkpointPath,
    redact: (value) => value,
    writeRecord: async (record) => writes.push(record),
  });

  const discovered = importer.discover();
  assert.deepEqual(discovered.map((item) => item.path), [
    "README.md",
    "docs/decision.md",
    "maestro/pipelines/probe.json",
    "workbench/HANDOFF.md",
  ]);
  const serialized = JSON.stringify(discovered);
  assert.equal(serialized.includes(".env"), false);
  assert.equal(serialized.includes("raw.log"), false);
  assert.equal(serialized.includes("node_modules"), false);

  const preview = await importer.preview({ all: true });
  assert.equal(preview.count, 4);
  assert.equal(writes.length, 0);
  assert.equal(JSON.stringify(preview).includes("OPEN_ROUTER_API_KEY=secret"), false);
  assert.match(JSON.stringify(preview), /\[REDACTED\]/);
  const pipeline = preview.entries.find((entry) => entry.path === "maestro/pipelines/probe.json");
  assert.equal(JSON.stringify(pipeline).includes("errorTail"), false);
  assert.equal(JSON.stringify(pipeline).includes("privatePath"), false);
});

test("apply exige preview, deduplica por hash e reimporta arquivo alterado", async (t) => {
  const { root, checkpointPath } = fixture(t);
  const writes = [];
  const importer = createMemoryImporter({
    root,
    checkpointPath,
    redact: (value) => value.replaceAll("OPEN_ROUTER_API_KEY=secret", "[REDACTED]"),
    writeRecord: async (record) => {
      writes.push(record);
      return { sourceHash: record.sourceHash };
    },
  });

  const preview = await importer.preview({ paths: ["docs/decision.md"] });
  const firstHash = preview.entries[0].sourceHash;
  const first = await importer.apply({ previewId: preview.previewId });
  assert.deepEqual(first, { imported: 1, skipped: 0, failed: 0 });
  assert.equal(writes[0].sourceHash, firstHash);
  const repeated = await importer.apply({ previewId: preview.previewId });
  assert.deepEqual(repeated, { imported: 0, skipped: 1, failed: 0 });
  assert.equal(writes.length, 1);

  fs.appendFileSync(path.join(root, "docs", "decision.md"), "\nNova evidência.");
  const changedPreview = await importer.preview({ paths: ["docs/decision.md"] });
  assert.notEqual(changedPreview.entries[0].sourceHash, firstHash);
  const changed = await importer.apply({ previewId: changedPreview.previewId });
  assert.equal(changed.imported, 1);
  assert.equal(writes.length, 2);
  assert.equal(fs.existsSync(checkpointPath), true);
  assert.equal(path.resolve(checkpointPath).startsWith(path.resolve(root)), false);
});

test("seleção fora da descoberta e apply sem preview falham fechados", async (t) => {
  const { root, checkpointPath } = fixture(t);
  const importer = createMemoryImporter({
    root,
    checkpointPath,
    redact: (value) => value,
    writeRecord: async () => assert.fail("seleção inválida não pode escrever"),
  });

  await assert.rejects(importer.preview({ paths: [".env"] }), /seleção|descoberta/i);
  await assert.rejects(importer.preview({ paths: ["../outside.md"] }), /seleção|descoberta/i);
  await assert.rejects(importer.apply({ previewId: "unknown" }), /prévia/i);
});
