import { attentionCounts, listAttention } from "/operator/attention.mjs";
import {
  isActivePipeline,
  pipelineListSubtitle,
  sortPipelinesForList,
} from "/operator/pipeline-view.mjs";

const API = Object.freeze({
  snapshot: "/api/control/snapshot",
  token: "/api/token",
  confirmations: "/api/control/confirmations",
  execute: "/api/control/actions/execute",
  events: "/api/events",
  memoryStatus: "/api/memory/status",
  memoryOverview: "/api/memory/overview",
  memorySearch: "/api/memory/search",
  memoryBriefing: "/api/memory/briefing",
  memoryImportPreview: "/api/memory/import/preview",
  memoryImportApply: "/api/memory/import/apply",
});

/** Four operator surfaces (big bang UI). Legacy names alias in showSection. */
const SECTION_IDS = ["home", "idea", "run", "factory"];
const SECTION_ALIASES = Object.freeze({
  overview: "home",
  "new-pipeline": "idea",
  pipelines: "run",
  decisions: "home",
  metrics: "factory",
  memory: "factory",
  activity: "factory",
});
const PIPELINE_STEPS = ["L0/P0", "FOUNDATION", "DS-GEN", "L0/P1", "L1/B1", "L1/B2", "L1/B3", "L1/B4", "L1/B5", "SIMULATE", "P3", "P4", "P5"];
const TEAM_ROLES = ["Estrategista", "Engenheiro", "Designer", "QA", "Revisor"];
const CONTROL_MODE_LABELS = Object.freeze({
  full_auto: "Full auto",
  autopilot_to_gate: "Automático até gate",
  guided: "Guiado por fase",
  manual: "Manual por job",
});

function controlModeLabel(mode) {
  return CONTROL_MODE_LABELS[mode] || mode || CONTROL_MODE_LABELS.autopilot_to_gate;
}

const state = {
  snapshot: null,
  token: "",
  activeSection: "home",
  factoryTab: "setup",
  selectedAppId: null,
  currentAction: null,
  eventSource: null,
  events: [],
  refreshTimer: null,
  noticeTimer: null,
  memory: {
    project: "factory",
    type: "all",
    status: null,
    overview: null,
    briefing: null,
    query: "",
    results: [],
    importPreview: [],
    loading: false,
    error: null,
    pipelines: {},
  },
};

const byId = (id) => document.getElementById(id);

function element(tag, { className = "", text = null, attrs = {}, dataset = {} } = {}, children = []) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== null && text !== undefined) item.textContent = String(text);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) item.setAttribute(name, "");
    else item.setAttribute(name, String(value));
  }
  for (const [name, value] of Object.entries(dataset)) item.dataset[name] = String(value);
  const list = Array.isArray(children) ? children : [children];
  for (const child of list.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    item.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return item;
}

function clear(target) {
  target.replaceChildren();
  return target;
}

function formatDate(value, { timeOnly = false } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", timeOnly
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("pt-BR", options).format(number);
}

function humanStatus(status) {
  return ({
    running: "em execução",
    paused_gate: "aguardando decisão",
    paused_control: "pausa de controle",
    blocked: "bloqueada",
    done: "concluída",
    killed: "encerrada",
    error: "com erro",
    idle: "ociosa",
    succeeded: "concluída",
    failed: "falhou",
    pending: "pendente",
  })[status] || status || "desconhecido";
}

function statusTone(status) {
  if (["done", "succeeded", "online"].includes(status)) return "success";
  if (["paused_gate", "paused_control", "pending", "running"].includes(status)) return "warning";
  if (["blocked", "killed", "error", "failed", "offline"].includes(status)) return "danger";
  return "neutral";
}

function badge(text, tone = "neutral") {
  return element("span", { className: "status-badge", text, dataset: { tone } });
}

function riskBadge(risk) {
  const label = ({ safe: "segura", guarded: "com atenção", external: "efeito externo", destructive: "destrutiva" })[risk] || risk;
  return element("span", { className: "risk-badge", text: label, dataset: { risk } });
}

function notify(message, { error = false } = {}) {
  const target = byId("global-message");
  target.textContent = String(message);
  target.classList.toggle("is-error", error);
  target.classList.add("is-visible");
  clearTimeout(state.noticeTimer);
  state.noticeTimer = setTimeout(() => target.classList.remove("is-visible"), 4200);
}

function emptyState(title, copy, action = null) {
  const wrapper = element("div", { className: "empty-state" }, [
    element("span", { className: "empty-mark", text: "—", attrs: { "aria-hidden": "true" } }),
    element("h3", { text: title }),
    element("p", { text: copy }),
  ]);
  if (action) wrapper.append(action);
  return wrapper;
}

function setConnection(online, label = null) {
  const dot = byId("connection-dot");
  dot.classList.toggle("is-online", online);
  dot.classList.toggle("is-offline", !online);
  byId("connection-label").textContent = label || (online ? "Nexus online" : "Nexus indisponível");
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(payload.error || payload.message || `Falha HTTP ${response.status}`);
    failure.status = response.status;
    failure.code = payload.code;
    failure.details = payload.details;
    throw failure;
  }
  return payload;
}

async function loadToken() {
  if (state.token) return state.token;
  const response = await fetch(API.token, { credentials: "same-origin" });
  const payload = await readResponse(response);
  state.token = payload.token;
  return state.token;
}

async function postJson(path, body) {
  const token = await loadToken();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Maestro-Token": token },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function getJson(path) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  return readResponse(response);
}

async function loadSnapshot({ quiet = false } = {}) {
  const errorBanner = byId("error-banner");
  try {
    const response = await fetch(API.snapshot, { credentials: "same-origin", cache: "no-store" });
    state.snapshot = await readResponse(response);
    if (!state.selectedAppId || !state.snapshot.pipelines.some((pipeline) => pipeline.appId === state.selectedAppId)) {
      state.selectedAppId = state.snapshot.pipelines[0]?.appId || null;
    }
    errorBanner.hidden = true;
    setConnection(true);
    byId("state-version").textContent = `estado ${state.snapshot.version}`;
    renderAll();
    if (
      (state.activeSection === "factory" && state.factoryTab === "memory") &&
      !state.memory.loading
    ) {
      void loadMemoryOverview({ quiet: true });
    }
    if (!quiet) notify("Central atualizada.");
    return state.snapshot;
  } catch (error) {
    setConnection(false);
    byId("error-detail").textContent = error.message;
    errorBanner.hidden = false;
    if (!state.snapshot) renderUnavailable();
    throw error;
  }
}

function renderUnavailable() {
  for (const id of ["home-content", "idea-content", "run-content", "factory-setup"]) {
    const target = byId(id);
    if (target) clear(target).append(emptyState("Nexus indisponível", "Abra a central pelo atalho do Forge e tente novamente."));
  }
}

function findAction(actionId, scope) {
  return state.snapshot?.actions.find((action) => action.id === actionId && action.scope === scope) || null;
}

function appIdFromScope(scope) {
  return scope?.startsWith("pipeline:") ? scope.slice("pipeline:".length) : null;
}

function actionButton(action, label = null) {
  const button = element("button", {
    className: action.risk === "destructive" ? "button button-danger" : "button button-secondary",
    text: label || action.label,
    attrs: { type: "button", disabled: !action.enabled, title: action.enabled ? action.expectedEffect : action.blockedReason },
  });
  button.addEventListener("click", () => openAction(action.id, action.scope));
  return button;
}

function actionCard(action) {
  const copy = element("div", { className: "item-copy" }, [
    element("div", { className: "card-actions" }, [riskBadge(action.risk), badge(action.enabled ? "disponível" : "bloqueada", action.enabled ? "success" : "danger")]),
    element("h4", { text: action.label }),
    element("p", { text: action.enabled ? action.description : action.blockedReason }),
  ]);
  return element("div", { className: `action-card${action.enabled ? "" : " is-blocked"}` }, [copy, actionButton(action)]);
}

