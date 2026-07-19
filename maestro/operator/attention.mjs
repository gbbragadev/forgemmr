/**
 * Operator AttentionQueue — pure view of what needs Guilherme now.
 * Interface is the test surface: listAttention(snapshot) → items.
 */

const ACTIVE = new Set(["running", "paused_gate", "paused_control", "blocked"]);

/**
 * @typedef {{
 *   id: string,
 *   kind: 'gate'|'stuck'|'rate_limit'|'running'|'p4'|'deploy_fail',
 *   appId: string|null,
 *   title: string,
 *   reason: string,
 *   actionId?: string|null,
 *   scope?: string|null,
 *   priority: number,
 * }} AttentionItem
 */

/**
 * @param {object|null|undefined} snapshot control snapshot
 * @returns {AttentionItem[]}
 */
export function listAttention(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  /** @type {AttentionItem[]} */
  const items = [];
  const pipelines = Array.isArray(snapshot.pipelines) ? snapshot.pipelines : [];
  const decisions = Array.isArray(snapshot.decisions) ? snapshot.decisions : [];
  const actions = Array.isArray(snapshot.actions) ? snapshot.actions : [];

  for (const d of decisions) {
    const appId = d.appId || null;
    const scope = appId ? `pipeline:${appId}` : "factory";
    const gateAction = actions.find(
      (a) =>
        a.id === "gate.decide" &&
        a.scope === scope &&
        a.enabled !== false
    );
    items.push({
      id: `gate:${appId || "factory"}:${d.gateId || "unknown"}`,
      kind: "gate",
      appId,
      title: d.prompt || "Decisão pendente",
      reason: appId
        ? `Gate em ${appId}${d.gateId ? ` · ${d.gateId}` : ""}`
        : "Gate de fábrica",
      actionId: gateAction?.id || "gate.decide",
      scope: gateAction?.scope || scope,
      priority: 0,
    });
  }

  for (const a of actions) {
    if (a.id === "p5.decide" && a.enabled) {
      const appId = a.scope?.startsWith("pipeline:")
        ? a.scope.slice("pipeline:".length)
        : null;
      const id = `p5:${appId || a.scope}`;
      if (items.some((i) => i.id === id)) continue;
      items.push({
        id,
        kind: "p4",
        appId,
        title: a.label || "Decisão P5",
        reason: a.description || "Kill / iterate / scale",
        actionId: a.id,
        scope: a.scope,
        priority: 1,
      });
    }
  }

  for (const p of pipelines) {
    const appId = p.appId;
    if (!appId) continue;
    const status = p.status || "";
    const history = Array.isArray(p.history) ? p.history : [];
    const last = history[history.length - 1];
    const failed =
      last &&
      (last.ok === false ||
        (typeof last.exitCode === "number" && last.exitCode !== 0) ||
        last.errorTail);

    if (status === "blocked") {
      const reason =
        p.blockReason ||
        last?.errorTail ||
        last?.error ||
        "Pipeline bloqueada";
      const kind =
        /rate.?limit|cooldown|429/i.test(String(reason))
          ? "rate_limit"
          : /deploy|wrangler|pages|dns|cname/i.test(String(reason))
            ? "deploy_fail"
            : "stuck";
      items.push({
        id: `${kind}:${appId}`,
        kind,
        appId,
        title: `${appId} bloqueada`,
        reason: String(reason).slice(0, 280),
        actionId: null,
        scope: `pipeline:${appId}`,
        priority: kind === "rate_limit" ? 2 : 1,
      });
      continue;
    }

    if (status === "paused_gate" || status === "paused_control") {
      if (items.some((i) => i.appId === appId && i.kind === "gate")) continue;
      items.push({
        id: `paused:${appId}`,
        kind: "gate",
        appId,
        title: `${appId} pausada`,
        reason:
          status === "paused_gate"
            ? `Aguardando gate${p.currentJob ? ` · ${p.currentJob}` : ""}`
            : "Pausa de controle — continue quando quiser",
        actionId: null,
        scope: `pipeline:${appId}`,
        priority: 0,
      });
      continue;
    }

    if (status === "running") {
      items.push({
        id: `running:${appId}`,
        kind: "running",
        appId,
        title: `${appId} em execução`,
        reason: [p.currentJob, p.currentPlayer].filter(Boolean).join(" · ") ||
          "Job em andamento",
        actionId: null,
        scope: `pipeline:${appId}`,
        priority: 4,
      });
      continue;
    }

    if (failed && !ACTIVE.has(status) && status !== "done") {
      items.push({
        id: `fail:${appId}`,
        kind: "stuck",
        appId,
        title: `${appId} falhou no último job`,
        reason: String(last.errorTail || last.error || "erro").slice(0, 280),
        actionId: null,
        scope: `pipeline:${appId}`,
        priority: 2,
      });
    }
  }

  // de-dupe by id, sort by priority then appId
  const seen = new Set();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        String(a.appId || "").localeCompare(String(b.appId || ""))
    );
}

export function attentionCounts(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    gates: list.filter((i) => i.kind === "gate" || i.kind === "p4").length,
    stuck: list.filter((i) =>
      ["stuck", "rate_limit", "deploy_fail"].includes(i.kind)
    ).length,
    running: list.filter((i) => i.kind === "running").length,
  };
}
