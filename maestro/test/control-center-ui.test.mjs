import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readMaestroFile = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("Control Center exposes the eight zero-command work areas", () => {
  const html = readMaestroFile("index.html");

  assert.match(html, /Forge Nexus/);
  assert.doesNotMatch(html, />Maestro Control Center</);
  assert.match(html, /<nav[^>]+aria-label="Navegação principal"/i);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  for (const id of [
    "overview",
    "new-pipeline",
    "pipelines",
    "decisions",
    "factory",
    "metrics",
    "memory",
    "activity",
  ]) {
    assert.match(html, new RegExp(`<section[^>]+id="${id}"`, "i"), `missing ${id} work area`);
  }
  assert.match(html, /aria-live="polite"/i);
  assert.match(html, /<dialog\b[^>]+id="action-dialog"/i);
  assert.match(html, /<link[^>]+control-center\.css/i);
  assert.match(html, /<script[^>]+type="module"[^>]+control-center\.js/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /<script(?![^>]+src=)[^>]*>/i);
});

test("Control Center consumes the closed control-plane API without a command escape hatch", () => {
  const js = readMaestroFile("control-center.js");

  assert.match(js, /Nexus indisponível/);
  for (const name of [
    "loadSnapshot",
    "renderOverview",
    "renderPipelines",
    "renderDecisions",
    "renderFactory",
    "renderMetrics",
    "renderMemory",
    "loadMemoryOverview",
    "searchMemory",
    "previewMemoryImport",
    "applyMemoryImport",
    "renderActivity",
    "renderRunConsole",
    "openAction",
    "renderActionField",
    "executeAction",
    "requestConfirmation",
    "connectEvents",
  ]) {
    assert.match(js, new RegExp(`(?:function|const)\\s+${name}\\b`), `missing ${name}`);
  }

  for (const endpoint of [
    "/api/control/snapshot",
    "/api/token",
    "/api/control/confirmations",
    "/api/control/actions/execute",
    "/api/events",
    "/api/memory/status",
    "/api/memory/overview",
    "/api/memory/search",
    "/api/memory/briefing",
    "/api/memory/import/preview",
    "/api/memory/import/apply",
  ]) {
    assert.match(js, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  assert.match(js, /crypto\.randomUUID\(\)/);
  assert.match(js, /X-Maestro-Token/);
  assert.match(js, /state_stale/);
  assert.match(js, /\.textContent\s*=/);
  assert.match(js, /function\s+renderDecisionContext\b/);
  assert.match(js, /\/proposals\//);
  assert.match(js, /\/preview\//);
  assert.match(js, /event\.appId\s*===\s*pipeline\.appId/);
  assert.match(js, /Saída completa/);
  assert.match(js, /Progresso ao vivo/);
  assert.match(js, /Full auto/);
  assert.match(js, /Automático até gate/);
  assert.doesNotMatch(js, /\beval\s*\(/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  assert.doesNotMatch(js, /(?:shell|terminal|command)\s*:/i);
});

test("Control Center visual contract is responsive, accessible and tokenized", () => {
  const css = readMaestroFile("control-center.css");

  for (const color of ["#11110f", "#171613", "#f4efe6", "#c46cff", "#56d89b", "#f0bd57", "#ff6b6b"]) {
    assert.match(css.toLowerCase(), new RegExp(color));
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  for (const breakpoint of [375, 768, 1024, 1440]) {
    assert.match(css, new RegExp(`(?:min|max)-width:\\s*${breakpoint}px`), `missing ${breakpoint}px breakpoint`);
  }
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.run-console/);
  assert.match(css, /\.run-console-line/);
});