function renderOverview() {
  renderHome();
}

function renderHome() {
  const snapshot = state.snapshot;
  const target = clear(byId("home-content"));
  if (!target) return;
  target.classList.remove("loading-grid");
  target.setAttribute("aria-busy", "false");

  const items = listAttention(snapshot);
  const counts = attentionCounts(items);
  const installed = (snapshot.providers || []).filter((p) => p.installed !== false).length;

  const kpis = element("div", { className: "kpi-strip" }, [
    kpi("Pedem você", counts.gates + counts.stuck, counts.total ? "na fila de atenção" : "fila limpa"),
    kpi("Rodando", counts.running, "ao vivo agora"),
    kpi("Pipelines", (snapshot.pipelines || []).length, "registradas"),
    kpi("Providers", installed, `${(snapshot.providers || []).length} conhecidos`),
  ]);

  const attentionList = items.length
    ? element(
        "div",
        { className: "attention-list" },
        items.map((item) => attentionCard(item))
      )
    : emptyState(
        "Nada pedindo você",
        "A fábrica está calma. Lance uma ideia ou abra Run para acompanhar.",
        (() => {
          const b = element("button", {
            className: "button button-primary",
            text: "Nova ideia",
            attrs: { type: "button" },
          });
          b.addEventListener("click", () => showSection("idea"));
          return b;
        })()
      );

  const decisionActions = (snapshot.actions || []).filter(
    (action) => action.id === "gate.decide" || (action.id === "p5.decide" && action.enabled)
  );
  const decisionBlock =
    decisionActions.length > 0
      ? element("div", { className: "panel" }, [
          panelHeader("Decidir agora", `${decisionActions.length} ação(ões)`),
          element(
            "div",
            { className: "panel-body decision-grid" },
            decisionActions.map((action) => {
              const appId = appIdFromScope(action.scope);
              return element("article", { className: "decision-card" }, [
                element("div", { className: "card-actions" }, [
                  badge(appId || "fábrica", "warning"),
                  riskBadge(action.risk),
                ]),
                element("h3", { text: action.label }),
                element("p", { text: action.description }),
                renderDecisionContext(action, appId),
                actionButton(action, "Revisar e decidir"),
              ]);
            })
          ),
        ])
      : null;

  target.append(
    kpis,
    element("div", { className: "panel" }, [
      panelHeader("Fila de atenção", `${counts.total} item(ns)`),
      element("div", { className: "panel-body" }, [attentionList]),
    ]),
    decisionBlock
  );
}

function attentionCard(item) {
  const tone =
    item.kind === "gate" || item.kind === "p4"
      ? "warning"
      : item.kind === "running"
        ? "success"
        : "danger";
  const openRun = element("button", {
    className: "button button-secondary",
    text: item.appId ? "Abrir Run" : "Ver",
    attrs: { type: "button" },
  });
  openRun.addEventListener("click", () => {
    if (item.appId) state.selectedAppId = item.appId;
    showSection("run");
  });
  const actions = [openRun];
  if (item.actionId && item.scope) {
    const action = findAction(item.actionId, item.scope);
    if (action) actions.unshift(actionButton(action, "Decidir"));
  }
  return element("div", { className: `attention-card kind-${item.kind}` }, [
    element("div", { className: "item-copy" }, [
      element("div", { className: "card-actions" }, [badge(item.kind, tone)]),
      element("strong", { text: item.title }),
      element("span", { text: item.reason }),
    ]),
    element("div", { className: "card-actions" }, actions),
  ]);
}

function kpi(label, value, note) {
  return element("div", { className: "kpi" }, [
    element("span", { className: "kpi-label", text: label }),
    element("strong", { className: "kpi-value", text: value }),
    element("span", { className: "kpi-note", text: note }),
  ]);
}

function panelHeader(title, meta = "") {
  return element("header", { className: "panel-header" }, [element("h3", { text: title }), element("span", { text: meta })]);
}

function pipelineSummary(pipeline) {
  const open = element("button", { className: "button button-secondary", text: "Abrir", attrs: { type: "button" } });
  open.addEventListener("click", () => {
    state.selectedAppId = pipeline.appId;
    showSection("run");
  });
  return element("div", { className: "stack-item" }, [
    element("div", { className: "item-copy" }, [
      element("strong", { text: pipeline.appId }),
      element("span", { text: `${humanStatus(pipeline.status)} · ${pipeline.currentJob || "sem job atual"}` }),
    ]),
    element("div", { className: "card-actions" }, [badge(humanStatus(pipeline.status), statusTone(pipeline.status)), open]),
  ]);
}

function renderNewPipeline() {
  renderIdea();
}

function renderIdea() {
  const target = clear(byId("idea-content"));
  if (!target) return;
  const action = findAction("pipeline.start", "factory");
  if (!action) {
    target.append(emptyState("Criação indisponível", "O catálogo não ofereceu uma ação segura para iniciar pipelines."));
    return;
  }

  const form = element("form", { className: "wizard-main", attrs: { id: "pipeline-wizard" } }, [
    element("h3", { text: "Descreva a aposta" }),
    element("p", { text: "A fábrica monta o caminho e para só nos gates que precisam de você." }),
    element("div", { className: "form-fields" }, action.fields.map((field) => renderActionField(field))),
    element("div", { className: "form-actions" }, [
      element("button", { className: "button button-primary", text: "Iniciar pipeline", attrs: { type: "submit", disabled: !action.enabled } }),
    ]),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await executeAction(action, collectFormInput(form, action));
      form.reset();
      showSection("run");
    } catch (error) {
      notify(error.message, { error: true });
    } finally {
      submit.disabled = false;
    }
  });

  const rail = element("aside", { className: "panel wizard-rail" }, [
    element("span", { className: "eyebrow", text: "FLUXO" }),
    element("ol", { className: "wizard-steps" }, [
      wizardStep("01", "Ideia", true),
      wizardStep("02", "Time e modo"),
      wizardStep("03", "Run ao vivo"),
      wizardStep("04", "Gates com você"),
    ]),
  ]);
  target.append(element("div", { className: "wizard-layout" }, [rail, element("div", { className: "panel" }, [form])]));
}

function wizardStep(index, label, current = false) {
  return element("li", { className: `wizard-step${current ? " is-current" : ""}` }, [element("span", { text: index }), element("span", { text: label })]);
}

function renderPipelines() {
  renderRun();
}

function renderRun() {
  const target = clear(byId("run-content"));
  if (!target) return;
  const pipelines = sortPipelinesForList(state.snapshot.pipelines || []);
  if (!pipelines.length) {
    const create = element("button", { className: "button button-primary", text: "Criar primeira pipeline", attrs: { type: "button" } });
    create.addEventListener("click", () => showSection("idea"));
    target.append(emptyState("Nenhuma pipeline registrada", "Comece por uma ideia; o Run acompanha daqui.", create));
    return;
  }

  const selectedExisting = pipelines.find((pipeline) => pipeline.appId === state.selectedAppId);
  const selected = selectedExisting || pipelines.find(isActivePipeline) || pipelines[0];
  state.selectedAppId = selected.appId;

  const active = pipelines.filter(isActivePipeline);
  const rest = pipelines.filter((pipeline) => !isActivePipeline(pipeline));

  const makeRow = (pipeline) => {
    const row = element("button", {
      className: `pipeline-row${pipeline.appId === selected.appId ? " is-selected" : ""}${isActivePipeline(pipeline) ? " is-active" : ""}`,
      attrs: { type: "button", "aria-pressed": pipeline.appId === selected.appId },
    }, [
      element("div", { className: "pipeline-row-copy" }, [
        element("strong", { text: pipeline.appId }),
        element("span", { text: pipelineListSubtitle(pipeline) }),
      ]),
      badge(humanStatus(pipeline.status), statusTone(pipeline.status)),
    ]);
    row.addEventListener("click", () => {
      state.selectedAppId = pipeline.appId;
      renderRun();
    });
    return row;
  };

  const listChildren = [];
  if (active.length) {
    listChildren.push(element("div", { className: "pipeline-list-label", text: `Em atenção · ${active.length}` }));
    listChildren.push(...active.map(makeRow));
  }
  if (rest.length) {
    listChildren.push(element("div", { className: "pipeline-list-label", text: `Arquivo · ${rest.length}` }));
    listChildren.push(...rest.map(makeRow));
  }

  const list = element("div", { className: "panel pipeline-list", attrs: { "aria-label": "Lista de pipelines" } }, listChildren);
  target.append(element("div", { className: "pipelines-layout" }, [list, renderPipelineDetail(selected)]));
}

