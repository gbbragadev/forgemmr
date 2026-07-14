import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveMemoryLayout } from "../memory/layout.mjs";
import {
  downloadToFile,
  ensureRuntimeInstalled,
  loadRuntimeManifest,
  verifySha256,
} from "../memory/installer.mjs";

test("layout fica fora do checkout e isolado no ForgeNexus", () => {
  const layout = resolveMemoryLayout({
    env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
    platform: "win32",
  });
  assert.equal(
    layout.home,
    path.win32.join("C:\\Users\\me\\AppData\\Local", "ForgeNexus"),
  );
  assert.equal(layout.dataDir, path.win32.join(layout.home, "memory"));
  assert.equal(layout.runtimeRoot, path.win32.join(layout.home, "runtime"));
});

test("manifesto seleciona somente uma plataforma suportada", () => {
  const root = path.resolve(import.meta.dirname, "..", "..");
  const { entry, key, manifest } = loadRuntimeManifest(root, {
    platform: "win32",
    arch: "x64",
  });
  assert.equal(key, "win32-x64");
  assert.equal(manifest.version, "1.13.0");
  assert.equal(entry.binary, "ai-memory.exe");
  assert.throws(
    () => loadRuntimeManifest(root, { platform: "plan9", arch: "mips" }),
    /não suportada/i,
  );
});

test("checksum errado falha antes da extração", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-install-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "asset.zip");
  fs.writeFileSync(file, "not-the-release");
  await assert.rejects(verifySha256(file, "0".repeat(64)), /checksum/i);
});

test("download recusa URL fora da release permitida", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-download-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let fetched = false;
  await assert.rejects(
    downloadToFile("https://example.com/ai-memory.zip", path.join(dir, "asset.zip"), {
      fetchImpl: async () => {
        fetched = true;
      },
    }),
    /release permitida/i,
  );
  assert.equal(fetched, false);
});

test("instalação usa temp, valida e publica binário atomicamente", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-install-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const payload = Buffer.from("fixture-release");
  const digest = crypto.createHash("sha256").update(payload).digest("hex");
  let extractedAfterChecksum = false;

  const result = await ensureRuntimeInstalled({
    layout: {
      runtimeRoot: path.join(dir, "runtime"),
      downloadsDir: path.join(dir, "downloads"),
    },
    entry: {
      asset: "fixture.zip",
      url: "https://example.invalid/fixture.zip",
      sha256: digest,
      binary: "ai-memory.exe",
    },
    version: "1.13.0",
    download: async (target) => fs.writeFileSync(target, payload),
    extract: async (archive, target) => {
      assert.equal(await verifySha256(archive, digest), digest);
      extractedAfterChecksum = true;
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "ai-memory.exe"), "binary");
    },
  });

  assert.equal(fs.readFileSync(result.binaryPath, "utf8"), "binary");
  assert.equal(result.installed, true);
  assert.equal(extractedAfterChecksum, true);
  assert.deepEqual(fs.readdirSync(path.join(dir, "downloads")), []);
});

test("falha não remove uma versão instalada anteriormente", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-memory-install-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const runtimeRoot = path.join(dir, "runtime");
  const previousDir = path.join(runtimeRoot, "1.12.0");
  fs.mkdirSync(previousDir, { recursive: true });
  fs.writeFileSync(path.join(previousDir, "ai-memory.exe"), "previous");

  await assert.rejects(
    ensureRuntimeInstalled({
      layout: { runtimeRoot, downloadsDir: path.join(dir, "downloads") },
      entry: {
        asset: "fixture.zip",
        url: "https://example.invalid/fixture.zip",
        sha256: "0".repeat(64),
        binary: "ai-memory.exe",
      },
      version: "1.13.0",
      download: async (target) => fs.writeFileSync(target, "corrupt"),
      extract: async () => assert.fail("não deve extrair com checksum inválido"),
    }),
    /checksum/i,
  );

  assert.equal(
    fs.readFileSync(path.join(previousDir, "ai-memory.exe"), "utf8"),
    "previous",
  );
});
