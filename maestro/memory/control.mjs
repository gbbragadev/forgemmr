function field(name, label, type, { required = false, options = [] } = {}) {
  return { name, label, type, required, options };
}

function action({ id, label, description, risk, enabled = true, blockedReason = null, expectedEffect, fields = [] }) {
  return {
    id,
    scope: "factory",
    label,
    description,
    risk,
    enabled: Boolean(enabled),
    blockedReason: enabled ? null : blockedReason || "Ação de memória indisponível.",
    expectedEffect,
    fields,
  };
}

export function createMemoryActions(status = {}) {
  const healthy = status.state === "healthy";
  return [
    action({
      id: "memory.setup",
      label: "Configurar memória",
      description: "Instala a release verificada e inicia o serviço local de memória.",
      risk: "guarded",
      enabled: !healthy,
      blockedReason: "A memória já está saudável.",
      expectedEffect: "Baixa o runtime pinado, valida checksum e inicia somente em loopback.",
    }),
    action({
      id: "memory.retry",
      label: "Tentar novamente",
      description: "Refaz o health e reinicia somente o processo gerenciado quando necessário.",
      risk: "safe",
      enabled: !healthy,
      blockedReason: "A memória já está saudável.",
      expectedEffect: "Recupera o serviço sem alterar páginas ou decisões.",
    }),
    action({
      id: "memory.update",
      label: "Verificar atualização",
      description: "Revalida a versão pinada antes de qualquer troca de runtime.",
      risk: "external",
      expectedEffect: "Mantém a versão atual quando não existe atualização aprovada.",
    }),
    action({
      id: "memory.backup",
      label: "Criar backup",
      description: "Gera um snapshot privado da base e da wiki.",
      risk: "guarded",
      enabled: healthy,
      blockedReason: "Configure e recupere a memória antes do backup.",
      expectedEffect: "Grava um arquivo datado no diretório privado do Forge Nexus.",
    }),
    action({
      id: "memory.reindex",
      label: "Reconstruir índice",
      description: "Para o processo gerenciado, reconstrói o índice e reinicia com health.",
      risk: "destructive",
      enabled: healthy && Boolean(status.managed),
      blockedReason: "Reindex exige um ai-memory saudável e gerenciado por esta central.",
      expectedEffect: "Reconstrói derivados a partir da wiki preservada.",
    }),
    action({
      id: "memory.rule.write",
      label: "Promover regra",
      description: "Registra uma regra explícita; observações nunca viram regra sozinhas.",
      risk: "guarded",
      enabled: healthy,
      blockedReason: "Configure a memória antes de promover regras.",
      expectedEffect: "Cria uma página procedural rastreável e fixada.",
      fields: [
        field("appId", "App (vazio = fábrica)", "text"),
        field("summary", "Regra", "textarea", { required: true }),
        field("evidenceRefs", "Evidências (uma por linha)", "textarea"),
        field("sensitivity", "Sensibilidade", "select", { options: ["public", "internal", "restricted"] }),
      ],
    }),
    action({
      id: "memory.page.delete",
      label: "Excluir página",
      description: "Remove uma página específica depois de confirmação reforçada.",
      risk: "destructive",
      enabled: healthy,
      blockedReason: "Configure a memória antes de excluir páginas.",
      expectedEffect: "Exclui apenas a página validada dentro do escopo escolhido.",
      fields: [
        field("appId", "App (vazio = fábrica)", "text"),
        field("pagePath", "Página relativa", "text", { required: true }),
      ],
    }),
  ];
}

export function createMemoryActionHandlers(service) {
  return {
    "memory.setup": () => service.setup(),
    "memory.retry": () => service.retry(),
    "memory.update": () => service.update(),
    "memory.backup": () => service.backup(),
    "memory.reindex": () => service.reindex(),
    "memory.rule.write": ({ input }) => service.writeRule({
      appId: input.appId || undefined,
      summary: input.summary,
      evidenceRefs: String(input.evidenceRefs || "")
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      sensitivity: input.sensitivity || "internal",
    }),
    "memory.page.delete": ({ input }) => service.deletePage({
      appId: input.appId || undefined,
      pagePath: input.pagePath,
    }),
  };
}
