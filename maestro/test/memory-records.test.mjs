import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_TYPES,
  buildMemoryRecord,
  recordMarkdown,
  recordPath,
  recordToPage,
} from "../memory/records.mjs";
import { resolveMemoryScope } from "../memory/scopes.mjs";

test("escopo separa fábrica e apps sem aceitar identificadores ambíguos", () => {
  assert.deepEqual(resolveMemoryScope({ appId: "doki-call" }), {
    workspace: "forge",
    project: "app-doki-call",
  });
  assert.deepEqual(resolveMemoryScope({}), {
    workspace: "forge",
    project: "factory",
  });
  for (const appId of ["../secret", "Doki Call", "-invalid", "a".repeat(65)]) {
    assert.throws(() => resolveMemoryScope({ appId }), /appId/i);
  }
});

test("os sete tipos produzem registros congelados, rastreáveis e determinísticos", () => {
  assert.deepEqual(MEMORY_TYPES, [
    "decision",
    "error-resolution",
    "verification",
    "handoff",
    "product-learning",
    "rule",
    "outcome",
  ]);
  for (const type of MEMORY_TYPES) {
    const record = buildMemoryRecord({
      type,
      appId: "app-a",
      runId: "run-1",
      job: "L1/B1",
      summary: "Resultado validado",
      evidenceRefs: ["maestro/runs/run-1.json", "git:abc123"],
      observedAt: "2026-07-14T12:00:00.000Z",
    });
    assert.equal(Object.isFrozen(record), true);
    assert.match(record.sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(recordPath(record).endsWith(`${record.sourceHash}.md`));
  }
});

test("sourceHash inclui o escopo e o path de outcome é estável", () => {
  const a = buildMemoryRecord({ type: "outcome", appId: "a", summary: "PASS" });
  const b = buildMemoryRecord({ type: "outcome", appId: "b", summary: "PASS" });
  assert.notEqual(a.sourceHash, b.sourceHash);
  assert.match(recordPath(a), /^outcomes\/[a-f0-9]{64}\.md$/);
});

test("redaction acontece antes do markdown e do payload da página", () => {
  const record = buildMemoryRecord({
    type: "verification",
    appId: "probe",
    summary: "token=super-secret-value passou",
    evidenceRefs: ["reports/verify.md"],
    redact: (value) => value.replaceAll("super-secret-value", "[redacted]"),
    observedAt: "2026-07-14T12:00:00.000Z",
  });
  const markdown = recordMarkdown(record);
  const page = recordToPage(record);

  assert.equal(record.summary.includes("super-secret-value"), false);
  assert.equal(markdown.includes("super-secret-value"), false);
  assert.match(markdown, /^# Verificação/m);
  assert.match(markdown, /## Resumo/);
  assert.match(markdown, /## Contexto/);
  assert.match(markdown, /## Evidências/);
  assert.match(markdown, /## Metadados/);
  assert.equal(page.path, recordPath(record));
  assert.equal(page.workspace, "forge");
  assert.equal(page.project, "app-probe");
});

test("schema rejeita tipo, resumo e evidências fora do root lógico", () => {
  assert.throws(() => buildMemoryRecord({ type: "unknown", summary: "x" }), /tipo/i);
  assert.throws(() => buildMemoryRecord({ type: "outcome", summary: "" }), /summary/i);
  assert.throws(
    () => buildMemoryRecord({ type: "outcome", summary: "á".repeat(4_001) }),
    /8000 bytes/i,
  );
  for (const ref of ["../secret", "C:\\secret.txt", "/etc/passwd", "https://example.com/x"] ) {
    assert.throws(
      () => buildMemoryRecord({ type: "outcome", summary: "PASS", evidenceRefs: [ref] }),
      /evidenceRef/i,
    );
  }
});
