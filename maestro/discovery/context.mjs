function untrusted(label, source) {
  return `[NÃO CONFIÁVEL — ${label}${source ? `: ${source}` : ""}]`;
}

function fitUtf8(text, maxBytes) {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let end = Math.min(text.length, maxBytes);
  while (end > 0 && Buffer.byteLength(text.slice(0, end), "utf8") > maxBytes) end--;
  return text.slice(0, end);
}

export function buildCanonicalBrief({ room, thesis = null, evidence = [], experiments = [], maxBytes = 32_000 }) {
  const verified = evidence.filter(item => item.verification?.decision === "verified");
  const evidenceLines = verified.map(item => {
    const marker = item.source ? `${untrusted("evidência externa", item.source)} ` : "";
    return `${marker}${JSON.stringify(item)}`;
  });
  const messageLines = (room?.messages || []).slice(-20).map(item => {
    const marker = item.source || item.refs?.length
      ? `${untrusted("mensagem com referência externa", item.source || item.refs.join(","))} `
      : "";
    return `${marker}${item.author}: ${item.text}`;
  });
  const sections = [
    "# Forge Discovery — contexto canônico",
    thesis ? `## Tese\n${JSON.stringify(thesis)}` : "## Tese\nAinda não promovida.",
    `## Evidências verificadas e contraevidências\n${evidenceLines.join("\n") || "Nenhuma."}`,
    `## Experimentos\n${experiments.map(item => JSON.stringify(item)).join("\n") || "Nenhum."}`,
    `## Últimas mensagens\n${messageLines.join("\n") || "Nenhuma."}`,
  ];
  return fitUtf8(sections.join("\n\n"), Math.max(0, Number(maxBytes) || 0));
}
