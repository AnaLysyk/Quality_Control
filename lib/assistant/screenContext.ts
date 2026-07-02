import type { AssistantContextEntityType, AssistantModule, AssistantScreenContext } from "@/lib/assistant/types";

function extractCompanySlug(route: string) {
  const match = route.match(/^\/empresas\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

type ScreenContextRule = {
  match: RegExp | ((route: string) => boolean);
  module: AssistantModule;
  screenLabel: string;
  screenSummary: string;
  entityType: AssistantContextEntityType;
  entityId?: (companySlug: string | null) => string | null;
  suggestedPrompts: string[];
};

const PROFILE_HELP_PROMPTS = [
  "Me ajuda com meu perfil nesta tela",
  "O que eu posso fazer aqui com meu acesso?",
  "Explique a prÃ³xima aÃ§Ã£o segura",
  "Mostre o contexto permitido pelo meu perfil",
];

const SCREEN_CONTEXT_RULES: ScreenContextRule[] = [
  {
    match: /^\/dashboard(?:\/|$)/,
    module: "dashboard",
    screenLabel: "VisÃ£o geral TC",
    screenSummary: [
      "VocÃª estÃ¡ em: VisÃ£o geral TC.",
      "Esta Ã© a camada executiva da Testing Company para LÃ­der TC e Suporte TÃ©cnico acompanharem qualidade por empresa, risco, projetos, defeitos, runs, cobertura e prÃ³ximos passos consultivos.",
      "Como agente, devo ajudar por perfil: lideranÃ§a recebe visÃ£o executiva e priorizaÃ§Ã£o; suporte recebe triagem tÃ©cnica; empresa recebe apenas o prÃ³prio contexto permitido.",
      "O Brain possui nÃ³s executivos como VisÃ£o Geral TC, Empresas atendidas, Projetos e operaÃ§Ã£o, RepositÃ³rio de Casos, Defeitos, Planos, Runs, Qase, Perfis e Chat por perfil.",
      "Dica: use esta visÃ£o para destravar a operaÃ§Ã£o e transformar risco em aÃ§Ã£o.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Gerar resumo executivo da carteira",
      "Quais empresas precisam de aÃ§Ã£o imediata?",
      "Abrir nÃ³s executivos no Brain",
      "Montar plano de atuaÃ§Ã£o para suporte tÃ©cnico",
      ...PROFILE_HELP_PROMPTS,
    ],
  },
  {
    match: /^\/(?:admin\/brain|admin\/sistema\/mapa|brain)(?:\/|$)/,
    module: "brain",
    screenLabel: "Brain contextual",
    screenSummary: [
      "VocÃª estÃ¡ em: Brain contextual.",
      "Aqui vocÃª consulta nÃ³s de produto, empresa, projeto, QA, casos, defeitos, runs, planos, automaÃ§Ã£o, permissÃµes, decisÃµes e visÃ£o executiva TC.",
      "Como agente, devo explicar relaÃ§Ãµes do grafo, contextualizar o nÃ³ selecionado, respeitar RBAC e indicar a prÃ³xima aÃ§Ã£o por perfil.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Explicar o nÃ³ selecionado",
      "Mostrar nÃ³s executivos da TC",
      "Relacionar este nÃ³ com empresas e projetos",
      "Sugerir prÃ³xima aÃ§Ã£o como agente",
      ...PROFILE_HELP_PROMPTS,
    ],
  },
  {
    match: /^\/(?:admin\/support|kanban-it)/,
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: [
      "VocÃª estÃ¡ em: Kanban global de suporte.",
      "Aqui vocÃª prioriza, atribui responsÃ¡vel, acompanha SLA e avanÃ§a status dos chamados.",
      "Como agente, posso localizar chamados, explicar bloqueios, sugerir prioridade e preparar a prÃ³xima aÃ§Ã£o conforme seu RBAC.",
      "Dica: comece pelo chamado mais crÃ­tico ou pelo SLA mais prÃ³ximo de vencer.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar chamado por cÃ³digo", "Explicar o que posso fazer nesta tela", "Sugerir prÃ³xima aÃ§Ã£o como agente", "Listar chamados pendentes", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/meus-chamados/,
    module: "support",
    screenLabel: "Meus chamados",
    screenSummary: [
      "VocÃª estÃ¡ em: Meus chamados.",
      "Aqui vocÃª acompanha status, comenta e pede ajustes nos seus chamados.",
      "Como agente, posso resumir andamento, preparar comentÃ¡rio, avaliar impacto e orientar o melhor prÃ³ximo passo.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar meu chamado por cÃ³digo", "Explicar o que posso fazer nesta tela", "Preparar comentÃ¡rio para chamado", "Listar chamados em andamento", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/admin\/users\/permissions/,
    module: "permissions",
    screenLabel: "GestÃ£o de Perfis",
    screenSummary: [
      "VocÃª estÃ¡ em: GestÃ£o de Perfis.",
      "Aqui a plataforma mantÃ©m a matriz de acesso por perfil: LÃ­der TC, Suporte TÃ©cnico, Empresa, UsuÃ¡rio da empresa e UsuÃ¡rio TC.",
      "Como agente, posso explicar permissÃµes, bloqueios, por que alguÃ©m vÃª ou nÃ£o vÃª uma tela, comparar perfis e sugerir ajuste seguro sem quebrar RBAC.",
    ].join(" "),
    entityType: "permission_profile",
    suggestedPrompts: ["Explicar bloqueio de permissÃ£o", "Comparar perfis", "Sugerir ajuste seguro de acesso", "Resumir permissÃµes do perfil atual", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: (route) => /^\/empresas\/[^/]+\/planos-de-teste/.test(route) || route.startsWith("/planos-de-teste") || route.startsWith("/casos-de-teste"),
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: [
      "VocÃª estÃ¡ em: Planos e casos de teste.",
      "Aqui vocÃª cria, importa, exporta e organiza casos com prÃ©-condiÃ§Ãµes, passos, resultado esperado, tags, suites, projeto Qase opcional e rastreabilidade.",
      "Como agente, posso transformar bug, ticket, requisito ou conversa em caso estruturado, revisar cobertura e explicar campos disponÃ­veis no sistema.",
    ].join(" "),
    entityType: "test_plan",
    suggestedPrompts: ["Gerar caso de teste a partir de bug", "Montar passos e resultado esperado", "Explicar modelo de importaÃ§Ã£o", "Listar lacunas de cobertura", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: (route) => /^\/empresas\/[^/]+/.test(route) || route.startsWith("/admin/clients") || route.startsWith("/empresas"),
    module: "company",
    screenLabel: "Empresa e operaÃ§Ã£o de qualidade",
    screenSummary: [
      "VocÃª estÃ¡ em: Empresa e operaÃ§Ã£o de qualidade.",
      "Aqui vocÃª acompanha dashboard, projetos, casos, defeitos, runs, planos, documentos, usuÃ¡rios e indicadores da empresa selecionada.",
      "Como agente, posso resumir a empresa, apontar risco, buscar registros, cruzar chamados e sugerir prÃ³xima aÃ§Ã£o dentro do escopo permitido.",
    ].join(" "),
    entityType: "company",
    entityId: (slug) => slug,
    suggestedPrompts: ["Resumir status atual da empresa", "Ver defeitos e bugs ativos", "Abrir projetos da operaÃ§Ã£o", "Sugerir prÃ³xima aÃ§Ã£o como agente", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/operacoes\/dashboard/,
    module: "dashboard",
    screenLabel: "Dashboard contextual",
    screenSummary: [
      "VocÃª estÃ¡ em: Dashboard contextual.",
      "Aqui a visÃ£o se monta por perfil, permissÃµes, empresas, aplicaÃ§Ãµes, mÃ³dulos, filtros e dados reais.",
      "Como agente, posso explicar grÃ¡ficos, comparar empresas, resumir riscos e priorizar aÃ§Ãµes.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Resumir dashboard atual", "O que estÃ¡ mais crÃ­tico?", "Comparar empresas selecionadas", "Gerar resumo executivo", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/operacao/,
    module: "operations",
    screenLabel: "Central de OperaÃ§Ãµes",
    screenSummary: [
      "VocÃª estÃ¡ em: Central de OperaÃ§Ãµes.",
      "Aqui vocÃª acompanha saÃºde operacional, runs, defeitos, automaÃ§Ãµes, integraÃ§Ãµes e riscos.",
      "Como agente, posso resumir riscos, priorizar aÃ§Ãµes, analisar runs bloqueadas e sugerir o prÃ³ximo movimento.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Resumir operaÃ§Ã£o atual", "O que estÃ¡ mais crÃ­tico?", "Priorizar prÃ³ximas aÃ§Ãµes", "Analisar runs bloqueadas", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/admin\/access-requests/,
    module: "permissions",
    screenLabel: "SolicitaÃ§Ãµes de acesso",
    screenSummary: [
      "VocÃª estÃ¡ em: Fila administrativa de solicitaÃ§Ãµes de acesso.",
      "Aqui vocÃª busca, filtra, visualiza, baixa PDF, confere dados e decide aprovaÃ§Ã£o, recusa ou ajuste.",
      "Comandos rÃ¡pidos: procure por nome, filtre por status, hoje, Ãºltimos 7 dias, Ãºltimas 2 horas ou Ãºltimos 30 dias.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar uma pessoa na fila", "Filtrar status rejeitado", "Filtrar status em aberto", "O que falta para aprovar?", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/(?:admin)/,
    module: "dashboard",
    screenLabel: "Painel administrativo",
    screenSummary: [
      "VocÃª estÃ¡ em: Painel administrativo.",
      "Aqui vocÃª gerencia a operaÃ§Ã£o da plataforma: solicitaÃ§Ãµes, usuÃ¡rios, permissÃµes, empresas, chamados, mÃ©tricas, Brain e logs.",
      "Como agente, posso explicar o que dÃ¡ para fazer, sugerir aÃ§Ã£o, buscar registros, preparar textos e executar fluxos permitidos pelo seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Explicar o que posso fazer aqui", "Sugerir prÃ³xima aÃ§Ã£o como agente", "Listar mÃ³dulos administrativos", "Buscar registro por palavra-chave", ...PROFILE_HELP_PROMPTS],
  },
];

const GENERAL_CONTEXT: Omit<ScreenContextRule, "match"> = {
  module: "general",
  screenLabel: "Plataforma Quality Control",
  screenSummary: [
    "VocÃª estÃ¡ em: Plataforma Quality Control.",
    "Aqui vocÃª navega, busca registros, cria chamados, acompanha qualidade ou entende seu contexto.",
    "Como agente, devo ajudar qualquer perfil dentro do seu escopo de acesso, explicando a tela, sugerindo prÃ³ximos passos e executando apenas aÃ§Ãµes permitidas pelo RBAC. Dica: diga o que deseja fazer e eu oriento o caminho seguro.",
  ].join(" "),
  entityType: "screen",
  suggestedPrompts: ["Me ajuda com meu perfil", "Resumir esta tela", "Explicar o que posso fazer aqui", "Buscar registro por palavra-chave", "Sugerir prÃ³xima aÃ§Ã£o como agente"],
};

export function resolveAssistantScreenContext(route: string): AssistantScreenContext {
  const normalizedRoute = (route || "/").trim() || "/";
  const companySlug = extractCompanySlug(normalizedRoute);
  const matched = SCREEN_CONTEXT_RULES.find((rule) => (typeof rule.match === "function" ? rule.match(normalizedRoute) : rule.match.test(normalizedRoute)));
  const rule = matched ?? GENERAL_CONTEXT;

  return {
    route: normalizedRoute,
    module: rule.module,
    screenLabel: rule.screenLabel,
    screenSummary: rule.screenSummary,
    entityType: rule.entityType,
    entityId: rule.entityId ? rule.entityId(companySlug) : null,
    companySlug,
    suggestedPrompts: rule.suggestedPrompts,
  };
}

