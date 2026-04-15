import type { AssistantContextEntityType, AssistantModule, AssistantScreenContext } from "@/lib/assistant/types";

/* ──────────────────── Helpers ──────────────────── */

function extractCompanySlug(route: string) {
  const match = route.match(/^\/empresas\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/* ──────────────────── Declarative screen context map ──────────────────── */

/**
 * Each entry is tested in order — first match wins.
 * To add a new screen just append (or insert) an entry here.
 */
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
    match: /^\/(?:admin\/support|kanban-it)/,
    module: "support",
    screenLabel: "Kanban global de suporte",
    screenSummary: [
      "Você está em: Kanban global de suporte.",
      "Aqui você prioriza, atribui responsável e avança status dos chamados.",
      "Dica: cite o código do chamado (SP-000123) para localizar rapidamente."
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Buscar chamado por código (ex: SP-000123)",
      "Atribuir responsável ao chamado",
      "Avançar status de um chamado",
      "Listar chamados pendentes"
    ],
  },
  {
    match: /^\/meus-chamados/,
    module: "support",
    screenLabel: "Meus chamados",
    screenSummary: [
      "Você está em: Meus chamados.",
      "Aqui você acompanha status, comenta e pede ajustes nos seus chamados.",
      "Dica: diga o objetivo e o impacto do problema para agilizar o atendimento."
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Buscar meu chamado por código",
      "Comentar em chamado aberto",
      "Pedir ajuste em chamado",
      "Listar chamados em andamento"
    ],
  },
  {
    match: /^\/admin\/users\/permissions/,
    module: "permissions",
    screenLabel: "Gestão de permissões por usuário",
    screenSummary: [
      "Você está em: Gestão de permissões por usuário.",
      "Aqui você gerencia permissões e acessos por perfil/usuário.",
      "Dica: posso explicar o motivo de bloqueios e o que precisa mudar."
    ].join(" "),
    entityType: "permission_profile",
    suggestedPrompts: [
      "Explicar por que este perfil não vê uma tela",
      "Comparar permissões entre usuários",
      "Listar usuários com acesso a este módulo",
      "Resumir permissões do perfil atual"
    ],
  },
  {
    match: (r) => /^\/empresas\/[^/]+\/planos-de-teste/.test(r) || r.startsWith("/planos-de-teste"),
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: [
      "Você está em: Planos e casos de teste.",
      "Aqui você cria e organiza casos de teste: pré-condições, passos e resultado esperado.",
      "Dica: cole o bug/ticket que eu rascunho o teste."
    ].join(" "),
    entityType: "test_plan",
    suggestedPrompts: [
      "Gerar caso de teste a partir de bug",
      "Montar passos e resultado esperado",
      "Resumir ticket para virar teste",
      "Listar casos de teste pendentes"
    ],
  },
  {
    match: (r) => /^\/empresas\/[^/]+/.test(r) || r.startsWith("/admin/clients") || r.startsWith("/empresas"),
    module: "company",
    screenLabel: "Empresas e contexto da conta",
    screenSummary: [
      "Você está em: Empresas e contexto da conta.",
      "Aqui você acompanha status, chamados, defeitos e planos de teste da empresa.",
      "Dica: pergunte sobre defeitos ativos, chamados abertos ou métricas de qualidade."
    ].join(" "),
    entityType: "company",
    entityId: (slug) => slug,
    suggestedPrompts: [
      "Resumir status atual da empresa",
      "Buscar chamados abertos desta empresa",
      "Ver defeitos e bugs ativos",
      "Consultar planos de teste em andamento"
    ],
  },
  {
    match: /^\/(?:admin|dashboard)/,
    module: "dashboard",
    screenLabel: "Painel administrativo",
    screenSummary: [
      "Você está em: Painel administrativo.",
      "Aqui você faz operação e gestão: visão macro e acesso rápido a módulos.",
      "Dica: me diga o que quer destravar e eu aponto o caminho."
    ].join(" "),
    entityType: "screen",
    suggestedPrompts: [
      "Resumir esta tela",
      "Acessar módulo de suporte",
      "Buscar indicador de desempenho",
      "Listar módulos disponíveis"
    ],
  },
];

const GENERAL_CONTEXT: Omit<ScreenContextRule, "match"> = {
  module: "general",
  screenLabel: "Plataforma Quality Control",
  screenSummary: [
    "Você está em: Plataforma Quality Control.",
    "Aqui você navega, busca registros, cria chamados ou entende seu contexto.",
    "Dica: peça um resumo ou diga o que deseja fazer."
  ].join(" "),
  entityType: "screen",
  suggestedPrompts: [
    "Resumir esta tela",
    "Buscar registro por palavra-chave",
    "Criar novo chamado",
    "Listar módulos disponíveis"
  ],
};

/* ──────────────────── Resolver ──────────────────── */

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
