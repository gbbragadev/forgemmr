export const STAGES = [
  {
    id: "idea",
    code: "IDEIA",
    title: "Comece pelo problema",
    summary: "Descreva a dor, o comprador e o resultado esperado. Ideia vaga produz app genérico.",
    output: "Brief estruturado",
    owner: "Dono",
    gate: null,
  },
  {
    id: "p0",
    code: "L0/P0",
    title: "Prove que alguém paga",
    summary: "Score, mercado, canal, preço e recorrência antes de gastar uma linha de build.",
    output: "Scorecard + Mercado",
    owner: "Grok / Gemini",
    gate: "p0-go",
  },
  {
    id: "foundation",
    code: "FOUNDATION",
    title: "Feche a arquitetura",
    summary: "Stack, fronteiras, riscos e o caminho mais curto até uma entrega verificável.",
    output: "system-design.md",
    owner: "Agente de arquitetura",
    gate: null,
  },
  {
    id: "ds-gen",
    code: "DS-GEN",
    title: "Explore a direção visual",
    summary: "Três direções comparáveis. O dono escolhe gosto; o agente não adivinha.",
    output: "3 propostas visuais",
    owner: "GLM",
    gate: "b3-visual",
  },
  {
    id: "p1",
    code: "L0/P1",
    title: "Prepare aquisição e CTA",
    summary: "Hooks, oferta e métrica de intenção antes de escalar complexidade.",
    output: "15 hooks + CTA",
    owner: "Grok / Gemini",
    gate: null,
  },
  {
    id: "build",
    code: "L1/B1…B5",
    title: "Construa e verifique",
    summary: "Scaffold, conteúdo, visual, API e ship-check com retry e rollback objetivos.",
    output: "App + build/typecheck",
    owner: "Time escolhido",
    gate: null,
  },
  {
    id: "ship",
    code: "P3",
    title: "Publique com autorização",
    summary: "Target correto, build verde e smoke real. A URL é evidência, não decoração.",
    output: "URL + smoke",
    owner: "CI / operador",
    gate: "deploy",
  },
  {
    id: "measure",
    code: "P4",
    title: "Meça comportamento real",
    summary: "Registre visitas, ativação, conversão, receita e custo. Zero também é dado.",
    output: "Resultado P4",
    owner: "Humano",
    gate: null,
  },
  {
    id: "decide",
    code: "P5",
    title: "Mate ou escale",
    summary: "Continue só quando os sinais justificarem manutenção e próxima aposta.",
    output: "Decisão registrada",
    owner: "Dono",
    gate: null,
  },
];

export const TEAMS = [
  {
    id: "dry-run",
    title: "Dry-run",
    quota: "zero",
    use: "aprender, validar a fábrica e ensaiar gates",
    signal: "Seu primeiro run",
  },
  {
    id: "grok-solo",
    title: "Solo",
    quota: "baixa",
    use: "jobs diretos com pouco handoff",
    signal: "Velocidade",
  },
  {
    id: "grok-glm-front",
    title: "Produto + visual",
    quota: "média",
    use: "build com especialista de UI no momento certo",
    signal: "App com apelo",
  },
  {
    id: "quality",
    title: "Quality",
    quota: "alta",
    use: "revisão adversarial e entregas críticas",
    signal: "Confiança antes do ship",
  },
];