function renderPipelineDetail(pipeline) {
  const actions = state.snapshot.actions.filter((action) => action.scope === `pipeline:${pipeline.appId}`);
  const history = Array.isArray(pipeline.history) ? pipeline.history : [];
  const completedJobs = new Set(history.filter((item) => item.ok || item.exitCode === 0).map((item) => item.job));
  const timeline = element("div", { className: "timeline", attrs: { "aria-label": "Progresso P0 a P5" } }, PIPELINE_STEPS.map((step) => {
    const current = pipeline.currentJob === step;
    return element("div", { className: `timeline-step${completedJobs.has(step) ? " is-done" : ""}${current ? " is-current" : ""}` }, [
      element("span", { className: "timeline-dot", attrs: { "aria-hidden": "true" } }),
      element("span", { text: step }),
    ]);
  }));

  const latestError = [...history].reverse().find((item) => item.errorTail)?.errorTail;
  const actionList = actions.length
    ? element("div", { className: "action-list" }, actions.map(actionCard))
    : emptyState("Sem ações neste estado", "O catálogo será atualizado quando a pipeline mudar.");
  const detail = element("div", { className: "panel pipeline-detail" }, [
    element("header", { className: "pipeline-hero" }, [
      element("div", {}, [
        element("span", { className: "eyebrow", text: controlModeLabel(pipeline.controlMode) }),
        element("h3", { text: pipeline.appId }),
        element("span", {
          className: "meta-line meta-line-clamp",
          text: pipeline.idea || "Ideia não informada",
          attrs: { title: pipeline.idea || "" },
        }),
      ]),
      badge(humanStatus(pipeline.status), statusTone(pipeline.status)),
    ]),
    timeline,
    element("div", { className: "detail-grid" }, [
      element("article", { className: "card" }, [
        element("h3", { text: "Estado atual" }),
        element("p", { text: `Job: ${pipeline.currentJob || "nenhum"}` }),
        element("p", { text: `Target: ${pipeline.deploy?.target || pipeline.target || "automático"}` }),
        element("p", { text: `Modo: ${controlModeLabel(pipeline.controlMode)}` }),
      ]),
      element("article", { className: "card" }, [
        element("h3", { text: latestError ? "Erro recente" : "Saúde da execução" }),
        element("p", { text: latestError || "Nenhum erro recente foi registrado." }),
      ]),
      renderRunConsole(pipeline),
      element("article", { className: "card card-wide" }, [element("h3", { text: "Ações válidas agora" }), actionList]),
      renderPipelineMemory(pipeline),
    ]),
  ]);
  return detail;
}

function renderRunConsole(pipeline) {
  const events = state.events
    .filter((event) => event.appId === pipeline.appId)
    .filter((event) => !pipeline.runId || !event.runId || event.runId === pipeline.runId)
    .slice(-200);
  const last = events.at(-1);
  const elapsed = pipeline.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(pipeline.startedAt).getTime()) / 1000))
    : null;
  const summary = [
    pipeline.currentPlayer || last?.playerId || "agente aguardando",
    pipeline.currentJob || last?.job || "sem fase ativa",
    elapsed === null ? null : `${elapsed}s`,
  ].filter(Boolean).join(" · ");
  const progress = events.filter((event) => event.eventType !== "raw").slice(-40);
  const rows = progress.length
    ? progress.map((event) => element("div", { className: "run-console-line" }, [
        element("time", { text: formatDate(event.timestamp || event.receivedAt, { timeOnly: true }) }),
        element("span", { className: "run-console-meta", text: [event.job, event.playerId, event.attempt ? `t${event.attempt}` : null].filter(Boolean).join(" · ") }),
        element("span", { text: event.line || event.message || eventSummary(event) }),
      ]))
    : [element("p", { className: "run-console-empty", text: pipeline.status === "running" ? "Agente em execução; aguardando a próxima saída…" : "Nenhum evento registrado para esta run." })];
  const raw = element("details", { className: "run-console-raw" }, [
    element("summary", { text: "Saída completa" }),
    element("pre", { text: events.map((event) => event.line || event.message || "").filter(Boolean).join("\n") || "Sem stdout/stderr persistido." }),
  ]);
  return element("article", { className: "card card-wide run-console" }, [
    element("div", { className: "run-console-head" }, [
      element("div", {}, [element("h3", { text: "Progresso ao vivo" }), element("p", { text: summary })]),
      badge(state.eventSource ? "SSE conectado" : "reconectando", state.eventSource ? "success" : "warning"),
    ]),
    element("div", { className: "run-console-stream", attrs: { "aria-live": "polite" } }, rows),
    raw,
  ]);
}

function renderPipelineMemory(pipeline) {
  const context = state.memory.pipelines[pipeline.appId];
  const previousRefs = [...(pipeline.history || [])].reverse().find((item) => item.memoryRefs?.length)?.memoryRefs || [];
  const openMemory = element("button", { className: "button button-secondary", text: "Abrir memória do app", attrs: { type: "button" } });
  openMemory.addEventListener("click", () => {
    state.memory.project = `app-${pipeline.appId}`;
    state.factoryTab = "memory";
    showSection("factory");
    void loadMemoryOverview();
  });
  const promote = findAction("memory.rule.write", "factory");

  if (!context) {
    const load = element("button", { className: "button button-secondary", text: "Carregar contexto", attrs: { type: "button" } });
    load.addEventListener("click", () => loadPipelineMemory(pipeline.appId));
    return element("article", { className: "card card-wide memory-context" }, [
      element("h3", { text: "Memória desta pipeline" }),
      element("p", { text: previousRefs.length
        ? `${previousRefs.length} memória(s) sustentaram o último briefing.`
        : "Carregue o contexto que o próximo job receberá." }),
      element("div", { className: "card-actions" }, [load, openMemory]),
    ]);
  }

  if (context.loading) {
    return element("article", { className: "card card-wide memory-context" }, [
      element("h3", { text: "Memória desta pipeline" }),
      element("p", { text: "Montando briefing seguro…" }),
    ]);
  }

  const upcoming = context.briefing?.items || [];
  const health = context.overview?.memory_health || {};
  const warnings = [
    Number(health.stale_count || 0) ? `${health.stale_count} antiga(s)` : null,
    Number(health.duplicate_count || 0) ? `${health.duplicate_count} duplicada(s)` : null,
    Number(health.orphan_count || 0) ? `${health.orphan_count} sem vínculo` : null,
  ].filter(Boolean);
  const refs = previousRefs.length ? previousRefs : upcoming;
  const promoteButton = promote
    ? element("button", { className: "button button-secondary", text: "Promover regra", attrs: { type: "button", disabled: !promote.enabled } })
    : null;
  if (promoteButton) promoteButton.addEventListener("click", () => openAction(promote.id, promote.scope, { appId: pipeline.appId }));
  const body = refs.length
    ? element("div", { className: "memory-result-list" }, refs.slice(0, 6).map((item) => memorySourceRow(item, `app-${pipeline.appId}`)))
    : emptyState("Sem contexto recuperado", "O próximo job seguirá sem briefing até existir memória relevante.");
  return element("article", { className: "card card-wide memory-context" }, [
    element("div", { className: "card-actions" }, [
      element("h3", { text: previousRefs.length ? "Memórias do último briefing" : "Briefing do próximo job" }),
      warnings.length ? badge(warnings.join(" · "), "warning") : badge("contexto saudável", "success"),
    ]),
    body,
    element("div", { className: "card-actions" }, [
      openMemory,
      promoteButton,
    ]),
  ]);
}

