import crypto from "node:crypto";
import fs from "node:fs";

import { buildSpawn, makeRedactor } from "./adapters.mjs";

const RESUME_TOKEN = /^[A-Za-z0-9._:-]{8,256}$/;
const MAX_OUTPUT_BYTES = 256_000;

export function createExecutorRunService({
  root,
  rosterPath,
  spawnImpl,
  emit = () => {},
  now = () => new Date(),
  timeoutMs = null,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  let active = null;
  const runs = new Map();

  const roster = () => JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  const publicRun = run => run ? structuredClone({
    id: run.id,
    runId: run.id,
    scope: run.scope,
    playerId: run.playerId,
    executor: run.executor,
    status: run.status,
    pid: run.pid,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    exitCode: run.exitCode,
    error: run.error,
    response: run.response,
    resumeUsed: run.resumeUsed,
  }) : null;

  function finish(run, status, extra = {}) {
    if (run.finalized) return false;
    run.finalized = true;
    if (run.timer) clearTimeoutImpl(run.timer);
    Object.assign(run, { status, endedAt: now().toISOString(), ...extra });
    if (active?.id === run.id) active = null;
    emit("run.finished", publicRun(run));
    return true;
  }

  function resumeArgs(player, token) {
    if (!player.resumeSupported || !RESUME_TOKEN.test(String(token || ""))) return [];
    if (!Array.isArray(player.resumeArgs) || !player.resumeArgs.length) return [];
    const allowed = player.resumeArgs.every(value => typeof value === "string" && value.length <= 100 && !/[\r\n]/.test(value));
    if (!allowed || player.resumeArgs.filter(value => value.includes("{token}")).length !== 1) return [];
    return player.resumeArgs.map(value => value.replace("{token}", token));
  }

  return {
    start({ scope = "factory", playerId, prompt, maxTurns = 30, resumeToken = null }) {
      if (active) return { ok: false, error: "Já existe uma run interativa ativa.", runId: active.id };
      if (!String(prompt || "").trim()) return { ok: false, error: "prompt vazio" };
      const player = roster().players?.find(candidate => candidate.id === playerId);
      if (!player) return { ok: false, error: `player indisponível: ${playerId}` };
      const executor = String(player.adapter || player.cli || player.id).toLowerCase();
      const resume = resumeArgs(player, resumeToken);
      let spec;
      try {
        spec = buildSpawn(executor, prompt, {
          root,
          maxTurns,
          model: player.model,
          effort: player.effort,
        });
        if (resume.length) spec.args.push(...resume);
      } catch (error) {
        return { ok: false, error: makeRedactor()(error.message) };
      }

      const id = `run-${crypto.randomUUID()}`;
      const run = {
        id, scope, playerId, executor, status: "running", pid: null,
        startedAt: now().toISOString(), endedAt: null, exitCode: null,
        error: null, response: "", resumeUsed: resume.length > 0,
        child: null, timer: null, output: "", finalized: false,
      };
      runs.set(id, run);
      active = run;
      const redact = makeRedactor();

      try {
        run.child = spawnImpl(spec.cmd, spec.args, { cwd: root, env: spec.env, shell: false, windowsHide: true });
        run.pid = run.child.pid ?? null;
      } catch (error) {
        finish(run, "error", { error: redact(error.message), exitCode: 1 });
        return { ok: false, error: run.error, runId: id };
      }

      const chunk = (stream, value) => {
        if (run.finalized) return;
        const text = redact(String(value));
        const combined = Buffer.from(`${run.output}${text}`, "utf8");
        run.output = combined.subarray(Math.max(0, combined.length - MAX_OUTPUT_BYTES)).toString("utf8").replace(/^�+/u, "");
        emit("run.chunk", { runId: id, scope, playerId, stream, text });
      };
      run.child.stdout?.on("data", value => chunk("stdout", value));
      run.child.stderr?.on("data", value => chunk("stderr", value));
      run.child.on("error", error => {
        chunk("stderr", error.message);
        finish(run, "error", { error: redact(error.message), exitCode: 1, response: run.output });
      });
      run.child.on("close", code => finish(run, code === 0 ? "done" : "error", {
        exitCode: code,
        error: code === 0 ? null : `executor encerrou com código ${code}`,
        response: run.output,
      }));
      const delay = timeoutMs ?? Math.max(1, Number(maxTurns) || 30) * 60_000;
      run.timer = setTimeoutImpl(() => {
        if (run.finalized) return;
        run.child.kill?.("SIGTERM");
        finish(run, "timeout", { error: "run excedeu o tempo limite", response: run.output });
      }, delay);
      emit("run.started", publicRun(run));
      return { ok: true, runId: id, playerId, executor, pid: run.pid, resumeUsed: run.resumeUsed };
    },

    stop({ runId }) {
      const run = runs.get(runId);
      if (!run || run.finalized) return { ok: false, error: "Run não está ativa." };
      run.child.kill?.("SIGTERM");
      finish(run, "stopped", { error: null, response: run.output });
      return { ok: true, runId };
    },

    snapshot() {
      return { activeRunId: active?.id || null, runs: [...runs.values()].map(publicRun) };
    },
  };
}
