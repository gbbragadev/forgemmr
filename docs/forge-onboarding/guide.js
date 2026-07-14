import { GATES, STAGES, resolveGate } from "./guide-data.js";

const MEMORY_STATES = Object.freeze({
  unconfigured: {
    label: "NÃO CONFIGURADA",
    title: "Instale quando quiser contexto durável",
    copy: "A fábrica já funciona sem memória. Clique em Configurar memória para baixar a release verificada e iniciar o serviço somente nesta máquina.",
    action: "Instalar memória",
    note: "Até lá, cada pipeline segue normalmente sem briefing recuperado.",
    tone: "warning",
  },
  healthy: {
    label: "SAUDÁVEL",
    title: "Briefing, busca e histórico estão disponíveis",
    copy: "Escolha Fábrica ou um app, revise as fontes recuperadas e promova regras apenas quando a evidência justificar.",
    action: "Importar histórico",
    note: "Backup, busca, reindexação e regras ficam disponíveis na mesma área.",
    tone: "verified",
  },
  degraded: {
    label: "DEGRADADA",
    title: "A pipeline continua; a memória fica isolada",
    copy: "Novos registros entram na outbox privada e sobrevivem ao restart. Leia o erro sanitizado e tente recuperar quando for conveniente.",
    action: "Tentar novamente",
    note: "Continuar sem memória é seguro: nenhum job perde o trabalho por causa do índice.",
    tone: "danger",
  },
});

function renderJourney() {
  const list = document.querySelector("#journey-list");
  const template = document.querySelector("#journey-template");
  const fragment = document.createDocumentFragment();

  for (const stage of STAGES) {
    const node = template.content.cloneNode(true);
    node.querySelector("[data-stage-code]").textContent = stage.code;
    node.querySelector("[data-stage-owner]").textContent = stage.owner;
    node.querySelector("[data-stage-title]").textContent = stage.title;
    node.querySelector("[data-stage-summary]").textContent = stage.summary;
    node.querySelector("[data-stage-output]").textContent = stage.output;
    const gate = node.querySelector("[data-stage-gate]");
    gate.textContent = stage.gate ? `GATE · ${stage.gate}` : "";
    fragment.append(node);
  }

  list.replaceChildren(fragment);
}

function renderMemoryState(stateId = "unconfigured") {
  const state = MEMORY_STATES[stateId] || MEMORY_STATES.unconfigured;
  const output = document.querySelector("#memory-state-output");
  const header = document.createElement("div");
  const status = document.createElement("span");
  const title = document.createElement("strong");
  const copy = document.createElement("p");
  const action = document.createElement("b");
  const note = document.createElement("small");

  status.className = `memory-status ${state.tone}`;
  status.textContent = state.label;
  title.textContent = state.title;
  header.append(status, title);
  copy.textContent = state.copy;
  action.textContent = state.action;
  note.textContent = state.note;
  output.replaceChildren(header, copy, action, note);
}

function setupMemoryLab() {
  const controls = document.querySelector(".memory-state-tabs");
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-memory-state]");
    if (!button) return;
    for (const item of controls.querySelectorAll("[data-memory-state]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    renderMemoryState(button.dataset.memoryState);
  });
}

function setGateOutput(gateId, decision) {
  const output = document.querySelector("#gate-output");
  const outcome = resolveGate(gateId, decision);
  const title = document.createElement("strong");
  const effect = document.createElement("span");
  const next = document.createElement("small");
  title.textContent = GATES[gateId][decision].label;
  effect.textContent = outcome.effect;
  next.textContent = "Na central real, revise o escopo e confirme no cartão da decisão.";
  output.replaceChildren(title, effect, next);
}

function renderGateDecisions(gateId = document.querySelector("#gate-select").value) {
  const gate = GATES[gateId];
  const context = document.querySelector("#gate-context");
  const decisions = document.querySelector("#gate-decisions");
  const title = document.createElement("strong");
  const description = document.createElement("p");
  title.textContent = gate.title;
  description.textContent = gate.description;
  context.replaceChildren(title, description);

  const fragment = document.createDocumentFragment();
  for (const decision of Object.keys(gate).filter((key) => !["title", "description"].includes(key))) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.gateDecision = decision;
    button.textContent = gate[decision].label;
    fragment.append(button);
  }
  decisions.replaceChildren(fragment);
}

function setupGateLab() {
  const select = document.querySelector("#gate-select");
  const decisions = document.querySelector("#gate-decisions");
  select.addEventListener("change", () => {
    renderGateDecisions(select.value);
    document.querySelector("#gate-output").textContent = "Escolha uma decisão para ver o efeito antes de agir.";
  });
  decisions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gate-decision]");
    if (button) setGateOutput(select.value, button.dataset.gateDecision);
  });
}

function setupScrollSpy() {
  const links = new Map([...document.querySelectorAll("[data-nav]")].map((link) => [link.dataset.nav, link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const link of links.values()) link.removeAttribute("aria-current");
    links.get(visible.target.id)?.setAttribute("aria-current", "true");
  }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.25, 0.5] });
  for (const id of links.keys()) observer.observe(document.getElementById(id));
}

function setupChecklist() {
  const storageKey = "forge-nexus-onboarding-checklist-v2";
  const checks = [...document.querySelectorAll("#ship-checks input[type='checkbox']")];
  const count = document.querySelector("#checklist-count");
  const progress = document.querySelector("#checklist-progress");
  let saved = [];
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(value)) saved = value;
  } catch {
    saved = [];
  }

  for (const check of checks) check.checked = saved.includes(check.value);
  const update = () => {
    const selected = checks.filter((check) => check.checked).map((check) => check.value);
    count.textContent = `${selected.length} / ${checks.length}`;
    progress.style.width = `${checks.length ? (selected.length / checks.length) * 100 : 0}%`;
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* storage pode estar bloqueado */ }
  };
  for (const check of checks) check.addEventListener("change", update);
  update();
}

function init() {
  renderJourney();
  renderMemoryState();
  renderGateDecisions();
  setupMemoryLab();
  setupGateLab();
  setupScrollSpy();
  setupChecklist();
}

init();