async function loadPipelineMemory(appId) {
  state.memory.pipelines[appId] = { loading: true };
  renderRun();
  const project = `app-${appId}`;
  try {
    const [overview, briefing] = await Promise.all([
      getJson(`${API.memoryOverview}?project=${encodeURIComponent(project)}`),
      getJson(`${API.memoryBriefing}?project=${encodeURIComponent(project)}`),
    ]);
    state.memory.pipelines[appId] = { loading: false, overview, briefing };
  } catch (error) {
    state.memory.pipelines[appId] = { loading: false, error: error.message, overview: null, briefing: { items: [], text: "" } };
  }
  renderRun();
}

function renderDecisions() {
  /* Gates live on Home + Run; keep function for tests and call sites. */
  renderHome();
}

function renderDecisionContext(action, appId) {
  if (action.id !== "gate.decide") return null;
  const gateId = action.fields?.find((field) => field.name === "gateId")?.options?.[0];
  const decision = state.snapshot.decisions.find((item) => item.appId === appId && (!gateId || item.gateId === gateId));
  const payload = decision?.payload;
  if (!payload) return null;

  if (typeof payload === "string" && payload.startsWith("proposals:")) {
    const payloadApp = payload.slice("proposals:".length);
    const safeApp = /^[a-z0-9-]+$/.test(payloadApp) ? payloadApp : appId;
    return element("div", { className: "decision-context" }, [
      element("h4", { text: "Propostas visuais" }),
      element("div", { className: "proposal-grid" }, [1, 2, 3].map((number) => element("figure", {}, [
        element("iframe", {
          className: "proposal-frame",
          attrs: { src: `/proposals/${safeApp}/proposal-${number}.html`, title: `Proposta visual ${number}`, loading: "lazy" },
        }),
        element("figcaption", { text: `Proposta ${number}` }),
      ]))),
    ]);
  }

  if (typeof payload === "string" && payload.startsWith("preview:")) {
    const payloadApp = payload.slice("preview:".length);
    const safeApp = /^[a-z0-9-]+$/.test(payloadApp) ? payloadApp : appId;
    return element("div", { className: "decision-context" }, [
      element("h4", { text: "Preview do produto" }),
      element("iframe", { className: "preview-frame", attrs: { src: `/preview/${safeApp}/`, title: `Preview de ${safeApp}`, loading: "lazy" } }),
    ]);
  }

  if (typeof payload === "string" && payload.startsWith("deploy:")) {
    return element("div", { className: "decision-context" }, [
      element("h4", { text: "Destino preparado" }),
      element("p", { text: payload.slice("deploy:".length) || "Target não informado" }),
    ]);
  }

  if (typeof payload === "string" && payload.endsWith(".md") && !payload.includes("..") && /^[a-zA-Z0-9._/-]+$/.test(payload)) {
    const href = `/${payload.split("/").map(encodeURIComponent).join("/")}`;
    return element("div", { className: "decision-context" }, [
      element("h4", { text: "Documento para revisão" }),
      element("a", { className: "button button-secondary document-link", text: "Abrir documento", attrs: { href, target: "_blank", rel: "noopener" } }),
    ]);
  }

  if (typeof payload === "object") {
    return element("dl", { className: "decision-context context-list" }, Object.entries(payload).slice(0, 12).map(([key, value]) => [
      element("dt", { text: key }),
      element("dd", { text: typeof value === "string" ? value : JSON.stringify(value) }),
    ]));
  }

  return element("div", { className: "decision-context" }, [element("p", { text: String(payload) })]);
}

function renderFactory() {
  const setup = clear(byId("factory-setup"));
  if (!setup) return;
  const snapshot = state.snapshot;
  const factoryActions = snapshot.actions.filter((action) => action.scope === "factory" && action.id !== "pipeline.start");
  const providers = snapshot.providers.length
    ? element("div", { className: "provider-list" }, snapshot.providers.map((provider) => element("div", { className: "provider-item" }, [
        element("div", { className: "item-copy" }, [
          element("strong", { text: provider.id || provider.name }),
          element("span", { text: `${provider.cli || "CLI"} · ${(provider.models || []).map((model) => model.label || model.id).join(", ") || provider.model || "modelo padrão"}` }),
        ]),
        badge(provider.installed === false ? "indisponível" : "pronto", provider.installed === false ? "danger" : "success"),
      ])))
    : emptyState("Sem providers", "Atualize o diagnóstico local para conferir as CLIs.");
  const profiles = snapshot.profiles.length
    ? element("div", { className: "stack-list" }, snapshot.profiles.map((profile) => element("div", { className: "stack-item" }, [
        element("div", { className: "item-copy" }, [element("strong", { text: profile.name || profile.slug }), element("span", { text: profile.slug })]),
        profile.active ? badge("ativo", "success") : badge("disponível"),
      ])))
    : emptyState("Sem profiles", "Crie uma configuração reutilizável para nicho e deploy.");
  const teams = snapshot.teams.length
    ? element("div", { className: "stack-list" }, snapshot.teams.map((team) => element("div", { className: "stack-item" }, [
        element("div", { className: "item-copy" }, [element("strong", { text: team.label || team.id }), element("span", { text: `${Object.keys(team.dispatch || {}).length} rotas · ${team.fallbackPolicy === "strict" ? "estrito, sem troca de provider" : "fallback permitido"}` })]),
        badge(team.id),
      ])))
    : emptyState("Sem times", "Monte um time com providers, modelos e papéis.");
  const blueprints = snapshot.blueprints.length
    ? element("div", { className: "stack-list" }, snapshot.blueprints.map((blueprint) => element("div", { className: "stack-item" }, [
        element("div", { className: "item-copy" }, [
          element("strong", { text: blueprint.title || blueprint.name }),
          element("span", { text: blueprint.id === "generic"
            ? "pipeline padrão herdável"
            : `${blueprint.versions?.length || (blueprint.legacy ? 0 : 1)} versão(ões) · ${blueprint.purpose || `${blueprint.jobs?.length || 0} jobs`}` }),
          blueprint.derivedFrom ? element("small", { text: `derivado de ${blueprint.derivedFrom.blueprintId}@${blueprint.derivedFrom.version}` }) : null,
        ]),
        badge(blueprint.archived ? "arquivado" : blueprint.activeVersion || blueprint.id, blueprint.archived ? "danger" : "neutral"),
      ])))
    : emptyState("Sem blueprints", "A pipeline genérica permanece disponível.");

  setup.append(element("div", { className: "factory-grid" }, [
    factoryCard("Providers", `${snapshot.providers.length} integrações conhecidas`, providers),
    factoryCard("Profiles", `${snapshot.profiles.length} configurações`, profiles),
    factoryCard("Times", `${snapshot.teams.length} composições`, teams),
    factoryCard("Blueprints", `${snapshot.blueprints.length} caminhos`, blueprints),
    element("article", { className: "panel card-wide" }, [panelHeader("Ações da fábrica", "catálogo allowlisted"), element("div", { className: "panel-body action-list" }, factoryActions.map(actionCard))]),
  ]));

  renderMetrics();
  renderMemory();
  renderActivity();
  applyFactoryTab();
}

