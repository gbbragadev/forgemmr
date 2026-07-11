import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildProfileMd, loadProfile, listProfiles, activateProfile, importActiveProfile } from "../engine.mjs";

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-profiles-"));
}

function writeProfile(root, slug, name, niche) {
  const dir = path.join(root, "profiles", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "profile.md"), buildProfileMd({ name, niche }), "utf8");
}

test("listProfiles: root vazio devolve []", () => {
  const root = tmpRoot();
  assert.deepEqual(listProfiles(root), []);
});

test("listProfiles: lista slug/name/niche e marca ativo via active.txt", () => {
  const root = tmpRoot();
  writeProfile(root, "anime-arcana", "Anime Arcana", "anime");
  writeProfile(root, "gameads", "GameAds", "gameads");
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  fs.writeFileSync(path.join(root, ".forge", "active.txt"), "gameads", "utf8");
  const list = listProfiles(root);
  assert.equal(list.length, 2);
  const game = list.find((p) => p.slug === "gameads");
  assert.equal(game.name, "GameAds");
  assert.equal(game.niche, "gameads");
  assert.equal(game.active, true);
  assert.equal(list.find((p) => p.slug === "anime-arcana").active, false);
});

test("activateProfile: copia para .forge/profile.md + grava active.txt (round-trip via loadProfile)", () => {
  const root = tmpRoot();
  writeProfile(root, "outro", "Outro Projeto", "outro-nicho");
  activateProfile(root, "outro");
  assert.equal(fs.readFileSync(path.join(root, ".forge", "active.txt"), "utf8").trim(), "outro");
  const prof = loadProfile(root);
  assert.equal(prof.name, "Outro Projeto");
  assert.equal(prof.niche, "outro-nicho");
});

test("activateProfile: slug inexistente lança erro claro", () => {
  const root = tmpRoot();
  assert.throws(() => activateProfile(root, "nao-existe"), /nao-existe/);
});

test("importActiveProfile: seed do .forge/profile.md órfão para profiles/<slug>/ + active.txt", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  fs.writeFileSync(path.join(root, ".forge", "profile.md"), buildProfileMd({ name: "GameAds", niche: "gameads" }), "utf8");
  const slug = importActiveProfile(root);
  assert.equal(slug, "gameads");
  assert.ok(fs.existsSync(path.join(root, "profiles", "gameads", "profile.md")));
  assert.equal(fs.readFileSync(path.join(root, ".forge", "active.txt"), "utf8").trim(), "gameads");
  const list = listProfiles(root);
  assert.equal(list.length, 1);
  assert.equal(list[0].active, true);
});

test("importActiveProfile: idempotente — não sobrescreve profiles/<slug> existente nem duplica", () => {
  const root = tmpRoot();
  writeProfile(root, "gameads", "GameAds", "gameads");
  const original = fs.readFileSync(path.join(root, "profiles", "gameads", "profile.md"), "utf8");
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  // cópia ativa divergiu (editada na mão) — a fonte em profiles/ NÃO deve ser sobrescrita pelo import
  fs.writeFileSync(path.join(root, ".forge", "profile.md"), buildProfileMd({ name: "GameAds", niche: "editado" }), "utf8");
  const slug = importActiveProfile(root);
  assert.equal(slug, "gameads");
  assert.equal(fs.readFileSync(path.join(root, "profiles", "gameads", "profile.md"), "utf8"), original);
  assert.equal(listProfiles(root).length, 1);
});

test("importActiveProfile: dedup por conteúdo — cópia ativa idêntica a slug manual não duplica", () => {
  const root = tmpRoot();
  // biblioteca tem slug manual "anime-arcana" cujo name geraria outro slug
  writeProfile(root, "anime-arcana", "Anime Forge", "anime");
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  fs.copyFileSync(path.join(root, "profiles", "anime-arcana", "profile.md"), path.join(root, ".forge", "profile.md"));
  const slug = importActiveProfile(root);
  assert.equal(slug, "anime-arcana");
  assert.ok(!fs.existsSync(path.join(root, "profiles", "anime-forge")));
  assert.equal(listProfiles(root).length, 1);
});

test("importActiveProfile: sem .forge/profile.md devolve null e não cria nada", () => {
  const root = tmpRoot();
  assert.equal(importActiveProfile(root), null);
  assert.ok(!fs.existsSync(path.join(root, "profiles")));
});

test("loadProfile: limits tem defaults e aceita override raso (merge preserva mapas por job)", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, ".forge"), { recursive: true });
  const md = [
    "# Teste — ProjectProfile",
    "```forge-config",
    JSON.stringify({ name: "Teste", limits: { maxAttemptsPerPlayer: 1, jobMaxTurns: { default: 10 } } }),
    "```",
  ].join("\n");
  fs.writeFileSync(path.join(root, ".forge", "profile.md"), md, "utf8");
  const prof = loadProfile(root);
  assert.equal(prof.limits.maxAttemptsPerPlayer, 1); // override
  assert.equal(prof.limits.jobMaxTurns.default, 10); // override no mapa
  assert.equal(prof.limits.jobMaxTurns["L1/B1"], 50); // default do mapa preservado
  assert.equal(prof.limits.cooldownMs, 60 * 60 * 1000); // default intacto
  assert.deepEqual(prof.limits.deployRetryDelaysMs, [30000, 60000, 120000, 300000]);
});

test("loadProfile: sem bloco limits usa exatamente os defaults antigos", () => {
  const root = tmpRoot();
  const prof = loadProfile(root); // sem .forge/profile.md → só defaults
  assert.equal(prof.limits.maxAttemptsPerPlayer, 3);
  assert.equal(prof.limits.jobTimeoutMs["L0/P0"], 15 * 60 * 1000);
  assert.equal(prof.limits.jobTimeoutMs.default, 30 * 60 * 1000);
  assert.equal(prof.limits.jobMaxTurns["L1/B4"], 40);
});
