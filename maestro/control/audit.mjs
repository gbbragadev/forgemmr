import fs from "node:fs";
import path from "node:path";

import { appendPrivateFile, makeRedactor } from "../adapters.mjs";

export function createAuditLog({ root, now = () => Date.now() }) {
  const file = path.join(root, ".control", "audit.jsonl");
  const redact = makeRedactor();

  return {
    file,
    append(event) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const record = { at: new Date(now()).toISOString(), ...event };
      appendPrivateFile(file, `${redact(JSON.stringify(record))}\n`);
      return record;
    },
    read(limit = 200) {
      if (!fs.existsSync(file)) return [];
      return fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-Math.max(0, limit))
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
    },
  };
}
