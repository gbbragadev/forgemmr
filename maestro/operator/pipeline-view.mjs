/**
 * Pure helpers for Run surface — pipeline list ordering + subtitle.
 */

const ACTIVE = new Set(["running", "paused_gate", "paused_control", "blocked"]);

export function isActivePipeline(pipeline) {
  return ACTIVE.has(pipeline?.status);
}

export function pipelineListSubtitle(pipeline) {
  if (pipeline?.currentJob) return String(pipeline.currentJob);
  const idea = String(pipeline?.idea || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!idea) return "sem job atual";
  return idea.length > 72 ? `${idea.slice(0, 69)}…` : idea;
}

export function sortPipelinesForList(pipelines) {
  const list = Array.isArray(pipelines) ? pipelines : [];
  const rank = (p) => (isActivePipeline(p) ? 0 : p.status === "done" ? 2 : 1);
  return [...list].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return String(a.appId || "").localeCompare(String(b.appId || ""));
  });
}

export function pipelineRunModel(snapshot, appId) {
  const pipelines = Array.isArray(snapshot?.pipelines) ? snapshot.pipelines : [];
  const pipeline = pipelines.find((p) => p.appId === appId) || null;
  if (!pipeline) {
    return {
      pipeline: null,
      actions: [],
      decisions: [],
    };
  }
  const scope = `pipeline:${appId}`;
  const actions = (snapshot.actions || []).filter((a) => a.scope === scope);
  const decisions = (snapshot.decisions || []).filter((d) => d.appId === appId);
  return { pipeline, actions, decisions };
}
