import os from "node:os";
import path from "node:path";

export function resolveMemoryLayout({ env = process.env, platform = process.platform } = {}) {
  const pathApi = platform === "win32" ? path.win32 : path;
  const base = platform === "win32"
    ? env.LOCALAPPDATA || pathApi.join(env.USERPROFILE || os.homedir(), "AppData", "Local")
    : env.XDG_DATA_HOME || pathApi.join(env.HOME || os.homedir(), ".local", "share");
  const home = pathApi.join(base, "ForgeNexus");

  return {
    home,
    runtimeRoot: pathApi.join(home, "runtime"),
    downloadsDir: pathApi.join(home, "downloads"),
    dataDir: pathApi.join(home, "memory"),
    tokenPath: pathApi.join(home, "ai-memory.token"),
    outboxPath: pathApi.join(home, "memory-outbox.jsonl"),
    backupsDir: pathApi.join(home, "backups"),
  };
}
