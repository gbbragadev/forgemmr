import fs from "node:fs";
import path from "node:path";

import { writePrivateFile } from "../adapters.mjs";

const APP_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function readEvents(file) {
  try {
    return fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function createRunEventStore({ root, redact = String, maxEvents = 5_000, now = () => new Date() } = {}) {
  const file = path.join(root, ".control", "run-events.jsonl");
  const loaded = readEvents(file);
  let events = loaded.slice(-maxEvents);
  let sequence = events.reduce((max, event) => Math.max(max, Number(event.sequence) || 0), 0);

  function persist() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writePrivateFile(file, events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
  }

  if (loaded.length > maxEvents) persist();

  return {
    append(input = {}) {
      const appId = input.appId || null;
      const runId = input.runId || "factory";
      if (appId && !APP_ID.test(appId)) throw new Error(`appId inválido: ${appId}`);
      if (!RUN_ID.test(runId)) throw new Error(`runId inválido: ${runId}`);
      const event = Object.freeze({
        type: "run_event",
        sequence: ++sequence,
        timestamp: now().toISOString(),
        runId,
        appId,
        job: input.job || null,
        attempt: Number.isInteger(input.attempt) ? input.attempt : null,
        playerId: input.playerId || null,
        stream: input.stream === "stderr" ? "stderr" : "stdout",
        level: input.level || "info",
        eventType: input.eventType || "log",
        line: String(redact(String(input.line || ""))).slice(0, 8_000),
      });
      events.push(event);
      const pruneThreshold = maxEvents < 100 ? maxEvents : maxEvents + 500;
      if (events.length > pruneThreshold) {
        events = events.slice(-maxEvents);
        persist();
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
        try { fs.chmodSync(file, 0o600); } catch { /* Windows ACLs are managed by the host. */ }
      }
      return event;
    },
    list({ after = 0, runId = null, appId = null, limit = 500 } = {}) {
      return events
        .filter((event) => event.sequence > Number(after || 0))
        .filter((event) => !runId || event.runId === runId)
        .filter((event) => !appId || event.appId === appId)
        .slice(-Math.max(1, Math.min(Number(limit) || 500, 1_000)));
    },
  };
}
