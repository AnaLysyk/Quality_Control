import "server-only";

import type { AuthUser } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { prisma } from "@/database/prismaClient";
import type { AssistantScreenContext } from "../types";
import { isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

const ACCESS_REQUEST_SUGGESTIONS = [
  "🔎 Buscar uma pessoa na fila de solicitações",
  "🧭 Explicar o que falta para aprovar uma solicitação",
  "📝 Orientar quais campos devolver para ajuste",
  "📄 Abrir ou baixar o PDF da solicitação visível",
];

const BRAIN_SUGGESTIONS = [
  "🧠 Resumir o Brain e o que ele já sabe",
  "🕸️ Explicar relações do grafo de conhecimento",
  "🔎 Buscar contexto em memórias, telas e entidades",
  "➡️ Sugerir o próximo passo como agente",
];

const SUPPORT_READ_SUGGESTIONS = [
  "🔍 Buscar tickets de alta prioridade sem responsável",
  "📋 Resumir um chamado pelo ID para acelerar triagem",
];

const SUPPORT_CREATE_SUGGESTIONS = [
  "✏️ Transformar um relato em chamado estruturado",
  "🎫 Criar novo ticket a partir de descrição",
];

const PERMISSION_SUGGESTIONS = [
  "🔐 Explicar por que um perfil não vê um módulo",
  "📊 Listar ações disponíveis para o usuário analisado",
  "🔧 Analisar escopo de acesso atual",
];

const TEST_PLAN_SUGGESTIONS = [
  "🧪 Gerar caso de teste a partir do bug atual",
  "📝 Criar roteiro de teste estruturado",
  "✅ Validar cobertura de testes existente",
];

const DASHBOARD_SUGGESTIONS = [
  "📈 Analisar métricas de qualidade do período",
  "🎯 Identificar tendências nos indicadores",
  "⚠️ Listar áreas que precisam de atenção",
];

const RELEASE_SUGGESTIONS = [
  "🚀 Verificar status do último deploy",
  "📦 Analisar testes pendentes para release",
  "📋 Gerar relatório de qualidade da versão",
];

const COMPANY_USER_SUGGESTIONS = [
  "🏢 Resumir status atual da minha empresa",
  "🐛 Listar defeitos e bugs ativos no projeto",
  "📊 Ver métricas de qualidade dos testes",
  "🚀 Checar status dos planos de release",
];

const COMPANY_ADMIN_SUGGESTIONS = [
  "🏢 Resumir perfil da empresa",
  "📊 Analisar métricas de atendimento do cliente",
  "📋 Listar integrações ativas",
  "👥 Ver usuários vinculados à empresa",
];

const FALLBACK_SUGGESTIONS = [
  "📍 Mostrar o contexto atual da tela",
  "🔍 Buscar registros no seu escopo de acesso",
  "🔐 Explicar permissões da tela atual",
  "💡 O que posso fazer por você?",
];

type SuggestionContextState = {
  isAccessRequestsContext: boolean;
  isBrainContext: boolean;
};

async function loadSmartTips(): Promise<string[]> {
  try {
    const relevantMemories = await prisma.brainMemory.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { memoryType: "RULE" },
          { memoryType: "PATTERN" },
          { memoryType: "DECISION" },
        ],
      },
      orderBy: { importance: "desc" },
      take: 3,
      select: {
        title: true,
        summary: true,
        memoryType: true,
      },
    });

    return relevantMemories
      .filter((memory) => memory.memoryType === "PATTERN")
      .map((memory) => `💡 ${memory.title}`);
  } catch {
    return [];
  }
}

function getContextState(
  context: AssistantScreenContext,
): SuggestionContextState {
  return {
    isAccessRequestsContext:
      context.route.startsWith("/admin/access-requests"),
    isBrainContext:
      context.module === "brain" ||
      context.route.startsWith("/brain") ||
      context.route.startsWith("/admin/brain"),
  };
}

function getRouteSuggestions(
  state: SuggestionContextState,
): string[] {
  const suggestions: string[] = [];

  if (state.isAccessRequestsContext) {
    suggestions.push(...ACCESS_REQUEST_SUGGESTIONS);
  }

  if (state.isBrainContext) {
    suggestions.push(...BRAIN_SUGGESTIONS);
  }

  return suggestions;
}

function canCreateSupportTicket(user: AuthUser): boolean {
  return (
    hasPermissionAccess(user.permissions, "tickets", "create") ||
    hasPermissionAccess(user.permissions, "support", "create")
  );
}

function getSupportSuggestions(user: AuthUser): string[] {
  const suggestions = [...SUPPORT_READ_SUGGESTIONS];

  if (canCreateSupportTicket(user)) {
    suggestions.push(...SUPPORT_CREATE_SUGGESTIONS);
  }

  return suggestions;
}

function getCompanySuggestions(user: AuthUser): string[] {
  if (isEmpresaUser(user)) {
    return [...COMPANY_USER_SUGGESTIONS];
  }

  return [...COMPANY_ADMIN_SUGGESTIONS];
}

function getDashboardSuggestions(
  state: SuggestionContextState,
): string[] {
  if (state.isAccessRequestsContext || state.isBrainContext) {
    return [];
  }

  return [...DASHBOARD_SUGGESTIONS];
}

function getModuleSuggestions(
  user: AuthUser,
  context: AssistantScreenContext,
  state: SuggestionContextState,
): string[] {
  switch (context.module) {
    case "support":
      return getSupportSuggestions(user);

    case "permissions":
      return [...PERMISSION_SUGGESTIONS];

    case "test_plans":
      return [...TEST_PLAN_SUGGESTIONS];

    case "dashboard":
      return getDashboardSuggestions(state);

    case "releases":
      return [...RELEASE_SUGGESTIONS];

    case "company":
      return getCompanySuggestions(user);

    default:
      return [];
  }
}

function applyFallback(suggestions: string[]): string[] {
  if (suggestions.length > 0) {
    return suggestions;
  }

  return [...FALLBACK_SUGGESTIONS];
}

function buildReply(
  mainSuggestions: string[],
  smartTips: string[],
): string {
  const suggestionsText = mainSuggestions
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  const baseReply =
    `**O que posso ajudar agora:**\n\n${suggestionsText}`;

  if (smartTips.length === 0) {
    return baseReply;
  }

  return [
    baseReply,
    "",
    "---",
    "**Dicas do Brain:**",
    smartTips.slice(0, 2).join("\n"),
  ].join("\n");
}

function buildActions(mainSuggestions: string[]) {
  return mainSuggestions.map((prompt) => {
    const cleanPrompt = prompt.replace(/^[^\s]+\s/, "");

    return {
      kind: "prompt" as const,
      label: cleanPrompt,
      prompt: cleanPrompt,
    };
  });
}

export async function toolSuggestNextStep(
  user: AuthUser,
  context: AssistantScreenContext,
): Promise<AssistantExecutorResult> {
  const smartTips = await loadSmartTips();
  const state = getContextState(context);

  const suggestions = applyFallback([
    ...getRouteSuggestions(state),
    ...getModuleSuggestions(user, context, state),
  ]);

  const mainSuggestions = suggestions.slice(0, 4);

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "próximos passos sugeridos com contexto inteligente",
    actions: buildActions(mainSuggestions),
    reply: buildReply(mainSuggestions, smartTips),
  };
}
