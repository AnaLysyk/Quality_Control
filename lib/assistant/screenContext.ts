import type { AssistantScreenContext } from "@/lib/assistant/types";

function extractCompanySlug(route: string) {
  const match = route.match(/^\/empresas\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildGeneralContext(route: string): AssistantScreenContext {
  return {
    route,
    module: "general",
    screenLabel: "Plataforma Quality Control",
    screenSummary: "Assistente nativo da plataforma com contexto da sess\u00e3o atual.",
    entityType: "screen",
    entityId: null,
    companySlug: extractCompanySlug(route),
    suggestedPrompts: [
      "Resumir esta tela",
      "Transformar texto ou nota em chamado",
      "Explicar meu escopo de acesso",
      "Resumir meu perfil atual",
    ],
  };
}

export function resolveAssistantScreenContext(route: string): AssistantScreenContext {
  const normalizedRoute = (route || "/").trim() || "/";
  const companySlug = extractCompanySlug(normalizedRoute);

  if (normalizedRoute.startsWith("/admin/support") || normalizedRoute.startsWith("/kanban-it")) {
    return {
      route: normalizedRoute,
      module: "support",
      screenLabel: "Kanban global de suporte",
      screenSummary: "Fluxo global de chamados, respons\u00e1veis, status e atendimento do suporte t\u00e9cnico.",
      entityType: "screen",
      entityId: null,
      companySlug,
      suggestedPrompts: [
        "Buscar chamado por ID",
        "Resumir um chamado do suporte",
        "Transformar relato em chamado",
        "Explicar meu escopo de acesso",
      ],
    };
  }

  if (normalizedRoute.startsWith("/meus-chamados")) {
    return {
      route: normalizedRoute,
      module: "support",
      screenLabel: "Meus chamados",
      screenSummary: "Acompanhamento dos chamados vinculados ao usu\u00e1rio autenticado.",
      entityType: "screen",
      entityId: null,
      companySlug,
      suggestedPrompts: [
        "Buscar meu chamado por ID",
        "Transformar nota em chamado",
        "Resumir um chamado",
        "Montar coment\u00e1rio para meu chamado",
      ],
    };
  }

  if (normalizedRoute.startsWith("/admin/users/permissions")) {
    return {
      route: normalizedRoute,
      module: "permissions",
      screenLabel: "Gest\u00e3o de permiss\u00f5es por usu\u00e1rio",
      screenSummary: "An\u00e1lise de perfis, m\u00f3dulos, a\u00e7\u00f5es e visibilidade por usu\u00e1rio.",
      entityType: "permission_profile",
      entityId: null,
      companySlug,
      suggestedPrompts: [
        "Explicar por que este perfil n\u00e3o v\u00ea uma tela",
        "Comparar permiss\u00f5es deste contexto",
        "Resumir o perfil atual",
        "Buscar usu\u00e1rios por permiss\u00e3o",
      ],
    };
  }

  if (/^\/empresas\/[^/]+\/planos-de-teste/.test(normalizedRoute) || normalizedRoute.startsWith("/planos-de-teste")) {
    return {
      route: normalizedRoute,
      module: "test_plans",
      screenLabel: "Planos e casos de teste",
      screenSummary: "Estrutura\u00e7\u00e3o de casos de teste, pr\u00e9-condi\u00e7\u00f5es, passos e resultado esperado.",
      entityType: "test_plan",
      entityId: null,
      companySlug,
      suggestedPrompts: [
        "Gerar caso de teste com base em um bug",
        "Montar passos e resultado esperado",
        "Resumir um ticket para virar teste",
        "Transformar nota em chamado",
      ],
    };
  }

  if (/^\/empresas\/[^/]+/.test(normalizedRoute) || normalizedRoute.startsWith("/admin/clients") || normalizedRoute.startsWith("/empresas")) {
    return {
      route: normalizedRoute,
      module: "company",
      screenLabel: "Empresas e contexto da conta",
      screenSummary: "Vis\u00e3o de empresas, v\u00ednculos, contexto atual e registros relacionados.",
      entityType: "company",
      entityId: companySlug,
      companySlug,
      suggestedPrompts: [
        "Resumir esta empresa",
        "Buscar chamados desta empresa",
        "Transformar texto em chamado",
        "Explicar meu escopo de acesso",
      ],
    };
  }

  if (normalizedRoute.startsWith("/admin") || normalizedRoute.startsWith("/dashboard")) {
    return {
      route: normalizedRoute,
      module: "dashboard",
      screenLabel: "Painel administrativo",
      screenSummary: "Painel administrativo com m\u00f3dulos de opera\u00e7\u00e3o, suporte e gest\u00e3o.",
      entityType: "screen",
      entityId: null,
      companySlug,
      suggestedPrompts: [
        "Resumir esta tela",
        "Transformar texto ou nota em chamado",
        "Explicar meu escopo de acesso",
        "Resumir meu perfil atual",
      ],
    };
  }

  return buildGeneralContext(normalizedRoute);
}
