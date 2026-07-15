import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createFactoryAdmin } from "../control/factory-admin.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-factory-admin-"));
  fs.mkdirSync(path.join(root, "maestro"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "maestro", "roster.json"),
    JSON.stringify({
      version: "2.0",
      players: [{ id: "legacy", name: "Legado", cli: "fake", roles: [] }],
      teams: { legacy: { label: "Legado", dispatch: { default: "legacy" }, fallbacks: {} } },
    }),
  );
  return root;
}

test("profiles e times são administrados sem apagar configuração existente", () => {
  const root = fixtureRoot();
  const admin = createFactoryAdmin({ root });
  try {
    const created = admin.createProfile({
      name: "Anime Revenue",
      namespace: "@forge",
      niche: "anime",
      baseUrl: "example.com",
      i18nRule: "bilingual",
      context: "Apps originais orientados a receita.",
    });
    assert.equal(created.slug, "anime-revenue");
    assert.equal(admin.listProfiles().find((profile) => profile.slug === created.slug)?.active, true);
    assert.match(fs.readFileSync(path.join(root, ".forge", "profile.md"), "utf8"), /Anime Revenue/);

    const team = admin.saveTeam({
      name: "Produto enxuto",
      emoji: "🎼",
      fallbackPolicy: "strict",
      members: [
        { provider: "codex", model: "gpt-5.6-sol", effort: "high", roles: ["Engenheiro", "QA"] },
        { provider: "claude", model: "sonnet", effort: "high", roles: ["Designer", "Revisor"] },
      ],
    });
    assert.equal(team.teamId, "produto-enxuto");
    assert.equal(team.players.length, 2);
    assert.ok(team.team.review);
    assert.equal(team.team.fallbackPolicy, "strict");
    assert.deepEqual(team.team.fallbacks[team.players[0].id], []);

    const roster = JSON.parse(fs.readFileSync(path.join(root, "maestro", "roster.json"), "utf8"));
    assert.ok(roster.teams.legacy, "time preexistente precisa sobreviver");
    assert.ok(roster.players.some((player) => player.id === "legacy"), "player preexistente precisa sobreviver");
    assert.equal(roster.teams[team.teamId].dispatch["L1/B4"], "produto-enxuto-codex1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("providers mostram disponibilidade local e login usa allowlist com shell false", () => {
  const root = fixtureRoot();
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex.cmd"), "@echo off\r\n");
  const calls = [];
  const admin = createFactoryAdmin({
    root,
    env: { PATH: bin, PATHEXT: ".CMD;.EXE" },
    platform: "win32",
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return { pid: 42, unref() {} };
    },
  });
  try {
    const providers = admin.listProviders();
    assert.equal(providers.find((provider) => provider.id === "codex").installed, true);
    assert.equal(providers.find((provider) => provider.id === "gemini").installed, false);

    const login = admin.startProviderLogin("codex");
    assert.deepEqual(login, { provider: "codex", started: true, pid: 42 });
    assert.equal(calls[0].command, path.join(bin, "codex.cmd"));
    assert.deepEqual(calls[0].args, ["login"]);
    assert.equal(calls[0].options.shell, false);
    assert.equal(calls[0].options.windowsHide, true);

    assert.throws(() => admin.startProviderLogin("gemini"), /não está instalado/);
    assert.throws(() => admin.startProviderLogin("powershell"), /provider desconhecido/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Blueprint Studio cria, deriva, arquiva e restaura contratos versionados", () => {
  const root = fixtureRoot();
  const admin = createFactoryAdmin({ root });
  try {
    const spec = JSON.stringify({
      PLAN: { verify: { type: "file", path: "docs/${appId}/plan.md" } },
      REVIEW: { verify: { type: "file", path: "docs/${appId}/review.md" } },
    });
    const base = admin.saveBlueprint({
      name: "Pipeline editorial",
      title: "Pipeline editorial",
      purpose: "Transformar briefing em pauta revisada.",
      jobs: "PLAN\nREVIEW",
      jobSpecs: spec,
    });
    const child = admin.deriveBlueprint({
      source: base.id,
      name: "Pipeline jurídica",
      title: "Pipeline jurídica",
      jobs: "PLAN\nREVIEW",
      jobSpecs: spec,
    });
    assert.equal(child.derivedFrom.blueprintId, base.id);
    assert.equal(admin.archiveBlueprint(child.id).archived, true);
    assert.equal(admin.restoreBlueprint(child.id).archived, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
