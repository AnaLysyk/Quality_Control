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
    screenSummary: "Tela central de triagem do suporte. Use para localizar chamados, acompanhar responsáveis, revisar status e decidir a próxima ação.",
    entityType: "screen",
    suggestedPrompts: [
      "Buscar chamado por ID",
      "Resumir um chamado do suporte",
      "Transformar relato em chamado",
      "Explicar meu escopo de acesso",
    ],
  },
  {
    match: /^\/meus-chamados/,
    module: "support",
    screenLabel: "Meus chamados",
    screenSummary: "Tela focada nos seus chamados. Use para acompanhar status, revisar histórico e preparar comentários ou novas ações.",
    entityType: "screen",
    suggestedPrompts: [
      "Buscar meu chamado por ID",
      "Transformar nota em chamado",
      "Resumir um chamado",
      "Montar comentário para meu chamado",
    ],
  },
  {
    match: /^\/admin\/users\/permissions/,
    module: "permissions",
    screenLabel: "Gestão de permissões por usuário",
    screenSummary: "Tela de análise de acesso. Use para entender o que cada perfil pode ver, quais ações estão liberadas e por que uma tela pode estar bloqueada.",
    entityType: "permission_profile",
    suggestedPrompts: [
      "Explicar por que este perfil não vê uma tela",
      "Comparar permissões deste contexto",
      "Resumir o perfil atual",
      "Buscar usuários por permissão",
    ],
  },
  {
    match: (r) => /^\/empresas\/[^/]+\/planos-de-teste/.test(r) || r.startsWith("/planos-de-teste"),
    module: "test_plans",
    screenLabel: "Planos e casos de teste",
    screenSummary: "Tela para estruturar e revisar casos de teste. Use para gerar passos, definir pré-condições e validar resultado esperado a partir de bugs ou relatos.",
    entityType: "test_plan",
    suggestedPrompts: [
      "Gerar caso de teste com base em um bug",
      "Montar passos e resultado esperado",
      "Resumir um ticket para virar teste",
      "Transformar nota em chamado",
    ],
  },
  {
    match: (r) => /^\/empresas\/[^/]+/.test(r) || r.startsWith("/admin/clients") || r.startsWith("/empresas"),
    module: "company",
    screenLabel: "Empresas e contexto da conta",
    screenSummary: "Tela contextual da empresa atual. Use para navegar pelos dados vinculados ao tenant, revisar registros relacionados e acionar buscas ou chamados dentro desse escopo.",
    entityType: "company",
    entityId: (slug) => slug,
    suggestedPrompts: [
      "Resumir esta empresa",
      "Buscar chamados desta empresa",
      "Transformar texto em chamado",
      "Explicar meu escopo de acesso",
    ],
  },
  {
    match: /^\/(?:admin|dashboard)/,
    module: "dashboard",
    screenLabel: "Painel administrativo",
    screenSummary: "Tela central para acompanhar operação, navegar entre módulos e iniciar ações de suporte, gestão e análise.",
    entityType: "screen",
    suggestedPrompts: [
      "Resumir esta tela",
      "Transformar texto ou nota em chamado",
      "Explicar meu escopo de acesso",
      "Resumir meu perfil atual",
    ],
  },
];

const GENERAL_CONTEXT: Omit<ScreenContextRule, "match"> = {
  module: "general",
  screenLabel: "Plataforma Quality Control",
  screenSummary: "Assistente nativo da plataforma. Use para navegar, buscar registros, criar chamados ou entender seu contexto atual.",
  entityType: "screen",
  suggestedPrompts: [
    "Resumir esta tela",
    "Transformar texto ou nota em chamado",
    "Explicar meu escopo de acesso",
    "Resumir meu perfil atual",
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
