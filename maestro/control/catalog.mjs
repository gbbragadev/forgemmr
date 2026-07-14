const RISKS = new Set(["safe", "guarded", "external", "destructive"]);

function field(name, label, type, { required = false, options = [] } = {}) {
  return { name, label, type, required, options };
}

function action({ id, scope, label, description, risk, enabled = true, blockedReason = null, expectedEffect, fields = [] }) {
  if (!RISKS.has(risk)) throw new Error(`risco de ação inválido: ${risk}`);
  return {
    id,
    scope,
    label,
    description,
    risk,
    enabled: Boolean(enabled),
    blockedReason: enabled ? null : blockedReason || "Ação indisponível no estado atual.",
    expectedEffect,
    fields,
  };
}

function pendingGate(pipeline) {
  return [...(pipeline.gates || [])].reverse().find((gate) => !gate.decision) || null;
}

/**
 * Catálogo state-driven. O browser renderiza estes descritores, mas nunca escolhe
 * comandos, executáveis ou caminhos de arquivo.
 */
export function createActionCatalog({ pipelines = [], teams = [], profiles = [], blueprints = [], providers = [], lifecycle = [], memoryActions = [] } = {}) {
  const teamIds = teams.map((team) => team.id);
  const profileIds = profiles.map((profile) => profile.slug);
  const blueprintIds = blueprints.map((blueprint) => blueprint.id);
  const actions = [
    action({
      id: "pipeline.start",
      scope: "factory",
      label: "Criar pipeline",
      description: "Estrutura uma ideia e inicia o Forge no time e modo escolhidos.",
      risk: "safe",
      expectedEffect: "Cria um app-id isolado e avança até o primeiro gate aplicável.",
      fields: [
        field("idea", "Ideia", "textarea", { required: true }),
        field("team", "Time", "select", { required: true, options: teamIds }),
        field("profile", "Profile", "select", { options: profileIds }),
        field("blueprint", "Blueprint", "select", { options: blueprintIds }),
        field("capability", "Capability", "select", { options: ["auto", "static", "quiz", "chat"] }),
        field("target", "Target", "select", { options: ["auto", "cf-pages", "cf-workers", "vercel", "gh-pages"] }),
        field("dryRun", "Dry-run", "checkbox"),
        field("controlMode", "Modo de controle", "select", { options: ["autopilot_to_gate", "guided", "manual"] }),
      ],
    }),
    action({
      id: "profile.create",
      scope: "factory",
      label: "Criar profile",
      description: "Cria uma configuração reutilizável de nicho, idioma e deploy e já a ativa.",
      risk: "guarded",
      expectedEffect: "Grava profiles/<slug>/profile.md e atualiza a cópia ativa em .forge/.",
      fields: [
        field("name", "Nome", "text", { required: true }),
        field("niche", "Nicho", "text", { required: true }),
        field("namespace", "Namespace", "text", { required: true }),
        field("baseUrl", "Domínio base", "text", { required: true }),
        field("i18nRule", "Idiomas", "select", { required: true, options: ["single", "bilingual"] }),
        field("context", "Contexto e guardrails", "textarea"),
      ],
    }),
    action({
      id: "profile.activate",
      scope: "factory",
      label: "Ativar profile",
      description: "Troca o profile usado pelas próximas pipelines.",
      risk: "guarded",
      enabled: profileIds.length > 0,
      blockedReason: "Nenhum profile foi criado ainda.",
      expectedEffect: "Atualiza .forge/profile.md e .forge/active.txt.",
      fields: [field("slug", "Profile", "select", { required: true, options: profileIds })],
    }),
    action({
      id: "profile.import",
      scope: "factory",
      label: "Importar profile ativo",
      description: "Adiciona à biblioteca uma configuração .forge/profile.md ainda órfã.",
      risk: "safe",
      expectedEffect: "Cria uma entrada em profiles/ sem sobrescrever conteúdo existente.",
    }),
    action({
      id: "team.save",
      scope: "factory",
      label: "Salvar time",
      description: "Monta dispatch, fallbacks e revisor a partir dos músicos escolhidos.",
      risk: "guarded",
      expectedEffect: "Atualiza somente o time escolhido e preserva o restante do roster.",
      fields: [
        field("name", "Nome do time", "text", { required: true }),
        field("emoji", "Símbolo", "text"),
        field("members", "Músicos", "team-members", { required: true }),
      ],
    }),
    action({
      id: "providers.refresh",
      scope: "factory",
      label: "Atualizar providers",
      description: "Refaz o diagnóstico local das CLIs conhecidas.",
      risk: "safe",
      expectedEffect: "Atualiza disponibilidade sem executar um coding agent.",
    }),
    action({
      id: "provider.login",
      scope: "factory",
      label: "Conectar provider",
      description: "Inicia o fluxo oficial de login da CLI escolhida.",
      risk: "external",
      enabled: providers.some((provider) => provider.installed && provider.loginSupported),
      blockedReason: "Nenhuma CLI instalada possui login interativo disponível.",
      expectedEffect: "Abre o fluxo de autenticação da CLI; nenhuma credencial passa pela central.",
      fields: [
        field("provider", "Provider", "select", {
          required: true,
          options: providers.filter((provider) => provider.installed && provider.loginSupported).map((provider) => provider.id),
        }),
      ],
    }),
  ];
  const lifecycleByApp = new Map(lifecycle.map((entry) => [entry.appId, entry]));
  const actionApps = new Set();
  actions.push(...memoryActions);

  function addLifecycleActions(appId, pipelineStatus = "idle") {
    if (!appId || actionApps.has(appId)) return;
    actionApps.add(appId);
    const scope = `pipeline:${appId}`;
    const state = lifecycleByApp.get(appId);
    const canMeasure = !["running", "paused_gate", "paused_control", "blocked"].includes(pipelineStatus);
    actions.push(
      action({
        id: "p4.record",
        scope,
        label: "Registrar medição P4",
        description: "Salva uma medição comparável de aquisição, ativação, receita e custo.",
        risk: "guarded",
        enabled: canMeasure,
        blockedReason: "Espere a pipeline chegar ao pós-ship antes de medir.",
        expectedEffect: "Grava apps/<app>/docs/p4-result.json e atualiza o lifecycle.",
        fields: [
          field("measuredAt", "Data da medição", "text", { required: true }),
          field("why", "Leitura dos dados", "textarea", { required: true }),
          field("channel", "Canal", "text", { required: true }),
          field("daysLive", "Dias no ar", "number", { required: true }),
          field("visits", "Visitas", "number", { required: true }),
          field("activations", "Ativações", "number", { required: true }),
          field("ctaClicks", "Cliques no CTA", "number", { required: true }),
          field("conversions", "Conversões", "number", { required: true }),
          field("revenueBrl", "Receita (R$)", "number", { required: true }),
          field("apiCostBrl", "Custo de API (R$)", "number", { required: true }),
          field("verdict", "Sinal sugerido", "select", { required: true, options: ["kill", "iterate", "scale"] }),
        ],
      }),
      action({
        id: "p5.decide",
        scope,
        label: "Decidir P5",
        description: "Aposenta, itera ou escala a aposta usando a medição P4.",
        risk: "guarded",
        enabled: Boolean(state?.p4),
        blockedReason: "Registre uma medição P4 válida antes da decisão P5.",
        expectedEffect: "Registra a decisão; kill não remove arquivos, iterate abre feedback e scale cria próximos passos.",
        fields: [
          field("decision", "Decisão", "choice", { required: true, options: ["kill", "iterate", "scale"] }),
          field("why", "Por quê?", "textarea", { required: true }),
          field("feedback", "Feedback da iteração", "textarea"),
          field("team", "Time da iteração", "select", { options: teamIds }),
          field("dryRun", "Iterar em dry-run", "checkbox"),
          field("controlMode", "Modo de controle", "select", { options: ["autopilot_to_gate", "guided", "manual"] }),
        ],
      }),
    );
  }

  for (const pipeline of pipelines) {
    const appId = pipeline.appId;
    if (!appId) continue;
    const scope = `pipeline:${appId}`;
    const status = pipeline.status || "idle";
    const terminal = ["done", "killed", "error"].includes(status);
    const gate = pendingGate(pipeline);

    if (gate) {
      actions.push(
        action({
          id: "gate.decide",
          scope,
          label: `Decidir ${gate.id}`,
          description: gate.prompt || "Escolha como a pipeline deve continuar.",
          risk: "guarded",
          expectedEffect: "Registra a decisão humana e retoma ou encerra o fluxo conforme a escolha.",
          fields: [
            field("gateId", "Gate", "hidden", { required: true, options: [gate.id] }),
            field("choice", "Decisão", "choice", { required: true, options: gate.choices || [] }),
            field("feedback", "Feedback", "textarea"),
          ],
        }),
      );
    }

    actions.push(
      action({
        id: "pipeline.feedback",
        scope,
        label: "Iterar com feedback",
        description: "Abre uma iteração preservando o histórico da aposta.",
        risk: "guarded",
        enabled: status === "done",
        blockedReason: "Feedback de produto fica disponível quando a pipeline termina.",
        expectedEffect: "Inicia o job ITERATE e volta ao gate de deploy.",
        fields: [field("feedback", "O que deve mudar?", "textarea", { required: true })],
      }),
      action({
        id: "pipeline.stop",
        scope,
        label: "Parar com segurança",
        description: "Interrompe o executor atual e cria um gate de recuperação.",
        risk: "guarded",
        enabled: ["running", "paused_gate"].includes(status),
        blockedReason: "Só é possível parar uma pipeline em execução.",
        expectedEffect: "Mata apenas o processo do job atual e preserva arquivos e estado.",
      }),
      action({
        id: "pipeline.resume",
        scope,
        label: "Retomar pipeline",
        description: "Continua uma pipeline parada quando não há decisão pendente.",
        risk: "safe",
        enabled: status === "blocked" && !gate,
        blockedReason: gate ? `Responda primeiro ao gate ${gate.id}.` : "A pipeline não está bloqueada.",
        expectedEffect: "Retoma a partir do estado persistido.",
      }),
      action({
        id: "pipeline.control_mode",
        scope,
        label: "Ajustar modo de controle",
        description: "Define quanto a central deve avançar sozinha entre jobs e fases.",
        risk: "safe",
        enabled: status !== "killed",
        blockedReason: "Uma pipeline morta não muda de modo.",
        expectedEffect: "Aplica o novo modo sem continuar automaticamente uma pausa existente.",
        fields: [
          field("mode", "Modo", "select", {
            required: true,
            options: ["autopilot_to_gate", "guided", "manual"],
          }),
        ],
      }),
      action({
        id: "pipeline.continue",
        scope,
        label: "Continuar pipeline",
        description: "Autoriza o próximo trecho depois de uma pausa do modo guided ou manual.",
        risk: "safe",
        enabled: status === "paused_control",
        blockedReason: "A pipeline não está aguardando uma continuação de controle.",
        expectedEffect: "Limpa a pausa de controle e executa até o próximo limite configurado.",
      }),
      action({
        id: "pipeline.target",
        scope,
        label: "Alterar target",
        description: "Muda o alvo de deploy desta pipeline sem recomeçar o produto.",
        risk: "guarded",
        enabled: !["killed"].includes(status),
        blockedReason: "Uma pipeline morta não recebe novo target.",
        expectedEffect: "A próxima tentativa de P3 usa o target escolhido.",
        fields: [
          field("target", "Target", "select", { required: true, options: ["cf-pages", "cf-workers", "vercel", "gh-pages"] }),
          field("subdomain", "Subdomínio", "text"),
        ],
      }),
      action({
        id: "pipeline.kill",
        scope,
        label: "Encerrar run",
        description: "Encerra a execução atual sem apagar o app ou seus artefatos.",
        risk: "destructive",
        enabled: !terminal,
        blockedReason: "Esta run já terminou.",
        expectedEffect: "Mata o executor e marca a run como killed; não remove produção.",
      }),
      action({
        id: "pipeline.remove",
        scope,
        label: "Remover app e estado",
        description: "Apaga o repositório local do app, pipeline e propostas.",
        risk: "destructive",
        expectedEffect: "Remove permanentemente os arquivos locais do app e seu estado do Maestro.",
        fields: [field("force", "Forçar mesmo com run ativa", "checkbox")],
      }),
    );
    addLifecycleActions(appId, status);
  }

  for (const entry of lifecycle) addLifecycleActions(entry.appId, "idle");

  return actions;
}
