import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ALLOWED_RELEASE_PREFIX = "/akitaonrails/ai-memory/releases/download/v1.13.0/";

export function loadRuntimeManifest(
  root,
  { platform = process.platform, arch = process.arch } = {},
) {
  const file = path.join(root, "maestro", "memory", "runtime-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error("Manifesto do ai-memory inválido.");
  }

  const key = `${platform}-${arch}`;
  const entry = manifest.platforms?.[key];
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error(`Plataforma do ai-memory não suportada: ${key}`);
  }
  if (
    typeof entry.asset !== "string"
    || path.basename(entry.asset) !== entry.asset
    || typeof entry.binary !== "string"
    || path.basename(entry.binary) !== entry.binary
  ) {
    throw new Error("Entrada de runtime ai-memory inválida.");
  }

  return { manifest, entry, key };
}

export async function verifySha256(file, expected) {
  if (!/^[a-f0-9]{64}$/i.test(expected)) {
    throw new Error("Checksum esperado do runtime ai-memory é inválido.");
  }
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  const actual = hash.digest();
  const wanted = Buffer.from(expected, "hex");
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    throw new Error("Checksum do runtime ai-memory não confere.");
  }
  return expected;
}

export async function downloadToFile(url, target, { fetchImpl = fetch } = {}) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "github.com"
    || !parsed.pathname.startsWith(ALLOWED_RELEASE_PREFIX)
  ) {
    throw new Error("URL do runtime fora da release permitida.");
  }

  const response = await fetchImpl(parsed, {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download do runtime falhou: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body),
    fs.createWriteStream(target, { flags: "wx", mode: 0o600 }),
  );
  return target;
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Extração falhou: exit ${code}`));
    });
  });
}

export async function extractArchive(
  archive,
  target,
  { spawnImpl = spawn, platform = process.platform } = {},
) {
  fs.mkdirSync(target, { recursive: true });
  const command = platform === "win32" ? "tar.exe" : "tar";
  const child = spawnImpl(command, ["-xf", archive, "-C", target], {
    shell: false,
    windowsHide: true,
    stdio: "ignore",
  });
  await waitForChild(child);
}

export async function ensureRuntimeInstalled({
  layout,
  entry,
  version,
  download = (target, url) => downloadToFile(url, target),
  extract = extractArchive,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Versão do runtime ai-memory inválida.");
  }
  if (
    path.basename(entry.asset) !== entry.asset
    || path.basename(entry.binary) !== entry.binary
  ) {
    throw new Error("Entrada de runtime ai-memory inválida.");
  }

  fs.mkdirSync(layout.runtimeRoot, { recursive: true });
  fs.mkdirSync(layout.downloadsDir, { recursive: true });
  const finalDir = path.join(layout.runtimeRoot, version);
  const finalBinary = path.join(finalDir, entry.binary);
  if (fs.existsSync(finalBinary) && fs.statSync(finalBinary).size > 0) {
    return { binaryPath: finalBinary, installed: false };
  }

  const suffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const archive = path.join(layout.downloadsDir, `${entry.asset}.part-${suffix}`);
  const tempDir = `${finalDir}.tmp-${suffix}`;
  try {
    await download(archive, entry.url);
    await verifySha256(archive, entry.sha256);
    await extract(archive, tempDir);
    const candidate = path.join(tempDir, entry.binary);
    if (!fs.existsSync(candidate) || fs.statSync(candidate).size < 1) {
      throw new Error("Binário ai-memory ausente no arquivo verificado.");
    }

    if (fs.existsSync(finalDir)) {
      fs.rmSync(finalDir, { recursive: true, force: true });
    }
    fs.renameSync(tempDir, finalDir);
    return { binaryPath: finalBinary, installed: true };
  } finally {
    fs.rmSync(archive, { force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
