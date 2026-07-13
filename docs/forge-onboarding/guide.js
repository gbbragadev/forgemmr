import { COMMANDS, GATES, STAGES, TEAMS, filterCommands, resolveGate } from "./guide-data.js";

const categoryLabels = {
  all: "Todos",
  start: "Começar",
  observe: "Acompanhar",
  decide: "Decidir",
  iterate: "Iterar",
  recover: "Recuperar",
  danger: "Risco",
};

let activeCategory = "all";

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

function renderTeams() {
  const list = document.querySelector("#team-list");
  const template = document.querySelector("#team-template");
  const fragment = document.createDocumentFragment();

  TEAMS.forEach((team, index) => {
    const node = template.content.cloneNode(true);
    node.querySelector("[data-team-rank]").textContent = String(index + 1).padStart(2, "0");
    node.querySelector("[data-team-id]").textContent = team.id;
    node.querySelector("[data-team-title]").textContent = team.title;
    node.querySelector("[data-team-use]").textContent = team.use;
    node.querySelector("[data-team-quota]").textContent = team.quota;
    node.querySelector("[data-team-signal]").textContent = team.signal;
    fragment.append(node);
  });

  list.replaceChildren(fragment);
}

function renderFilters() {
  const filters = document.querySelector("#command-filters");
  const fragment = document.createDocumentFragment();

  for (const [category, label] of Object.entries(categoryLabels)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.textContent = label;
    fragment.append(button);
  }

  filters.replaceChildren(fragment);
}

function renderCommands(query = "", category = activeCategory) {
  const results = document.querySelector("#command-results");
  const template = document.querySelector("#command-template");
  const matches = filterCommands(query, category);

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "command-empty";
    empty.textContent = "Nenhum comando encontrado. Tente ‘status’, ‘deploy’ ou limpe o filtro.";
    results.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of matches) {
    const node = template.content.cloneNode(true);
    node.querySelector("[data-command-category]").textContent = categoryLabels[item.category];
    node.querySelector("[data-command-intent]").textContent = item.intent;
    node.querySelector("[data-command-code]").textContent = item.command;
    node.querySelector("[data-command-note]").textContent = item.note;
    const button = node.querySelector("[data-command-copy]");
    button.dataset.copy = item.command;
    button.setAttribute("aria-label", `Copiar comando: ${item.intent}`);
    fragment.append(node);
  }

  results.replaceChildren(fragment);
}

function setGateOutput(gateId, decision) {
  const output = document.querySelector("#gate-output");
  const outcome = resolveGate(gateId, decision);
  const title = document.createElement("strong");
  const effect = document.createElement("span");
  const command = document.createElement("code");
  title.textContent = GATES[gateId][decision].label;
  effect.textContent = outcome.effect;
  command.textContent = outcome.command;
  output.replaceChildren(title, effect, command);
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

async function copyCommand(text, button) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard indisponível");
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  button.dataset.copied = "true";
  const previous = button.textContent;
  button.textContent = "Copiado";
  window.setTimeout(() => {
    button.dataset.copied = "false";
    button.textContent = previous;
  }, 1600);
}

function setupCommandAtlas() {
  const search = document.querySelector("#command-search");
  const filters = document.querySelector("#command-filters");

  search.addEventListener("input", () => renderCommands(search.value, activeCategory));
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    for (const filter of filters.querySelectorAll("[data-category]")) {
      filter.setAttribute("aria-pressed", String(filter === button));
    }
    renderCommands(search.value, activeCategory);
  });
}

function setupGateLab() {
  const select = document.querySelector("#gate-select");
  const decisions = document.querySelector("#gate-decisions");
  select.addEventListener("change", () => {
    renderGateDecisions(select.value);
    document.querySelector("#gate-output").textContent = "Escolha uma decisão para ver efeito e comando.";
  });
  decisions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gate-decision]");
    if (button) setGateOutput(select.value, button.dataset.gateDecision);
  });
}

function setupCopyButtons() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (button) copyCommand(button.dataset.copy, button);
  });
}

function setupScrollSpy() {
  const links = new Map([...document.querySelectorAll("[data-nav]")].map((link) => [link.dataset.nav, link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const link of links.values()) link.removeAttribute("aria-current");
    links.get(visible.target.id)?.setAttribute("aria-current", "true");
  }, { rootMargin: "-20% 0px -65%", threshold: [0.05, 0.25, 0.5] });
  for (const id of links.keys()) observer.observe(document.getElementById(id));
}

function setupChecklist() {
  const storageKey = "forge-onboarding-checklist-v1";
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
    progress.style.width = `${(selected.length / checks.length) * 100}%`;
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* storage pode estar bloqueado */ }
  };

  for (const check of checks) check.addEventListener("change", update);
  update();
}

function init() {
  renderJourney();
  renderTeams();
  renderFilters();
  renderCommands();
  renderGateDecisions();
  setupCommandAtlas();
  setupGateLab();
  setupCopyButtons();
  setupScrollSpy();
  setupChecklist();
}

init();
