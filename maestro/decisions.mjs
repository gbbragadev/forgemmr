import fs from "node:fs";
import path from "node:path";

export function recordDecision({ projectDir, gateId, choice, feedback }) {
  const dir = path.join(projectDir, "decisions");
  fs.mkdirSync(dir, { recursive: true });
  const n = fs.readdirSync(dir).filter((f) => /^\d{3}-.*\.json$/.test(f)).length + 1;
  const seq = String(n).padStart(3, "0");
  const file = path.join(dir, `${seq}-${gateId}.json`);
  fs.writeFileSync(file, JSON.stringify({ seq: n, gateId, choice, feedback: feedback || null, decidedAt: new Date().toISOString() }, null, 2), "utf8");
  return file;
}

export function writeApproval({ projectDir, payload }) {
  const file = path.join(projectDir, "approval.json");
  if (fs.existsSync(file)) return file; // append-only: nunca sobrescreve aprovado
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ status: "approved", approvedAt: new Date().toISOString(), ...payload }, null, 2), "utf8");
  return file;
}
