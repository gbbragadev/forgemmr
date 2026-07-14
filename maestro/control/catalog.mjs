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
export function createActionCatalog({ pipelines = [], teams = [], profiles = [], blueprints = [] } = {}) {
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
  ];

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
  }

  return actions;
}
