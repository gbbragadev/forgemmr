import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appendPrivateFile, makeRedactor, writePrivateFile } from "../adapters.mjs";

const PLAYBOOK_IDS = [
  "pressure-test",
  "pain-signal-miner",
  "first-customer-finder",
  "startup-user-simulator",
  "design-audit",
];
const URL_PLAYBOOKS = new Set(["pain-signal-miner", "first-customer-finder"]);
const SYNTHETIC_PLAYBOOKS = new Set(["startup-user-simulator", "design-audit"]);
const POLARITIES = new Set(["supporting", "contradicting"]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeId(value, label) {
  const text = String(value || "");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(`${label} inválido`);
  return text;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} é obrigatório`);
  return value.trim();
}

function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("candidate.url inválida");
  }
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("candidate.url precisa ser http(s)");
  return url.href;
}

function validateOutput(playbookId, output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("output precisa ser objeto JSON");
  if (playbookId === "pressure-test") {
    return {
      hypothesis: requiredString(output.hypothesis, "hypothesis"),
      risk: requiredString(output.risk, "risk"),
    };
  }
  if (URL_PLAYBOOKS.has(playbookId)) {
    if (!Array.isArray(output.candidates)) throw new Error("candidates precisa ser lista");
    return {
      candidates: output.candidates.map((candidate) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("candidate inválido");
        const polarity = candidate.polarity || "supporting";
        if (!POLARITIES.has(polarity)) throw new Error("candidate.polarity inválida");
        const result = {
          url: validateUrl(candidate.url),
          observation: requiredString(candidate.observation, "candidate.observation"),
          inference: requiredString(candidate.inference, "candidate.inference"),
          polarity,
          date: requiredString(candidate.date, "candidate.date"),
        };
        if (playbookId === "first-customer-finder") {
          result.suggestedOpening = requiredString(candidate.suggestedOpening, "candidate.suggestedOpening");
        }
        return result;
      }),
    };
  }
  if (SYNTHETIC_PLAYBOOKS.has(playbookId)) {
    if (!Array.isArray(output.findings)) throw new Error("findings precisa ser lista");
    return {
      findings: output.findings.map((finding) => {
        if (!finding || typeof finding !== "object" || Array.isArray(finding)) throw new Error("finding inválido");
        const polarity = finding.polarity || "supporting";
        if (!POLARITIES.has(polarity)) throw new Error("finding.polarity inválida");
        if (!Number.isFinite(finding.score)) throw new Error("finding.score precisa ser número");
        return {
          observation: requiredString(finding.observation, "finding.observation"),
          inference: requiredString(finding.inference, "finding.inference"),
          polarity,
          score: finding.score,
        };
      }),
    };
  }
  throw new Error(`playbook desconhecido: ${playbookId}`);
}

function privateJson(file, value) {
  writePrivateFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function createPlaybookService({ root, runner, workspace, now = () => new Date(), idFactory = prefix => `${prefix}-${crypto.randomUUID()}` }) {
  const sourceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "playbooks");
  const controlDir = path.join(root, ".control", "discovery", "playbooks");
  const registry = new Map(PLAYBOOK_IDS.map((id) => {
    const file = path.join(sourceDir, `${id}.md`);
    const content = fs.readFileSync(file, "utf8");
    return [id, Object.freeze({ id, file, content, contentHash: sha256(content) })];
  }));

  function get(playbookId) {
    const playbook = registry.get(playbookId);
    if (!playbook) throw new Error(`playbook desconhecido: ${playbookId}`);
    return playbook;
  }

  return {
    list() {
      return [...registry.values()].map(({ id, contentHash }) => ({ id, contentHash }));
    },

    start({ playbookId, thesisId, playerId, input, maxTurns = 20 }) {
      const playbook = get(playbookId);
      safeId(thesisId, "thesisId");
      workspace.getThesis(thesisId);
      const localRunId = safeId(idFactory("playbook-run"), "runId");
      const runDir = path.join(controlDir, "runs", localRunId);
      fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
      const inputFile = path.join(runDir, "input.json");
      const promptFile = path.join(runDir, "prompt.md");
      const outputFile = path.join(runDir, "output.json");
      const rawLogFile = path.join(runDir, "raw.log");
      privateJson(inputFile, { schemaVersion: 1, playbookId, playbookHash: playbook.contentHash, thesisId, input });
      const prompt = [
        playbook.content,
        "",
        `Input file: ${inputFile}`,
        `Write JSON output only to: ${outputFile}`,
        "Do not contact anyone, publish anything, or spend money.",
      ].join("\n");
      writePrivateFile(promptFile, prompt);
      writePrivateFile(outputFile, "");
      writePrivateFile(rawLogFile, "");
      const result = runner.start({ scope: { kind: "playbook", playbookId, thesisId, runDir, localRunId }, playerId, prompt, maxTurns });
      if (!result.ok) return { ...result, localRunId, runDir, playbookId, playbookHash: playbook.contentHash };
      return { ...result, localRunId, runDir, outputFile, playbookId, playbookHash: playbook.contentHash, thesisId };
    },

    appendRawLog({ localRunId, text }) {
      safeId(localRunId, "runId");
      const file = path.join(controlDir, "runs", localRunId, "raw.log");
      const redact = makeRedactor();
      appendPrivateFile(file, redact(String(text)));
    },

    importOutput({ localRunId, thesisId }) {
      safeId(localRunId, "runId");
      safeId(thesisId, "thesisId");
      const runDir = path.join(controlDir, "runs", localRunId);
      const input = JSON.parse(fs.readFileSync(path.join(runDir, "input.json"), "utf8"));
      if (input.thesisId !== thesisId) throw new Error("thesisId não corresponde ao run");
      const playbook = get(input.playbookId);
      if (input.playbookHash !== playbook.contentHash) throw new Error("hash do playbook não corresponde ao conteúdo ativo");
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(runDir, "output.json"), "utf8"));
      } catch (error) {
        throw new Error(`output inválido: ${error.message}`);
      }
      const output = validateOutput(playbook.id, parsed);

      if (playbook.id === "pressure-test") {
        return [workspace.createExperiment({ thesisId, experiment: {
          hypothesis: output.hypothesis,
          method: "pressure-test",
          audience: "internal discovery review",
          expectedAction: "resolve fatal risk",
          successCriteria: "fatal risk addressed with external evidence",
          killCriteria: output.risk,
          window: "before validation",
          costCap: 0,
          risk: output.risk,
          playbookId: playbook.id,
          playbookHash: playbook.contentHash,
          contentHash: playbook.contentHash,
        } })];
      }

      if (URL_PLAYBOOKS.has(playbook.id)) {
        const validation = playbook.id === "pain-signal-miner" ? "pain" : "action";
        return output.candidates.map((candidate) => workspace.recordEvidence({ thesisId, evidence: {
          observation: candidate.observation,
          inference: candidate.inference,
          validation,
          polarity: candidate.polarity,
          source: candidate.url,
          date: candidate.date,
          sensitivity: "public",
          synthetic: false,
          suggestedOpening: candidate.suggestedOpening,
          outreachSent: false,
          playbookId: playbook.id,
          playbookHash: playbook.contentHash,
          contentHash: playbook.contentHash,
        } }));
      }

      return output.findings.map((finding) => workspace.recordEvidence({ thesisId, evidence: {
        observation: finding.observation,
        inference: finding.inference,
        validation: "action",
        polarity: finding.polarity,
        source: `internal://${playbook.id}`,
        date: now().toISOString().slice(0, 10),
        sensitivity: "internal",
        synthetic: true,
        score: finding.score,
        playbookId: playbook.id,
        playbookHash: playbook.contentHash,
        contentHash: playbook.contentHash,
      } }));
    },

    proposeRevision({ playbookId, actor, content, reason }) {
      const playbook = get(playbookId);
      requiredString(actor, "actor");
      requiredString(content, "content");
      requiredString(reason, "reason");
      const proposal = {
        schemaVersion: 1,
        id: safeId(idFactory("playbook-revision"), "proposalId"),
        playbookId,
        activeHash: playbook.contentHash,
        proposedHash: sha256(content),
        content,
        reason,
        actor,
        status: "pending_approval",
        createdAt: now().toISOString(),
      };
      const dir = path.join(controlDir, "revisions", playbookId);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      privateJson(path.join(dir, `${proposal.id}.json`), proposal);
      return structuredClone(proposal);
    },
  };
}
