const THESIS_FIELDS = [
  "buyer",
  "user",
  "painfulJob",
  "currentAlternative",
  "reachableSegment",
  "channel",
  "fatalAssumption",
  "offer",
];

const EXPERIMENT_FIELDS = [
  "hypothesis",
  "method",
  "audience",
  "expectedAction",
  "successCriteria",
  "killCriteria",
  "window",
  "costCap",
];

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} inválido`);
  return structuredClone(value);
}

function requireFields(value, fields, label) {
  const copy = requiredObject(value, label);
  for (const field of fields) {
    if (copy[field] === undefined || copy[field] === null || copy[field] === "") {
      throw new Error(`${label}.${field} é obrigatório`);
    }
  }
  return copy;
}

export function normalizeThesisDraft(draft) {
  return requireFields(draft, THESIS_FIELDS, "thesis");
}

export function normalizeEvidence(evidence) {
  const copy = requireFields(
    evidence,
    ["observation", "inference", "validation", "polarity", "source", "date", "sensitivity"],
    "evidence",
  );
  if (!(["pain", "reach", "action", "economic"].includes(copy.validation))) {
    throw new Error("evidence.validation inválido");
  }
  if (!(["supporting", "contradicting"].includes(copy.polarity))) {
    throw new Error("evidence.polarity inválido");
  }
  copy.synthetic = copy.synthetic === true;
  return copy;
}

export function normalizeExperiment(experiment) {
  const copy = requireFields(experiment, EXPERIMENT_FIELDS, "experiment");
  if (!Number.isFinite(copy.costCap) || copy.costCap < 0) throw new Error("experiment.costCap inválido");
  return copy;
}

export function clone(value) {
  return structuredClone(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}