function applyFactoryTab() {
  const tab = state.factoryTab || "setup";
  const map = {
    setup: "factory-setup",
    metrics: "metrics-content",
    memory: "memory-content",
    activity: "activity-content",
  };
  for (const [key, id] of Object.entries(map)) {
    const el = byId(id);
    if (el) el.hidden = key !== tab;
  }
  document.querySelectorAll("[data-factory-tab]").forEach((button) => {
    const active = button.dataset.factoryTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (tab === "memory" && state.snapshot && !state.memory.loading) void loadMemoryOverview({ quiet: true });
}

function factoryCard(title, meta, content) {
  return element("article", { className: "panel factory-card" }, [panelHeader(title, meta), element("div", { className: "panel-body" }, [content])]);
}

function renderMetrics() {
  const target = clear(byId("metrics-content"));
  const lifecycle = state.snapshot.lifecycle || [];
  const p4 = lifecycle.filter((entry) => entry.p4).map((entry) => entry.p4);
  const totals = p4.reduce((sum, item) => ({
    visits: sum.visits + Number(item.visits || 0),
    activations: sum.activations + Number(item.activations || 0),
    conversions: sum.conversions + Number(item.conversions || 0),
    revenue: sum.revenue + Number(item.revenueBrl || 0),
    cost: sum.cost + Number(item.apiCostBrl || 0),
  }), { visits: 0, activations: 0, conversions: 0, revenue: 0, cost: 0 });
  const activationRate = totals.visits ? (totals.activations / totals.visits) * 100 : 0;
  const decisionCounts = lifecycle.reduce((sum, entry) => {
    const decision = entry.p5?.decision || entry.decision;
    if (decision && Object.hasOwn(sum, decision)) sum[decision] += 1;
    return sum;
  }, { kill: 0, iterate: 0, scale: 0 });

  target.append(element("div", { className: "metrics-grid" }, [
    metricCard("Receita medida", formatNumber(totals.revenue, { style: "currency", currency: "BRL" }), `${p4.length} medições P4`),
    metricCard("Custo de API", formatNumber(totals.cost, { style: "currency", currency: "BRL" }), "somente dados registrados"),
    metricCard("Ativação", `${formatNumber(activationRate, { maximumFractionDigits: 1 })}%`, `${totals.activations} de ${totals.visits} visitas`),
    metricCard("Conversões", totals.conversions, "não estimado"),
    element("article", { className: "panel metric-card card-wide" }, [
      panelHeader("Decisões P5", `${lifecycle.length} apps no lifecycle`),
      element("div", { className: "panel-body kpi-strip" }, [
        kpi("Matar", decisionCounts.kill, "apostas aposentadas"),
        kpi("Iterar", decisionCounts.iterate, "novos ciclos"),
        kpi("Escalar", decisionCounts.scale, "sinais positivos"),
        kpi("Sem decisão", Math.max(0, lifecycle.length - decisionCounts.kill - decisionCounts.iterate - decisionCounts.scale), "aguardando P5"),
      ]),
    ]),
    element("article", { className: "panel card-wide" }, [
      panelHeader("Medição por produto", "P4 e P5"),
      element("div", { className: "panel-body lifecycle-list" }, lifecycle.length
        ? lifecycle.map((entry) => lifecycleRow(entry))
        : [emptyState("Nenhum dado de produto", "Quando um app chegar ao pós-ship, registre P4 pela ação disponível na pipeline.")]),
    ]),
  ]));
}

function metricCard(title, value, note) {
  return element("article", { className: "panel metric-card" }, [
    panelHeader(title, "real"),
    element("div", { className: "panel-body" }, [element("strong", { className: "metric-value", text: value }), element("p", { className: "meta-line", text: note })]),
  ]);
}

function lifecycleRow(entry) {
  const decision = entry.p5?.decision || entry.decision || "sem P5";
  return element("div", { className: "lifecycle-item" }, [
    element("div", { className: "item-copy" }, [
      element("strong", { text: entry.appId }),
      element("span", { text: entry.p4 ? `${entry.p4.visits || 0} visitas · R$ ${entry.p4.revenueBrl || 0}` : "sem medição P4" }),
    ]),
    badge(decision, decision === "scale" ? "success" : decision === "kill" ? "danger" : "warning"),
  ]);
}

function memoryProjectOptions() {
  const apps = (state.snapshot?.pipelines || []).map((pipeline) => ({
    value: `app-${pipeline.appId}`,
    label: pipeline.appId,
  }));
  return [{ value: "factory", label: "Fábrica inteira" }, ...apps];
}

function memorySourceRow(item, fallbackProject = state.memory.project) {
  const path = item.path || item.pagePath || "memória sem caminho";
  const title = item.title || item.summary || path;
  const updatedAt = item.updated_at || item.updatedAt || null;
  return element("div", { className: "memory-source" }, [
    element("div", { className: "item-copy" }, [
      element("strong", { text: title }),
      element("span", { text: path }),
      element("small", { text: `${item.project || fallbackProject} · ${updatedAt ? formatDate(updatedAt) : "data não registrada"}` }),
    ]),
    badge(item.kind || item.type || "fact"),
  ]);
}

function memoryOverviewPages(overview) {
  const briefing = overview?.briefing || overview || {};
  const pages = [
    ...(briefing.rules || []),
    ...(briefing.slots || []),
    ...(briefing.recent_pages || []),
  ];
  const seen = new Set();
  return pages.filter((item) => {
    if (!item?.path || seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

function memoryResultCard(item) {
  const path = item.path || item.pagePath || "";
  const copy = item.snippet || item.body || item.summary || "Sem trecho disponível.";
  const removeAction = findAction("memory.page.delete", "factory");
  const remove = removeAction && path
    ? element("button", { className: "button button-danger", text: "Excluir", attrs: { type: "button" } })
    : null;
  if (remove) {
    remove.addEventListener("click", () => openAction("memory.page.delete", "factory", {
      appId: state.memory.project.startsWith("app-") ? state.memory.project.slice(4) : "",
      pagePath: path,
    }));
  }
  return element("article", { className: "memory-result" }, [
    memorySourceRow(item),
    element("p", { text: String(copy).replace(/<\/?mark>/gi, "").slice(0, 600) }),
    remove ? element("div", { className: "card-actions" }, [remove]) : null,
  ]);
}

function memoryAction(actionId, label = null) {
  const action = findAction(actionId, "factory");
  return action ? actionButton(action, label) : null;
}

function renderMemory() {
  const target = clear(byId("memory-content"));
  const memory = state.memory;
  const status = memory.status || state.snapshot.memory || {};
  const healthy = status.state === "healthy";
  const healthActions = healthy
    ? [memoryAction("memory.backup"), memoryAction("memory.reindex"), memoryAction("memory.update")]
    : [memoryAction(status.state === "degraded" ? "memory.retry" : "memory.setup"), memoryAction("memory.update")];
  const healthCard = element("article", { className: "panel memory-health" }, [
    panelHeader("Saúde da memória", status.version ? `ai-memory ${status.version}` : "runtime local"),
    element("div", { className: "panel-body" }, [
      element("div", { className: "memory-health-main" }, [
        badge(status.state || "unconfigured", healthy ? "success" : status.state === "degraded" ? "danger" : "warning"),
        element("strong", { text: healthy ? "Contexto disponível" : status.state === "degraded" ? "Memória precisa de atenção" : "Memória ainda não configurada" }),
      ]),
      element("div", { className: "memory-health-stats" }, [
        kpi("Páginas", status.pageCount || 0, "índice atual"),
        kpi("Fila durável", status.pendingOutbox || 0, "aguardando gravação"),
        kpi("Latência", status.latencyMs === null || status.latencyMs === undefined ? "—" : `${status.latencyMs} ms`, status.managed ? "processo gerenciado" : "processo externo"),
      ]),
      status.lastError ? element("p", { className: "form-error", text: status.lastError }) : null,
      element("div", { className: "card-actions" }, healthActions),
    ]),
  ]);

  if (!healthy) {
    target.append(healthCard, element("div", { className: "memory-empty" }, [
      emptyState(
        status.state === "degraded" ? "O histórico está protegido" : "Ative a memória local",
        status.state === "degraded"
          ? "A pipeline continua funcionando e mantém novas lembranças na fila durável. Use Tentar novamente para recuperar o índice."
          : "A configuração baixa a release verificada, valida o checksum e mantém tudo somente nesta máquina.",
      ),
    ]));
    return;
  }

  const projectSelect = element("select", { attrs: { name: "project", "aria-label": "Escopo da memória" } }, memoryProjectOptions().map((option) => element("option", {
    text: option.label,
    attrs: { value: option.value, selected: option.value === memory.project },
  })));
  projectSelect.addEventListener("change", () => {
    memory.project = projectSelect.value;
    memory.results = [];
    void loadMemoryOverview();
  });
  const typeSelect = element("select", { attrs: { name: "type", "aria-label": "Tipo de memória" } }, [
    ["all", "Todos os tipos"], ["rule", "Regras"], ["decision", "Decisões"], ["fact", "Fatos"], ["outcome", "Resultados"], ["handoff", "Handoffs"],
  ].map(([value, label]) => element("option", { text: label, attrs: { value, selected: value === memory.type } })));
  typeSelect.addEventListener("change", () => { memory.type = typeSelect.value; });
  const query = element("input", { attrs: { type: "search", name: "query", value: memory.query, placeholder: "Ex.: deploy, checkout, rate limit…", required: true, maxlength: 500 } });
  const searchForm = element("form", { className: "memory-search", attrs: { role: "search" } }, [
    element("label", {}, [element("span", { text: "Escopo" }), projectSelect]),
    element("label", {}, [element("span", { text: "Tipo" }), typeSelect]),
    element("label", { className: "memory-query" }, [element("span", { text: "O que você quer recuperar?" }), query]),
    element("button", { className: "button button-primary", text: "Buscar memória", attrs: { type: "submit" } }),
  ]);
  searchForm.addEventListener("submit", searchMemory);

  const results = memory.results.filter((item) => memory.type === "all" || (item.kind || item.type) === memory.type);
  const searchPanel = element("article", { className: "panel" }, [
    panelHeader("Busca", memory.query ? `${results.length} resultado(s)` : "por escopo e tipo"),
    element("div", { className: "panel-body" }, [
      searchForm,
      memory.error ? element("p", { className: "form-error", text: memory.error }) : null,
      memory.query
        ? results.length
          ? element("div", { className: "memory-result-list" }, results.map(memoryResultCard))
          : emptyState("Nada encontrado", "Tente outra expressão ou amplie o escopo para a fábrica.")
        : emptyState("Faça uma pergunta ao histórico", "A busca permanece limitada ao projeto escolhido."),
    ]),
  ]);

  const overview = memory.overview || {};
  const briefing = memory.briefing || { items: [], text: "" };
  const pages = memoryOverviewPages(overview);
  const health = overview.memory_health || {};
  const briefingPanel = element("article", { className: "panel" }, [
    panelHeader("Briefing do próximo job", `${briefing.items?.length || 0} fonte(s)`),
    element("div", { className: "panel-body" }, [
      briefing.text
        ? element("p", { className: "memory-briefing", text: briefing.text.slice(0, 4_000) })
        : emptyState("Ainda sem briefing", "Regras fixadas e aprendizados recentes aparecerão aqui."),
      briefing.items?.length ? element("div", { className: "memory-result-list" }, briefing.items.map((item) => memorySourceRow(item))) : null,
      element("div", { className: "card-actions" }, [memoryAction("memory.rule.write", "Promover uma regra")]),
    ]),
  ]);
  const timelinePanel = element("article", { className: "panel" }, [
    panelHeader("Linha do tempo", `${pages.length} itens recentes`),
    element("div", { className: "panel-body" }, [
      element("div", { className: "memory-health-warnings" }, [
        badge(`${health.stale_count || 0} antigas`, health.stale_count ? "warning" : "success"),
        badge(`${health.duplicate_count || 0} duplicadas`, health.duplicate_count ? "warning" : "success"),
        badge(`${health.orphan_count || 0} sem vínculo`, health.orphan_count ? "warning" : "success"),
      ]),
      pages.length
        ? element("div", { className: "memory-result-list" }, pages.slice(0, 12).map((item) => memoryResultCard(item)))
        : emptyState("Nenhuma página recente", "A linha do tempo nasce conforme a fábrica registra decisões e resultados."),
    ]),
  ]);

  const importButton = element("button", { className: "button button-secondary", text: "Analisar fontes seguras", attrs: { type: "button", disabled: memory.loading } });
  importButton.addEventListener("click", previewMemoryImport);
  const applyButton = element("button", { className: "button button-primary", text: "Importar selecionados", attrs: { type: "button", disabled: !memory.importPreview.length || memory.loading } });
  applyButton.addEventListener("click", applyMemoryImport);
  const importList = memory.importPreview.length
    ? element("div", { className: "import-list" }, memory.importPreview.map((entry) => element("label", { className: "import-item" }, [
        element("input", { className: "import-check", attrs: { type: "checkbox", checked: true }, dataset: { path: entry.path } }),
        element("div", { className: "item-copy" }, [
          element("strong", { text: entry.path }),
          element("span", { text: `${entry.project} · ${entry.type} · ${formatNumber(entry.bytes)} bytes` }),
          element("small", { text: String(entry.summary || "").slice(0, 240) }),
        ]),
      ])))
    : emptyState("Prévia obrigatória", "Somente README, docs, handoff, fila e resumos sanitizados de pipeline entram na seleção.");
  const importPanel = element("article", { className: "panel card-wide" }, [
    panelHeader("Importar histórico existente", "prévia antes de gravar"),
    element("div", { className: "panel-body" }, [
      importList,
      element("div", { className: "card-actions" }, [importButton, applyButton]),
    ]),
  ]);

  target.append(healthCard, searchPanel, element("div", { className: "memory-grid" }, [briefingPanel, timelinePanel]), importPanel);
}

async function loadMemoryOverview({ quiet = false } = {}) {
  if (!state.snapshot || state.memory.loading) return;
  const memory = state.memory;
  const project = memory.project;
  memory.loading = true;
  memory.error = null;
  renderMemory();
  try {
    const status = await getJson(API.memoryStatus);
    memory.status = status;
    if (status.state === "healthy") {
      const [overview, briefing] = await Promise.all([
        getJson(`${API.memoryOverview}?project=${encodeURIComponent(project)}`),
        getJson(`${API.memoryBriefing}?project=${encodeURIComponent(project)}`),
      ]);
      if (memory.project === project) {
        memory.overview = overview;
        memory.briefing = briefing;
      }
    } else {
      memory.overview = null;
      memory.briefing = null;
    }
  } catch (error) {
    memory.error = error.message;
    if (!quiet) notify(error.message, { error: true });
  } finally {
    memory.loading = false;
    renderMemory();
  }
}

async function searchMemory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const memory = state.memory;
  memory.query = String(new FormData(form).get("query") || "").trim();
  memory.project = String(new FormData(form).get("project") || "factory");
  memory.type = String(new FormData(form).get("type") || "all");
  memory.loading = true;
  memory.error = null;
  renderMemory();
  try {
    const payload = await getJson(`${API.memorySearch}?q=${encodeURIComponent(memory.query)}&project=${encodeURIComponent(memory.project)}`);
    memory.results = payload.hits || payload.results || [];
  } catch (error) {
    memory.results = [];
    memory.error = error.message;
  } finally {
    memory.loading = false;
    renderMemory();
  }
}

async function previewMemoryImport() {
  const memory = state.memory;
  memory.loading = true;
  memory.error = null;
  renderMemory();
  try {
    const preview = await postJson(API.memoryImportPreview, { all: true });
    memory.importPreview = preview.entries || [];
    notify(`${preview.count || memory.importPreview.length} fonte(s) prontas para revisão.`);
  } catch (error) {
    memory.error = error.message;
    notify(error.message, { error: true });
  } finally {
    memory.loading = false;
    renderMemory();
  }
}

async function applyMemoryImport() {
  const paths = [...document.querySelectorAll(".import-check:checked")].map((input) => input.dataset.path).filter(Boolean);
  if (!paths.length) {
    notify("Selecione pelo menos uma fonte da prévia.", { error: true });
    return;
  }
  const memory = state.memory;
  memory.loading = true;
  renderMemory();
  try {
    const approved = await postJson(API.memoryImportPreview, { paths });
    const result = await postJson(API.memoryImportApply, { previewId: approved.previewId });
    memory.importPreview = [];
    notify(`${result.imported || 0} importada(s), ${result.skipped || 0} já estavam atuais.`);
    await loadSnapshot({ quiet: true });
  } catch (error) {
    memory.error = error.message;
    notify(error.message, { error: true });
  } finally {
    memory.loading = false;
    if (state.snapshot) {
      renderMemory();
      void loadMemoryOverview({ quiet: true });
    }
  }
}

function renderActivity() {
  const target = clear(byId("activity-content"));
  const operations = [...state.snapshot.operations].reverse();
  const operationPanel = element("div", { className: "panel" }, [
    panelHeader("Operações", `${operations.length} registradas`),
    element("div", { className: "panel-body operation-list" }, operations.length
      ? operations.map(operationRow)
      : [emptyState("Nenhuma operação", "As ações executadas pela central aparecerão aqui.")]),
  ]);
  const eventPanel = element("div", { className: "panel" }, [
    panelHeader("Eventos ao vivo", state.eventSource ? "SSE conectado" : "conectando"),
    element("div", { className: "event-stream", attrs: { id: "event-stream", "aria-live": "off" } }, state.events.length
      ? state.events.slice(-100).reverse().map(eventRow)
      : [emptyState("Aguardando eventos", "Novos estados e operações aparecem aqui sem recarregar a página.")]),
  ]);
  target.append(element("div", { className: "activity-layout" }, [operationPanel, eventPanel]));
}

function operationRow(operation) {
  const inspect = element("button", { className: "button button-secondary", text: "Detalhes", attrs: { type: "button" } });
  inspect.addEventListener("click", () => inspectOperation(operation.id));
  return element("div", { className: "operation-item" }, [
    element("div", { className: "item-copy" }, [
      element("strong", { text: operation.actionId }),
      element("span", { text: `${operation.appId || "fábrica"} · ${formatDate(operation.updatedAt || operation.createdAt)}` }),
    ]),
    element("div", { className: "card-actions" }, [badge(humanStatus(operation.status), statusTone(operation.status)), inspect]),
  ]);
}

function eventRow(event) {
  return element("div", { className: "event-line" }, [
    element("time", { text: formatDate(event.receivedAt, { timeOnly: true }) }),
    element("span", { text: event.type || "evento" }),
    element("span", { text: eventSummary(event) }),
  ]);
}

function eventSummary(event) {
  if (event.line) return event.line;
  if (event.actionId) return `${event.actionId} · ${humanStatus(event.status)}`;
  if (event.appId) return `${event.appId} · ${humanStatus(event.status || event.pipeline?.status)}`;
  if (event.message) return event.message;
  return "Estado atualizado";
}

async function inspectOperation(id) {
  try {
    const response = await fetch(`/api/control/operations/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
    const operation = await readResponse(response);
    const result = operation.error || operation.result?.message || operation.result?.status || humanStatus(operation.status);
    notify(`${operation.actionId}: ${result}`);
  } catch (error) {
    notify(error.message, { error: true });
  }
}

function renderAll() {
  if (!state.snapshot) return;
  renderHome();
  renderIdea();
  renderRun();
  renderFactory();
}

function renderActionField(field) {
  if (field.type === "hidden") {
    return element("input", { attrs: { type: "hidden", name: field.name, value: field.options?.[0] || "" } });
  }

  const wrapper = element("div", { className: "field", dataset: { fieldType: field.type } });
  const labelText = element("span", { text: field.label });
  if (field.required) labelText.append(element("span", { className: "required-mark", text: "*", attrs: { "aria-hidden": "true" } }));

  if (field.type === "checkbox") {
    const input = element("input", { attrs: { type: "checkbox", name: field.name } });
    wrapper.append(element("label", { className: "check-row" }, [input, labelText]));
    return wrapper;
  }

  if (field.type === "choice") {
    const group = element("div", { className: "choice-group" }, (field.options || []).map((option, index) => {
      const input = element("input", { attrs: { type: "radio", name: field.name, value: option, required: field.required, checked: index === 0 } });
      return element("label", { className: "choice-option" }, [input, element("span", { text: option })]);
    }));
    wrapper.append(element("span", { className: "field-legend" }, [labelText]), group);
    return wrapper;
  }

  if (field.type === "team-members") {
    const members = element("div", { className: "team-members", dataset: { members: field.name } });
    const add = element("button", { className: "button button-secondary", text: "Adicionar músico", attrs: { type: "button" } });
    add.addEventListener("click", () => addTeamMember(members));
    wrapper.append(element("span", { className: "field-legend" }, [labelText]), members, add);
    addTeamMember(members);
    return wrapper;
  }

  let input;
  if (field.type === "textarea" || field.type === "json") {
    input = element("textarea", { attrs: { name: field.name, required: field.required, rows: 4 } });
  } else if (field.type === "select") {
    input = element("select", { attrs: { name: field.name, required: field.required } }, (field.options || []).map((option) => element("option", {
      text: ["controlMode", "mode"].includes(field.name) ? controlModeLabel(option) : option,
      attrs: { value: option },
    })));
    if (!field.options?.length) {
      input.append(element("option", { text: "Nenhuma opção disponível", attrs: { value: "", disabled: true, selected: true } }));
      input.disabled = true;
    }
  } else {
    input = element("input", { attrs: { type: field.type === "number" ? "number" : "text", name: field.name, required: field.required, min: field.type === "number" ? 0 : null, step: field.type === "number" ? "any" : null } });
    if (field.name === "measuredAt") input.value = new Date().toISOString();
  }
  const label = element("label", {}, [labelText, input]);
  wrapper.append(label);
  return wrapper;
}

function addTeamMember(container) {
  const providers = state.snapshot?.providers || [];
  const row = element("div", { className: "member-row" });
  const provider = element("select", { attrs: { "aria-label": "Provider", required: true } }, providers.map((item) => element("option", { text: item.id, attrs: { value: item.id } })));
  const model = element("select", { attrs: { "aria-label": "Modelo", required: true } });
  const effort = element("select", { attrs: { "aria-label": "Esforço", required: true } });
  const role = element("select", { attrs: { "aria-label": "Papel", required: true } }, TEAM_ROLES.map((item) => element("option", { text: item, attrs: { value: item } })));
  const remove = element("button", { className: "icon-button", text: "×", attrs: { type: "button", "aria-label": "Remover músico" } });

  function syncProvider() {
    const selected = providers.find((item) => item.id === provider.value) || providers[0] || {};
    model.replaceChildren(...(selected.models || [{ id: "default", label: "Padrão" }]).map((item) => element("option", { text: item.label || item.id, attrs: { value: item.id } })));
    effort.replaceChildren(...(selected.efforts || ["medium"]).map((item) => element("option", { text: item, attrs: { value: item } })));
  }
  provider.addEventListener("change", syncProvider);
  remove.addEventListener("click", () => {
    if (container.children.length > 1) row.remove();
    else notify("Um time precisa de pelo menos um músico.", { error: true });
  });
  syncProvider();
  row.append(provider, model, effort, role, remove);
  container.append(row);
}

function collectFormInput(form, action) {
  const input = {};
  for (const field of action.fields || []) {
    if (field.type === "team-members") {
      const container = form.querySelector(`[data-members="${CSS.escape(field.name)}"]`);
      input[field.name] = [...(container?.querySelectorAll(".member-row") || [])].map((row) => {
        const selects = row.querySelectorAll("select");
        return { provider: selects[0].value, model: selects[1].value, effort: selects[2].value, roles: [selects[3].value] };
      });
      continue;
    }
    if (field.type === "checkbox") {
      input[field.name] = Boolean(form.elements.namedItem(field.name)?.checked);
      continue;
    }
    const control = form.elements.namedItem(field.name);
    if (!control) continue;
    const value = String(control.value ?? "").trim();
    if (!value && !field.required) continue;
    input[field.name] = field.type === "number" ? Number(value) : value;
  }
  return input;
}

function openAction(actionId, scope, prefill = {}) {
  const action = findAction(actionId, scope);
  if (!action) {
    notify("Essa ação não existe mais no estado atual.", { error: true });
    loadSnapshot({ quiet: true }).catch(() => {});
    return;
  }
  if (!action.enabled) {
    notify(action.blockedReason || "Ação indisponível.", { error: true });
    return;
  }
  state.currentAction = action;
  byId("action-dialog-title").textContent = action.label;
  byId("action-description").textContent = action.description;
  byId("action-effect").textContent = action.expectedEffect;
  const risk = byId("action-risk");
  risk.textContent = riskBadge(action.risk).textContent;
  risk.dataset.risk = action.risk;
  clear(byId("action-fields")).append(...(action.fields || []).map((field) => renderActionField(field)));
  for (const [name, value] of Object.entries(prefill)) {
    const control = byId("action-form").elements.namedItem(name);
    if (control && "value" in control) control.value = String(value ?? "");
  }
  byId("action-error").textContent = "";
  byId("confirmation-check").checked = false;
  const needsConfirmation = ["external", "destructive"].includes(action.risk);
  byId("confirmation-box").hidden = !needsConfirmation;
  byId("confirmation-copy").textContent = action.risk === "destructive"
    ? `Entendo que “${action.label}” tem efeito destrutivo e confirmo o escopo ${action.scope}.`
    : `Confirmo que esta ação abre um efeito externo no escopo ${action.scope}.`;
  const submit = byId("action-submit");
  submit.className = action.risk === "destructive" ? "button button-danger" : "button button-primary";
  submit.textContent = action.risk === "destructive" ? "Confirmar ação destrutiva" : "Executar ação";
  byId("action-dialog").showModal();
}

async function requestConfirmation(action) {
  const payload = await postJson(API.confirmations, {
    actionId: action.id,
    appId: appIdFromScope(action.scope),
    stateVersion: state.snapshot.version,
  });
  return payload.nonce;
}

async function executeAction(action, input, confirmation = null) {
  const appId = appIdFromScope(action.scope);
  try {
    const operation = await postJson(API.execute, {
      actionId: action.id,
      appId,
      input,
      stateVersion: state.snapshot.version,
      idempotencyKey: crypto.randomUUID(),
      confirmation,
    });
    notify(`${action.label}: ${humanStatus(operation.status)}.`);
    await loadSnapshot({ quiet: true });
    return operation;
  } catch (error) {
    if (error.code === "state_stale") {
      await loadSnapshot({ quiet: true }).catch(() => {});
      throw new Error("O estado mudou enquanto você revisava. A central foi atualizada; confira a ação novamente.");
    }
    throw error;
  }
}

async function submitCurrentAction(event) {
  event.preventDefault();
  const action = state.currentAction;
  const form = byId("action-form");
  if (!action || !form.reportValidity()) return;
  const needsConfirmation = ["external", "destructive"].includes(action.risk);
  if (needsConfirmation && !byId("confirmation-check").checked) {
    byId("action-error").textContent = "Confirme que você revisou o efeito desta ação.";
    return;
  }
  const submit = byId("action-submit");
  submit.disabled = true;
  byId("action-error").textContent = "";
  try {
    const confirmation = needsConfirmation ? await requestConfirmation(action) : null;
    await executeAction(action, collectFormInput(form, action), confirmation);
    byId("action-dialog").close();
    state.currentAction = null;
  } catch (error) {
    byId("action-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

function connectEvents() {
  if (state.eventSource) state.eventSource.close();
  const source = new EventSource(API.events);
  state.eventSource = source;
  source.addEventListener("open", () => setConnection(true, "Nexus ao vivo"));
  source.addEventListener("error", () => setConnection(false, "Reconectando eventos"));
  source.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      state.events.push({ ...payload, receivedAt: new Date().toISOString() });
      if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
      if (state.activeSection === "run" && state.snapshot) renderRun();
      if (state.activeSection === "factory" && state.factoryTab === "activity" && state.snapshot) renderActivity();
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(() => loadSnapshot({ quiet: true }).catch(() => {}), 220);
    } catch {
      // Eventos legados que não são JSON não alteram estado nem DOM.
    }
  });
}

function resolveSection(sectionId) {
  const raw = sectionId || "home";
  if (SECTION_IDS.includes(raw)) return raw;
  return SECTION_ALIASES[raw] || "home";
}

function showSection(sectionId) {
  const resolved = resolveSection(sectionId);
  if (sectionId === "metrics") state.factoryTab = "metrics";
  if (sectionId === "memory") state.factoryTab = "memory";
  if (sectionId === "activity") state.factoryTab = "activity";
  if (sectionId === "decisions") {
    /* stay home — gates are there */
  }

  state.activeSection = resolved;
  for (const id of SECTION_IDS) {
    const el = byId(id);
    if (el) el.hidden = id !== resolved;
  }
  document.querySelectorAll("[data-section]").forEach((button) => {
    const active = button.dataset.section === resolved;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.body.classList.remove("nav-open");
  byId("mobile-menu").setAttribute("aria-expanded", "false");
  history.replaceState(null, "", `#${resolved}`);
  byId("workspace").focus({ preventScroll: true });
  if (resolved === "factory") applyFactoryTab();
  if (resolved === "factory" && state.factoryTab === "memory" && state.snapshot && !state.memory.loading) {
    void loadMemoryOverview({ quiet: true });
  }
  if (resolved === "run" && state.snapshot) renderRun();
  if (resolved === "home" && state.snapshot) renderHome();
}

function bindInterface() {
  document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
  document.querySelectorAll("[data-go-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.goSection)));
  document.querySelectorAll("[data-factory-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.factoryTab = button.dataset.factoryTab || "setup";
      applyFactoryTab();
    });
  });
  byId("mobile-menu").addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    byId("mobile-menu").setAttribute("aria-expanded", String(open));
  });
  byId("refresh-button").addEventListener("click", () => loadSnapshot().catch(() => {}));
  byId("retry-button").addEventListener("click", () => loadSnapshot().catch(() => {}));
  byId("action-close").addEventListener("click", () => byId("action-dialog").close());
  byId("action-cancel").addEventListener("click", () => byId("action-dialog").close());
  byId("action-form").addEventListener("submit", submitCurrentAction);
  byId("action-dialog").addEventListener("close", () => { state.currentAction = null; });
  window.addEventListener("hashchange", () => showSection(location.hash.slice(1) || "home"));
}

async function start() {
  bindInterface();
  showSection(resolveSection(location.hash.slice(1) || "home"));
  connectEvents();
  try {
    await loadSnapshot({ quiet: true });
  } catch {
    // O banner persistente oferece retry; o EventSource continua tentando reconectar.
  }
}

start();
