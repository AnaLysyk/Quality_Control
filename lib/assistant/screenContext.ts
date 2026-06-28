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

const SCREEN_CONTEXT_RULES: ScreenContextRule[] = [
  {
    match: /^\/brain(?:\/|$)/,
    module: "brain",
    screenLabel: "Brain",
    screenSummary: [
      "Voce esta em: Brain.",
      "Aqui voce consulta o grafo de conhecimento e conversa com agentes especializados sobre a plataforma Quality Control.",
      "Como agente, posso explicar relacoes do grafo, orientar proximas acoes e buscar contexto permitido pelo seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Resumir o Brain",
      "Explicar o que posso fazer aqui",
      "Buscar contexto no Brain",
      "Sugerir proxima acao como agente",
    ],
  },
  {
    match: /^\/(?:admin\/support|kanban-it)/,
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: [
      "Voce esta em: Kanban global de suporte.",
      "Aqui voce prioriza, atribui responsavel, acompanha SLA e avanca status dos chamados.",
      "Como agente, posso localizar chamados, explicar bloqueios, sugerir prioridade e preparar a proxima acao conforme seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Buscar chamado por codigo",
      "Explicar o que posso fazer nesta tela",
      "Sugerir proxima acao como agente",
      "Listar chamados pendentes",
    ],
  },
  {
    match: /^\/meus-chamados/,
    module: "support",
    screenLabel: "Meus chamados",
    screenSummary: [
      "Voce esta em: Meus chamados.",
      "Aqui voce acompanha status, comenta e pede ajustes nos seus chamados.",
      "Como agente, posso resumir andamento, preparar comentario e orientar o melhor proximo passo.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Buscar meu chamado por codigo",
      "Explicar o que posso fazer nesta tela",
      "Preparar comentario para chamado",
      "Listar chamados em andamento",
    ],
  },
  {
    match: /^\/admin\/users\/permissions/,
    module: "permissions",
    screenLabel: "Gestao de permissoes por usuario",
    screenSummary: [
      "Voce esta em: Gestao de permissoes por usuario.",
      "Aqui voce gerencia permissoes, perfis e escopos de acesso.",
      "Como agente, posso explicar por que alguem nao ve uma tela, comparar perfis e sugerir ajustes seguros.",
    ].join(" "),
    entityType: "permission_profile",
    suggestedPrompts: [
      "Explicar bloqueio de permissao",
      "Comparar permissoes entre usuarios",
      "Sugerir ajuste seguro de acesso",
      "Resumir permissoes do perfil atual",
    ],
  },
  {
    match: (route) =>
      /^\/empresas\/[^/]+\/planos-de-teste/.test(route) ||
      route.startsWith("/planos-de-teste") ||
      route.startsWith("/casos-de-teste"),
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: [
      "Voce esta em: Planos e casos de teste.",
      "Aqui voce cria e organiza casos de teste com pre-condicoes, passos e resultado esperado.",
      "Como agente, posso transformar bug, requisito ou conversa em caso de teste estruturado.",
    ].join(" "),
    entityType: "test_plan",
    suggestedPrompts: [
      "Gerar caso de teste a partir de bug",
      "Montar passos e resultado esperado",
      "Explicar o que posso fazer nesta tela",
      "Listar casos de teste pendentes",
    ],
  },
  {
    match: (route) => /^\/empresas\/[^/]+/.test(route) || route.startsWith("/admin/clients") || route.startsWith("/empresas"),
    module: "company",
    screenLabel: "Empresas e contexto da conta",
    screenSummary: [
      "Voce esta em: Empresas e contexto da conta.",
      "Aqui voce acompanha status, chamados, defeitos, usuarios e planos de teste da empresa.",
      "Como agente, posso resumir a empresa, apontar riscos, buscar registros e sugerir proximas acoes.",
    ].join(" "),
    entityType: "company",
    entityId: (slug) => slug,
    suggestedPrompts: [
      "Resumir status atual da empresa",
      "Buscar chamados abertos desta empresa",
      "Ver defeitos e bugs ativos",
      "Sugerir proxima acao como agente",
    ],
  },
  {
    match: /^\/operacoes\/dashboard/,
    module: "dashboard",
    screenLabel: "Dashboard contextual",
    screenSummary: [
      "Voce esta em: Dashboard contextual.",
      "Aqui a visao se monta por perfil, permissoes, empresas, aplicacoes, modulos, filtros e dados reais.",
      "Como agente, posso explicar graficos, comparar empresas, resumir riscos e priorizar acoes.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Resumir dashboard atual",
      "O que esta mais critico?",
      "Comparar empresas selecionadas",
      "Gerar resumo executivo",
    ],
  },
  {
    match: /^\/operacao/,
    module: "operations",
    screenLabel: "Central de Operacoes",
    screenSummary: [
      "Voce esta em: Central de Operacoes.",
      "Aqui voce acompanha saude operacional, runs, defeitos, automacoes, integracoes e riscos.",
      "Como agente, posso resumir riscos, priorizar acoes, analisar runs bloqueadas e sugerir o proximo movimento.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Resumir operacao atual",
      "O que esta mais critico?",
      "Priorizar proximas acoes",
      "Analisar runs bloqueadas",
    ],
  },
  {
    match: /^\/admin\/access-requests/,
    module: "dashboard",
    screenLabel: "Solicitacoes de acesso",
    screenSummary: [
      "Voce esta em: Solicitacoes de acesso.",
      "Aqui voce revisa perfis solicitados, compara alteracoes, acompanha historico e decide aprovar, recusar ou pedir ajuste.",
      "Como agente, posso explicar o fluxo, apontar pendencias, sugerir decisao e orientar quais campos devolver para ajuste.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Explicar o fluxo desta solicitacao",
      "O que falta para aprovar?",
      "Sugerir decisao como agente",
      "Listar acoes que posso executar aqui",
    ],
  },
  {
    match: /^\/(?:admin|dashboard)/,
    module: "dashboard",
    screenLabel: "Painel administrativo",
    screenSummary: [
      "Voce esta em: Painel administrativo.",
      "Aqui voce gerencia a operacao da plataforma: solicitacoes, usuarios, permissoes, empresas, chamados, metricas e logs.",
      "Como agente, posso explicar o que da para fazer, sugerir uma acao, buscar registros, preparar textos e executar fluxos permitidos pelo seu RBAC.",
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Explicar o que posso fazer aqui",
      "Sugerir proxima acao como agente",
      "Listar modulos administrativos",
      "Buscar registro por palavra-chave",
    ],
  },
];

const GENERAL_CONTEXT: Omit<ScreenContextRule, "match"> = {
  module: "general",
  screenLabel: "Plataforma Quality Control",
  screenSummary: [
    "Voce esta em: Plataforma Quality Control.",
    "Aqui voce navega, busca registros, cria chamados ou entende seu contexto.",
    "Como agente, posso explicar a tela, sugerir proximas acoes e executar fluxos permitidos pelo seu RBAC.",
  ].join(" "),
  entityType: "screen",
  suggestedPrompts: [
    "Resumir esta tela",
    "Explicar o que posso fazer aqui",
    "Buscar registro por palavra-chave",
    "Sugerir proxima acao como agente",
  ],
};

export function resolveAssistantScreenContext(route: string): AssistantScreenContext {
  const normalizedRoute = (route || "/").trim() || "/";
  const companySlug = extractCompanySlug(normalizedRoute);

  const matched = SCREEN_CONTEXT_RULES.find((rule) =>
    typeof rule.match === "function" ? rule.match(normalizedRoute) : rule.match.test(normalizedRoute),
  );

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
