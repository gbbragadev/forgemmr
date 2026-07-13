import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSubstantialText, thinMarkdownSections, isSubstantialHtml } from "../engine.mjs";

const foundationSections = [
  ["Arquitetura", /^(Arquitetura|Architecture)\b/i],
  ["Decisões", /^(Decisões|Decisions)\b/i],
];

test("FOUNDATION reprova headings vazios e aceita seções com conteúdo real", () => {
  const empty = "# System Design\n\n## Arquitetura\n\n## Decisões\n";
  assert.deepEqual(thinMarkdownSections(empty, foundationSections), ["Arquitetura", "Decisões"]);

  const valid = [
    "# System Design",
    "## Arquitetura",
    "Frontend estático com estado local, rotas explícitas e fronteiras documentadas entre UI, domínio e persistência temporária.",
    "## Decisões",
    "Escolhemos estado local no v0 para reduzir operação; banco entra somente após sinal real de retenção e necessidade multi-device.",
  ].join("\n\n");
  assert.deepEqual(thinMarkdownSections(valid, foundationSections), []);
});

test("P1 reprova documento sem conteúdo útil", () => {
  assert.equal(hasSubstantialText("# Hooks\n\n## Ideias\n\n- TODO"), false);
  assert.equal(
    hasSubstantialText("# Hooks\n\n" + "Hook demonstrável com CTA, público e canal definidos. ".repeat(3)),
    true
  );
});

test("DS-GEN reprova HTML curto ou sem estilo", () => {
  assert.equal(isSubstantialHtml("<html><style>body{}</style></html>"), false);
  assert.equal(isSubstantialHtml(`<html><body style="color:red">${"conteúdo ".repeat(70)}</body></html>`), true);
  assert.equal(isSubstantialHtml(`<html><body>${"conteúdo ".repeat(70)}</body></html>`), false);
});
