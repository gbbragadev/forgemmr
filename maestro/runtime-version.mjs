import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Identifica a versão efetivamente carregada pelo processo Maestro. */
export function runtimeSourceFingerprint(root) {
  const base = path.join(root, "maestro");
  const entries = [];
  function visit(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!["test", "node_modules"].includes(item.name)) visit(path.join(directory, item.name));
        continue;
      }
      if (!item.isFile() || !item.name.endsWith(".mjs")) continue;
      const file = path.join(directory, item.name);
      const stat = fs.statSync(file);
      entries.push(`${path.relative(base, file).replaceAll("\\", "/")}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
    }
  }
  visit(base);
  return crypto.createHash("sha256").update(entries.sort().join("\n")).digest("hex").slice(0, 16);
}
