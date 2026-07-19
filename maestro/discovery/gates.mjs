function result(required, evidence) {
  const refs = [];
  const found = new Set();
  for (const item of evidence) {
    if (item.verification?.decision !== "verified" || item.synthetic || item.polarity !== "supporting") continue;
    found.add(item.validation);
    if (required.includes(item.validation)) refs.push(item.id);
  }
  const unmet = required.filter(validation => !found.has(validation));
  return { ok: unmet.length === 0, unmet, evidenceRefs: refs };
}

export function evaluateGates(evidence) {
  const e1 = result(["pain", "reach"], evidence);
  const e2 = result(["action"], evidence);
  const e3 = result(["economic"], evidence);
  return {
    e1,
    e2,
    e3,
    build: {
      ok: e1.ok && e2.ok,
      unmet: [...e1.unmet, ...e2.unmet],
      evidenceRefs: [...new Set([...e1.evidenceRefs, ...e2.evidenceRefs])],
    },
  };
}
