const STRING_FIELDS = ["appId", "measuredAt", "why", "channel"];
const NUMBER_FIELDS = [
  "daysLive",
  "visits",
  "activations",
  "ctaClicks",
  "conversions",
  "revenueBrl",
  "apiCostBrl",
];
const VERDICTS = new Set(["kill", "iterate", "scale"]);

/** Valida o contrato mínimo e comparável do resultado P4, sem julgar o mérito. */
export function validateP4Result(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { valid: false, errors: ["resultado inválido"] };
  }

  const errors = [];
  for (const field of STRING_FIELDS) {
    if (typeof result[field] !== "string" || !result[field].trim()) {
      errors.push(`${field} ausente`);
    }
  }
  for (const field of NUMBER_FIELDS) {
    if (typeof result[field] !== "number" || !Number.isFinite(result[field]) || result[field] < 0) {
      errors.push(`${field} inválido`);
    }
  }
  if (!VERDICTS.has(result.verdict)) errors.push("verdict inválido");

  return { valid: errors.length === 0, errors };
}
