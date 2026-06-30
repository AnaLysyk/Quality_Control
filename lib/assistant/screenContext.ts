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
  "Explique a próxima ação segura",
  "Mostre o contexto permitido pelo meu perfil",
];

const SCREEN_CONTEXT_RULES: ScreenContextRule[] = [
  {
    match: /^\/dashboard(?:\/|$)/,
    module: "dashboard",
    screenLabel: "Visão geral TC",
    screenSummary: [
      "Você está em: Visão geral TC.",
      "Esta é a camada executiva da Testing Company para Líder TC e Suporte Técnico acompanharem qualidade por empresa, risco, projetos, defeitos, runs, cobertura e próximos passos consultivos.",
      "Como agente, devo ajudar por perfil: liderança recebe visão executiva e priorização; suporte recebe triagem técnica; empresa recebe apenas o próprio contexto permitido.",
      "O Brain possui nós executivos como Visão Geral TC, Empresas atendidas, Projetos e operações, Repositório de Casos, Defeitos, Planos, Runs, Qase, Perfis e Chat por perfil.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Gerar resumo executivo da carteira",
      "Quais empresas precisam de ação imediata?",
      "Abrir nós executivos no Brain",
      "Montar plano de atuação para suporte técnico",
      ...PROFILE_HELP_PROMPTS,
    ],
  },
  {
    match: /^\/(?:admin\/brain|admin\/sistema\/mapa|brain)(?:\/|$)/,
    module: "brain",
    screenLabel: "Brain contextual",
    screenSummary: [
      "Você está em: Brain contextual.",
      "Aqui você consulta nós de produto, empresa, projeto, QA, casos, defeitos, runs, planos, automação, permissões, decisões e visão executiva TC.",
      "Como agente, devo explicar relações do grafo, contextualizar o nó selecionado, respeitar RBAC e indicar a próxima ação por perfil.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Explicar o nó selecionado",
      "Mostrar nós executivos da TC",
      "Relacionar este nó com empresas e projetos",
      "Sugerir próxima ação como agente",
      ...PROFILE_HELP_PROMPTS,
    ],
  },
  {
    match: /^\/(?:admin\/support|kanban-it)/,
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: [
      "Você está em: Kanban global de suporte.",
      "Aqui você prioriza, atribui responsável, acompanha SLA e avança status dos chamados.",
      "Como agente, posso localizar chamados, explicar bloqueios, sugerir prioridade e preparar a próxima ação conforme seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar chamado por código", "Explicar o que posso fazer nesta tela", "Sugerir próxima ação como agente", "Listar chamados pendentes", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/meus-chamados/,
    module: "support",
    screenLabel: "Meus chamados",
    screenSummary: [
      "Você está em: Meus chamados.",
      "Aqui você acompanha status, comenta e pede ajustes nos seus chamados.",
      "Como agente, posso resumir andamento, preparar comentário e orientar o melhor próximo passo.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar meu chamado por código", "Explicar o que posso fazer nesta tela", "Preparar comentário para chamado", "Listar chamados em andamento", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/admin\/users\/permissions/,
    module: "permissions",
    screenLabel: "Gestão de Perfis",
    screenSummary: [
      "Você está em: Gestão de Perfis.",
      "Aqui a plataforma mantém a matriz de acesso por perfil: Líder TC, Suporte Técnico, Empresa, Usuário da empresa e Usuário TC.",
      "Como agente, posso explicar por que alguém vê ou não vê uma tela, comparar perfis e sugerir ajuste seguro sem quebrar RBAC.",
    ].join(" "),
    entityType: "permission_profile",
    suggestedPrompts: ["Explicar bloqueio de permissão", "Comparar perfis", "Sugerir ajuste seguro de acesso", "Resumir permissões do perfil atual", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: (route) => /^\/empresas\/[^/]+\/planos-de-teste/.test(route) || route.startsWith("/planos-de-teste") || route.startsWith("/casos-de-teste"),
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: [
      "Você está em: Planos e casos de teste.",
      "Aqui você cria, importa, exporta e organiza casos com pré-condições, passos, resultado esperado, tags, suites, projeto Qase opcional e rastreabilidade.",
      "Como agente, posso transformar bug, requisito ou conversa em caso estruturado, revisar cobertura e explicar campos disponíveis no sistema.",
    ].join(" "),
    entityType: "test_plan",
    suggestedPrompts: ["Gerar caso de teste a partir de bug", "Montar passos e resultado esperado", "Explicar modelo de importação", "Listar lacunas de cobertura", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: (route) => /^\/empresas\/[^/]+/.test(route) || route.startsWith("/admin/clients") || route.startsWith("/empresas"),
    module: "company",
    screenLabel: "Empresa e operação de qualidade",
    screenSummary: [
      "Você está em: Empresa e operação de qualidade.",
      "Aqui você acompanha dashboard, projetos, casos, defeitos, runs, planos, documentos, usuários e indicadores da empresa selecionada.",
      "Como agente, posso resumir a empresa, apontar risco, buscar registros e sugerir próxima ação dentro do escopo permitido.",
    ].join(" "),
    entityType: "company",
    entityId: (slug) => slug,
    suggestedPrompts: ["Resumir status atual da empresa", "Ver defeitos e bugs ativos", "Abrir projetos da operação", "Sugerir próxima ação como agente", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/operacoes\/dashboard/,
    module: "dashboard",
    screenLabel: "Dashboard contextual",
    screenSummary: [
      "Você está em: Dashboard contextual.",
      "Aqui a visão se monta por perfil, permissões, empresas, aplicações, módulos, filtros e dados reais.",
      "Como agente, posso explicar gráficos, comparar empresas, resumir riscos e priorizar ações.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Resumir dashboard atual", "O que está mais crítico?", "Comparar empresas selecionadas", "Gerar resumo executivo", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/operacao/,
    module: "operations",
    screenLabel: "Central de Operações",
    screenSummary: [
      "Você está em: Central de Operações.",
      "Aqui você acompanha saúde operacional, runs, defeitos, automações, integrações e riscos.",
      "Como agente, posso resumir riscos, priorizar ações, analisar runs bloqueadas e sugerir o próximo movimento.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Resumir operação atual", "O que está mais crítico?", "Priorizar próximas ações", "Analisar runs bloqueadas", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/admin\/access-requests/,
    module: "permissions",
    screenLabel: "Solicitações de acesso",
    screenSummary: [
      "Você está em: Fila administrativa de solicitações de acesso.",
      "Aqui você busca, filtra, visualiza, baixa PDF, confere dados e decide aprovação, recusa ou ajuste.",
      "Comandos rápidos: procure por nome, filtre por status, hoje, últimos 7 dias, últimas 2 horas ou últimos 30 dias.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Buscar uma pessoa na fila", "Filtrar status rejeitado", "Filtrar status em aberto", "O que falta para aprovar?", ...PROFILE_HELP_PROMPTS],
  },
  {
    match: /^\/(?:admin)/,
    module: "dashboard",
    screenLabel: "Painel administrativo",
    screenSummary: [
      "Você está em: Painel administrativo.",
      "Aqui você gerencia a operação da plataforma: solicitações, usuários, permissões, empresas, chamados, métricas, Brain e logs.",
      "Como agente, posso explicar o que dá para fazer, sugerir ação, buscar registros, preparar textos e executar fluxos permitidos pelo seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: ["Explicar o que posso fazer aqui", "Sugerir próxima ação como agente", "Listar módulos administrativos", "Buscar registro por palavra-chave", ...PROFILE_HELP_PROMPTS],
  },
];

const GENERAL_CONTEXT: Omit<ScreenContextRule, "match"> = {
  module: "general",
  screenLabel: "Plataforma Quality Control",
  screenSummary: [
    "Você está em: Plataforma Quality Control.",
    "Aqui você navega, busca registros, cria chamados, acompanha qualidade ou entende seu contexto.",
    "Como agente, devo ajudar qualquer perfil dentro do seu escopo de acesso, explicando a tela, sugerindo próximos passos e executando apenas ações permitidas pelo RBAC.",
  ].join(" "),
  entityType: "screen",
  suggestedPrompts: ["Me ajuda com meu perfil", "Resumir esta tela", "Explicar o que posso fazer aqui", "Buscar registro por palavra-chave", "Sugerir próxima ação como agente"],
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