export const COMMANDS = [
  {
    command: "npm run forge -- profile init",
    category: "start",
    intent: "Criar o perfil da fábrica",
    keywords: "configuração nicho stack idiomas contexto",
    note: "Faça uma vez por fábrica ou quando o nicho mudar de verdade.",
  },
  {
    command: "npm run forge -- profile show",
    category: "start",
    intent: "Conferir o perfil ativo",
    keywords: "configuração nicho stack contexto",
    note: "Use antes de culpar o executor por contexto errado.",
  },
  {
    command: "npm run forge -- team",
    category: "start",
    intent: "Montar um time na TUI",
    keywords: "players modelos effort funções provedor",
    note: "O wizard grava o time no roster sem editar JSON à mão.",
  },
  {
    command: "npm run forge -- new \"minha ideia\" --team dry-run --dry-run",
    category: "start",
    intent: "Rodar a primeira pipeline sem quota",
    keywords: "pipeline teste seguro fake ensaio",
    note: "O executor fake gera os artefatos esperados e para nos mesmos gates.",
  },
  {
    command: "npm run forge -- new --idea-file ideia.md --team grok-glm-front",
    category: "start",
    intent: "Enviar uma ideia longa e estruturada",
    keywords: "brief markdown contexto completo",
    note: "O nome do arquivo ajuda a derivar o app-id.",
  },
  {
    command: "npm run forge -- new \"campanha\" --blueprint gameads --slug campanha",
    category: "start",
    intent: "Criar projeto por blueprint",
    keywords: "gameads scaffold campanha",
    note: "Use quando o fluxo exige intake e artefatos próprios do blueprint.",
  },
  {
    command: "npm run forge -- onboard campanha",
    category: "start",
    intent: "Rodar intake e discovery do blueprint",
    keywords: "brief review descoberta",
    note: "Produz brief e pausa no gate de revisão.",
  },
  {
    command: "npm run forge -- attach meu-app",
    category: "observe",
    intent: "Acompanhar um app na TUI",
    keywords: "tempo real logs terminal",
    note: "Sem app-id, lista quando há mais de uma pipeline.",
  },
  {
    command: "npm run forge -- status",
    category: "observe",
    intent: "Ver todas as pipelines",
    keywords: "snapshot estado gates jobs",
    note: "Boa primeira resposta para ‘o que está rodando?’. Muito civilizado.",
  },
  {
    command: "npm run forge -- stats",
    category: "observe",
    intent: "Ler métricas e falhas reais",
    keywords: "PASS duração mortes métricas taxa",
    note: "Mostra taxa por player/job, duração e causas de morte.",
  },
  {
    command: "npm run forge -- roster",
    category: "observe",
    intent: "Listar players e times",
    keywords: "provedores equipes modelos",
    note: "Leia antes de criar outro time igual com nome diferente.",
  },
  {
    command: "npm run forge -- decide p0-go go --app meu-app",
    category: "decide",
    intent: "Responder a um gate",
    keywords: "go kill retry feedback humano",
    note: "A decisão fica registrada no estado da pipeline.",
  },
  {
    command: "npm run forge -- target meu-app cf-pages",
    category: "decide",
    intent: "Trocar o alvo de deploy",
    keywords: "workers gh-pages cloudflare pages domínio",
    note: "Troca o target sem recomeçar a ideia.",
  },
  {
    command: "npm run forge -- feedback meu-app \"melhore o onboarding\"",
    category: "iterate",
    intent: "Iterar um app publicado",
    keywords: "redeploy melhoria feedback visual",
    note: "Abre ITERATE, volta a verificar e para novamente no deploy.",
  },
  {
    command: "npm run forge -- stop meu-app",
    category: "recover",
    intent: "Pausar o job atual",
    keywords: "parar executor pausa",
    note: "Mata o processo do job e cria uma decisão de recuperação.",
  },
  {
    command: "npm run forge -- resume meu-app",
    category: "recover",
    intent: "Retomar a pipeline",
    keywords: "continuar restart pausa",
    note: "Retoma quando não há gate humano pendente.",
  },
  {
    command: "npm run forge -- restart",
    category: "recover",
    intent: "Recarregar o Maestro com segurança",
    keywords: "server código reiniciar",
    note: "Recusa por padrão se houver job vivo.",
  },
  {
    command: "npm run forge -- kill meu-app",
    category: "recover",
    intent: "Encerrar um run sem saída",
    keywords: "matar bloquear executor",
    note: "Encerra run e executor; não apaga o app.",
  },
  {
    command: "npm run forge -- remove meu-app --force",
    category: "danger",
    intent: "Apagar app e estado",
    keywords: "destrutivo irreversível produção apagar",
    note: "Confirme o app-id três vezes. Remove repo, pipeline e propostas.",
  },
];

export const GATES = {
  "p0-go": {
    title: "O mercado justifica build?",
    description: "Leia comprador, canal, preço e recorrência antes de decidir.",
    go: {
      label: "GO — avançar",
      effect: "A ideia avança para fundação e conteúdo.",
      command: "npm run forge -- decide p0-go go --app meu-app",
    },
    kill: {
      label: "KILL — encerrar",
      effect: "A ideia é encerrada antes de consumir build.",
      command: "npm run forge -- decide p0-go kill --app meu-app",
    },
  },
  "b3-visual": {
    title: "A direção visual está certa?",
    description: "Gosto é decisão humana. Dê feedback específico quando não estiver.",
    go: {
      label: "GO — aprovar",
      effect: "A direção visual aprovada segue para build.",
      command: "npm run forge -- decide b3-visual go --app meu-app",
    },
    retry: {
      label: "RETRY — refazer",
      effect: "O executor recebe feedback e refaz a proposta.",
      command: "npm run forge -- decide b3-visual retry \"feedback visual\" --app meu-app",
    },
  },
  deploy: {
    title: "É hora de publicar?",
    description: "Confirme target, build e smoke esperado antes de autorizar.",
    go: {
      label: "GO — publicar",
      effect: "O target configurado recebe o build após as verificações.",
      command: "npm run forge -- decide deploy go --app meu-app",
    },
    kill: {
      label: "KILL — não publicar",
      effect: "O app não publica; artefatos locais permanecem para revisão.",
      command: "npm run forge -- decide deploy kill --app meu-app",
    },
  },
};

export function filterCommands(query = "", category = "all") {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return COMMANDS.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    const haystack = `${item.command} ${item.intent} ${item.keywords} ${item.note}`.toLocaleLowerCase("pt-BR");
    return matchesCategory && haystack.includes(needle);
  });
}

export function resolveGate(gateId, decision) {
  const gate = GATES[gateId];
  if (!gate) throw new Error(`gate desconhecido: ${gateId}`);
  const outcome = gate[decision];
  if (!outcome || typeof outcome === "string") throw new Error(`decisão ${decision} não existe em ${gateId}`);
  return outcome;
}
