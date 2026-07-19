const RISKS = new Set(["safe", "guarded", "external", "destructive"]);

function field(name, label, type, { required = false, options = [], help = null, defaultValue = null } = {}) {
  return { name, label, type, required, options, ...(help ? { help } : {}), ...(defaultValue !== null ? { defaultValue } : {}) };
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
export function createActionCatalog({ pipelines = [], teams = [], profiles = [], blueprints = [], providers = [], executors = providers, lifecycle = [], deployments = [], memoryActions = [], discovery = null } = {}) {
  const teamIds = teams.map((team) => team.id);
  const profileIds = profiles.map((profile) => profile.slug);
  const blueprintIds = blueprints.filter((blueprint) => !blueprint.archived).map((blueprint) => blueprint.id);
  const editableBlueprintIds = blueprints.filter((blueprint) => blueprint.id !== "generic" && !blueprint.archived && !blueprint.legacy).map((blueprint) => blueprint.id);
  const archivedBlueprintIds = blueprints.filter((blueprint) => blueprint.archived).map((blueprint) => blueprint.id);
  const legacyBlueprintIds = blueprints.filter((blueprint) => blueprint.legacy).map((blueprint) => blueprint.id);
  const actions = [
    action({
      id: "operator.ingest",
      scope: "factory",
      label: "Ingerir ideia ou plano",
      description: "Lê texto, arquivo, pasta ou URL e cria uma room com proposta de tese para confirmação humana.",
      risk: "guarded",
      expectedEffect: "Persiste a decisão de intake, a room e a proposta; nunca cria profile, blueprint ou pipeline.",
      fields: [field("source", "Ideia, caminho ou URL", "textarea", { required: true })],
    }),
    action({
      id: "operator.evolve",
      scope: "factory",
      label: "Evoluir o próprio Forge",
      description: "Transforma uma proposta em change plan; só executa o coding agent após aprovação explícita.",
      risk: "guarded",
      expectedEffect: "Sem aprovação apenas grava a proposta; com aprovação inicia um agente auditável no repositório do Forge.",
      fields: [
        field("source", "Proposta, caminho ou URL", "textarea", { required: true }),
        field("executor", "Executor", "select", { required: true, options: ["codex", "grok", "claude", "gemini"] }),
        field("maxTurns", "Máximo de turnos", "number"),
        field("reviewOnly", "Somente propor", "checkbox"),
        field("dryRun", "Dry-run", "checkbox"),
        field("approved", "Proposta revisada e aprovada", "checkbox"),
      ],
    }),
    ...[
      ["room.create", "Criar room", "safe", [field("title", "Título", "text", { required: true }), field("sourceRef", "Fonte", "text")]],
      ["room.message", "Adicionar mensagem", "safe", [field("roomId", "Room", "text", { required: true }), field("author", "Autor", "text", { required: true }), field("text", "Mensagem", "textarea", { required: true }), field("executor", "Executor", "text")]],
      ["thesis.propose", "Propor tese", "guarded", [field("roomId", "Room", "text", { required: true }), field("draft", "Tese (JSON)", "json", { required: true }), field("sourceMessageIds", "Mensagens (JSON)", "json")]],
      ["thesis.confirm", "Confirmar tese", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["validation.start", "Iniciar validação", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("experimentId", "Experimento", "text", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["evidence.record", "Registrar evidência", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("evidence", "Evidência (JSON)", "json", { required: true })]],
      ["evidence.verify", "Verificar evidência", "guarded", [field("evidenceId", "Evidência", "text", { required: true }), field("actor", "Ator", "text", { required: true }), field("decision", "Decisão", "select", { required: true, options: ["verified", "rejected"] }), field("notes", "Notas", "textarea")]],
      ["experiment.create", "Criar experimento", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("experiment", "Experimento (JSON)", "json", { required: true })]],
      ["experiment.complete", "Concluir experimento", "guarded", [field("experimentId", "Experimento", "text", { required: true }), field("evidenceIds", "Evidências (JSON)", "json"), field("interpretation", "Interpretação", "textarea", { required: true }), field("decision", "Decisão", "text", { required: true })]],
      ["build.propose", "Propor build", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("brief", "Brief (JSON)", "json", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["discovery.build.start", "Iniciar build aprovado", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("startOptions", "Opções (JSON)", "json"), field("actor", "Ator", "text", { required: true })]],
      ["build.complete", "Concluir build mínimo", "guarded", [field("buildId", "Build", "text", { required: true }), field("url", "URL", "text"), field("artifact", "Artefato", "text"), field("instrumentationObserved", "Instrumentação observada", "checkbox", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["build.terminate", "Terminar build mínimo", "guarded", [field("buildId", "Build", "text", { required: true }), field("status", "Estado terminal", "select", { required: true, options: ["killed", "failed"] }), field("reason", "Motivo", "textarea", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["experiment.validation_asset.attach", "Anexar asset de validação", "guarded", [field("experimentId", "Experimento", "text", { required: true }), field("asset", "Asset (JSON)", "json", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["braga.prepare", "Preparar handoff Braga", "guarded", [field("thesisId", "Tese", "text", { required: true }), field("experimentId", "Experimento", "text", { required: true }), field("testedMessage", "Mensagem testada", "textarea", { required: true }), field("assets", "Assets (JSON)", "json"), field("events", "Eventos (JSON)", "json", { required: true }), field("baseline", "Baseline (JSON)", "json", { required: true }), field("timebox", "Timebox", "text", { required: true }), field("budget", "Orçamento (JSON)", "json", { required: true }), field("legalRestrictions", "Restrições legais (JSON)", "json", { required: true })]],
      ["braga.export", "Exportar handoff Braga", "guarded", [field("handoffId", "Handoff", "text", { required: true }), field("target", "Caminho local", "text", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["acquisition.start", "Iniciar aquisição", "external", [field("thesisId", "Tese", "text", { required: true }), field("experimentId", "Experimento", "text", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["acquisition.complete", "Concluir aquisição", "guarded", [field("acquisitionId", "Aquisição", "text", { required: true }), field("reason", "Resultado", "textarea", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["acquisition.terminate", "Terminar aquisição", "guarded", [field("acquisitionId", "Aquisição", "text", { required: true }), field("reason", "Motivo", "textarea", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["spend.approve", "Aprovar gasto", "external", [field("experimentId", "Experimento", "text", { required: true }), field("requested", "Solicitado", "number", { required: true }), field("ceiling", "Teto", "number", { required: true }), field("why", "Justificativa", "textarea", { required: true }), field("actor", "Ator", "text", { required: true }), field("confirmed", "Confirmo o teto", "checkbox", { required: true })]],
      ["braga.return.import", "Importar retorno Braga", "guarded", [field("result", "Retorno (JSON)", "json", { required: true }), field("actor", "Ator", "text", { required: true })]],
      ["chat.send", "Enviar mensagem", "safe", [field("roomId", "Room", "text", { required: true }), field("text", "Mensagem", "textarea", { required: true }), field("playerId", "Executor", "select", { required: true, options: executors.map(executor => executor.id) }), field("maxTurns", "Máximo de turnos", "number"), field("resumeToken", "Token de resume", "text")]],
      ["chat.stop", "Parar chat", "guarded", [field("runId", "Run", "text", { required: true })]],
      ["playbook.run", "Executar playbook", "guarded", [field("playbookId", "Playbook", "select", { required: true, options: ["pressure-test", "pain-signal-miner", "first-customer-finder", "startup-user-simulator", "design-audit"] }), field("thesisId", "Tese", "text", { required: true }), field("playerId", "Executor", "select", { required: true, options: executors.map(executor => executor.id) }), field("input", "Entrada (JSON)", "json", { required: true })]],
      ["playbook.import", "Importar saída validada", "guarded", [field("localRunId", "Run local", "text", { required: true }), field("thesisId", "Tese", "text", { required: true })]],
      ["playbook.revise", "Propor revisão de playbook", "guarded", [field("playbookId", "Playbook", "select", { required: true, options: ["pressure-test", "pain-signal-miner", "first-customer-finder", "startup-user-simulator", "design-audit"] }), field("actor", "Ator", "text", { required: true }), field("content", "Novo conteúdo", "textarea", { required: true }), field("reason", "Motivo", "textarea", { required: true })]],
    ].map(([id, label, risk, fields]) => action({
      id,
      scope: "factory",
      label,
      description: "Ação discovery-first controlada pelo estado canônico.",
      risk,
      enabled: Boolean(discovery),
      blockedReason: "DiscoveryWorkspace não configurado.",
      expectedEffect: "Atualiza o DiscoveryWorkspace e incrementa sua revision.",
      fields,
    })),
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
      id: "blueprint.save",
      scope: "factory",
      label: "Criar ou versionar blueprint",
      description: "Salva um contrato imutável e aponta o manifesto para a nova versão.",
      risk: "guarded",
      expectedEffect: "Cria uma versão content-addressed sem apagar versões anteriores.",
      fields: [
        field("id", "ID existente (opcional)", "text"),
        field("name", "Nome", "text", { required: true }),
        field("title", "Título", "text", { required: true }),
        field("purpose", "Propósito", "textarea"),
        field("jobs", "Jobs (um por linha)", "textarea", { required: true }),
        field("jobSpecs", "Contrato dos jobs (JSON)", "textarea", { required: true }),
        field("reason", "Motivo da versão", "text"),
      ],
    }),
    action({
      id: "blueprint.derive",
      scope: "factory",
      label: "Derivar blueprint",
      description: "Cria um novo blueprint mantendo a linhagem da versão de origem.",
      risk: "guarded",
      enabled: editableBlueprintIds.length > 0,
      blockedReason: "Crie ou migre um blueprint versionado antes de derivar.",
      expectedEffect: "Cria um contrato independente com referência imutável à origem.",
      fields: [
        field("source", "Blueprint de origem", "select", { required: true, options: editableBlueprintIds }),
        field("name", "Nome", "text", { required: true }),
        field("title", "Título", "text", { required: true }),
        field("purpose", "Propósito", "textarea"),
        field("jobs", "Jobs (um por linha)", "textarea", { required: true }),
        field("jobSpecs", "Contrato dos jobs (JSON)", "textarea", { required: true }),
      ],
    }),
    action({
      id: "blueprint.archive",
      scope: "factory",
      label: "Arquivar blueprint",
      description: "Retira um blueprint das novas pipelines sem apagar seu histórico.",
      risk: "guarded",
      enabled: editableBlueprintIds.length > 0,
      blockedReason: "Nenhum blueprint editável disponível.",
      expectedEffect: "Mantém todas as versões e oculta o contrato de novos starts.",
      fields: [field("blueprint", "Blueprint", "select", { required: true, options: editableBlueprintIds })],
    }),
    action({
      id: "blueprint.restore",
      scope: "factory",
      label: "Restaurar blueprint",
      description: "Recoloca um blueprint arquivado entre as opções ativas.",
      risk: "safe",
      enabled: archivedBlueprintIds.length > 0,
      blockedReason: "Nenhum blueprint arquivado.",
      expectedEffect: "Reativa o manifesto sem alterar a versão ativa.",
      fields: [field("blueprint", "Blueprint", "select", { required: true, options: archivedBlueprintIds })],
    }),
    action({
      id: "blueprint.migrate",
      scope: "factory",
      label: "Migrar blueprint legado",
      description: "Converte blueprint.json antigo no contrato versionado genérico.",
      risk: "guarded",
      enabled: legacyBlueprintIds.length > 0,
      blockedReason: "Nenhum blueprint legado precisa de migração.",
      expectedEffect: "Preserva jobs e cria manifesto mais primeira versão imutável.",
      fields: [field("blueprint", "Blueprint", "select", { required: true, options: legacyBlueprintIds })],
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
        field("fallbackPolicy", "Política de falha", "select", { required: true, options: ["strict", "fallback"] }),
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
  const deploymentByApp = new Map(deployments.map((entry) => [entry.appId, entry]));
  const actionApps = new Set();
  actions.push(...memoryActions);

  function addLifecycleActions(appId, pipelineStatus = "idle") {
    if (!appId || actionApps.has(appId)) return;
    actionApps.add(appId);
    const scope = `pipeline:${appId}`;
    const state = lifecycleByApp.get(appId);
    const deployment = deploymentByApp.get(appId);
    const canMeasure = !["running", "paused_gate", "paused_control", "blocked"].includes(pipelineStatus);
    const canDeploy = pipelineStatus === "done" || state?.p5?.decision === "scale";
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
          field("nextHypothesis", "Próxima hipótese", "textarea"),
          field("ceiling", "Teto de escala", "number"),
          field("measurementDate", "Data da próxima medição", "text"),
          field("team", "Time da iteração", "select", { options: teamIds }),
          field("dryRun", "Iterar em dry-run", "checkbox"),
          field("controlMode", "Modo de controle", "select", { options: ["full_auto", "autopilot_to_gate", "guided", "manual"] }),
        ],
      }),
      action({
        id: "always-on.prepare",
        scope,
        label: "Preparar deploy Always-On",
        description: "Define identidade, origem, exposição, persistência, workload, SLO e health sem executar PowerShell.",
        risk: "guarded",
        enabled: canDeploy && (!deployment || deployment.status === "prepared"),
        blockedReason: !canDeploy ? "Conclua o ship ou decida scale no P5 antes do deploy." : `Deploy já avançou para ${deployment?.status}.`,
        expectedEffect: "Persiste um request privado para a skill $always-on-deploy; nada é publicado nesta etapa.",
        fields: [
          field("sourceRoot", "Source root", "text", { required: true, help: `Precisa apontar para apps/${appId}.` }),
          field("visibility", "Exposição", "select", { required: true, options: ["private", "public"] }),
          field("hostname", "Hostname público", "text"),
          field("startCommand", "Comando de start", "text", { required: true }),
          field("migrationCommand", "Comando de migration", "text"),
          field("persistentData", "Dados persistentes", "textarea", { required: true }),
          field("workload", "Workload esperado", "textarea", { required: true }),
          field("slo", "SLO", "textarea", { required: true }),
          field("healthCheck", "Health check", "text", { required: true }),
          field("actor", "Ator", "text", { required: true }),
        ],
      }),
      action({
        id: "always-on.confirm",
        scope,
        label: "Confirmar request Always-On",
        description: "Revisão humana explícita antes da publicação operacional.",
        risk: "guarded",
        enabled: deployment?.status === "prepared",
        blockedReason: "Prepare o request Always-On antes de confirmar.",
        expectedEffect: "Congela a intenção revisada; ainda não executa nem publica nada.",
        fields: [
          field("why", "Motivo da confirmação", "textarea", { required: true }),
          field("reviewed", "Revisei exposição, dados, workload e SLO", "checkbox", { required: true }),
          field("actor", "Ator", "text", { required: true }),
        ],
      }),
      action({
        id: "always-on.publish.record",
        scope,
        label: "Registrar publicação Always-On",
        description: "Importa a evidência produzida externamente pela skill $always-on-deploy.",
        risk: "external",
        enabled: deployment?.status === "confirmed",
        blockedReason: "Confirme o request antes de registrar a publicação externa.",
        expectedEffect: "Registra revision, release, tasks e evidências; o Forge não executa o deploy privilegiado.",
        fields: [
          field("revision", "Revision publicada", "text", { required: true }),
          field("releasePath", "Release path", "text", { required: true }),
          field("tasks", "Tasks publicadas", "textarea", { required: true }),
          field("healthUrl", "Health URL", "text"),
          field("capacityEvidence", "Evidência de capacidade", "textarea", { required: true }),
          field("rollbackEvidence", "Evidência de rollback", "textarea", { required: true }),
          field("actor", "Ator", "text", { required: true }),
        ],
      }),
      action({
        id: "always-on.verify",
        scope,
        label: "Verificar deploy Always-On",
        description: "Fecha health, ownership, rota externa, capacidade e rollback sem esconder pendências.",
        risk: "guarded",
        enabled: ["published", "verified"].includes(deployment?.status),
        blockedReason: "Registre primeiro a evidência de publicação da skill Always-On.",
        expectedEffect: "Marca verified e mantém capacity/rollback pendentes quando não foram medidos ou testados.",
        fields: [
          field("localHealth", "Health local", "select", { required: true, options: ["pass", "fail"] }),
          field("ownership", "Ownership", "select", { required: true, options: ["pass", "fail"] }),
          field("externalHealth", "Health externo", "select", { required: true, options: ["pass", "fail", "not-applicable"] }),
          field("capacity", "Capacidade", "select", { required: true, options: ["pass", "fail", "not-measured"] }),
          field("rollback", "Rollback", "select", { required: true, options: ["pass", "fail", "not-tested"] }),
          field("notes", "Notas", "textarea"),
          field("actor", "Ator", "text", { required: true }),
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
        enabled: ["done", "killed"].includes(status),
        blockedReason: "Feedback de produto fica disponível quando a pipeline termina ou foi morta no ship.",
        expectedEffect: "Inicia o job ITERATE e volta ao gate de deploy.",
        fields: [field("feedback", "O que deve mudar?", "textarea", { required: true })],
      }),
      action({
        id: "pipeline.simulate",
        scope,
        label: "Simular cinco clientes",
        description: "Avalia a experiência pronta, gera JSON+HTML e permite no máximo uma rodada automática segura.",
        risk: "guarded",
        enabled: ["done", "killed"].includes(status),
        blockedReason: "A simulação manual fica disponível quando a pipeline termina ou foi morta no ship.",
        expectedEffect: "Executa SIMULATE; fixes reversíveis e de alta confiança passam uma vez por ITERATE → B5 antes do gate de deploy.",
        fields: [
          field("team", "Time", "select", { options: teamIds }),
          field("dryRun", "Dry-run", "checkbox"),
          field("controlMode", "Modo de controle", "select", { options: ["full_auto", "autopilot_to_gate", "guided", "manual"] }),
        ],
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
        expectedEffect: "Aplica o novo modo; full_auto resolve um gate local pendente quando houver evidência e retoma a pipeline.",
        fields: [
          field("mode", "Modo", "select", {
            required: true,
            options: ["full_auto", "autopilot_to_gate", "guided", "manual"],
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
        enabled: true,
        blockedReason: "",
        expectedEffect: "A próxima tentativa de P3 usa o target escolhido (cf-pages / cf-workers / gh-pages).",
        fields: [
          field("target", "Target", "select", { required: true, options: ["cf-pages", "cf-workers", "gh-pages"] }),
          field("subdomain", "Subdomínio", "text"),
        ],
      }),
      action({
        id: "pipeline.ship",
        scope,
        label: "Reviver e deployar (P3)",
        description: "Reabre só o ship de um app morto ou concluído — sem refazer P0–B5. Cloudflare em gbbragadev.com.",
        risk: "guarded",
        enabled: ["killed", "done", "error"].includes(status),
        blockedReason: "Só para pipelines killed/done/error. Se estiver rodando, use o gate de deploy.",
        expectedEffect: "Cria gate de deploy; no go executa P3 (cf-workers ou cf-pages).",
        fields: [
          field("target", "Target", "select", { options: ["cf-workers", "cf-pages", "gh-pages"] }),
          field("subdomain", "Subdomínio (opcional)", "text"),
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
