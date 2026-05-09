import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayName, displayRole, summarizePermissionMatrix, isEmpresaUser } from "../data";
import type { AssistantScreenContext } from "../types";
import type { AssistantExecutorResult } from "./types";

function firstName(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "usuário";
  return cleaned.split(/\s+/)[0] ?? "usuário";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getOperationsSnapshot(context: AssistantScreenContext) {
  if (context.module !== "operations") return null;

  const metadata = asRecord(context.metadata);
  if (!metadata) return null;

  const filters = asRecord(metadata.filters);
  const metrics = asRecord(metadata.metrics);
  const permissions = asRecord(metadata.permissions);
  const risksRaw = Array.isArray(metadata.risks) ? metadata.risks : [];

  const companyNames = Array.isArray(filters?.companyNames)
    ? filters.companyNames.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const periodLabel = asString(filters?.periodLabel, asString(filters?.period, "nas últimas 24h"));
  const roleLabel = asString(permissions?.role, "operador");

  return {
    companyCount: Array.isArray(filters?.companyIds) ? filters.companyIds.length : companyNames.length,
    companyNames,
    periodLabel,
    failedRuns: asNumber(metrics?.failedRuns),
    blockedRuns: asNumber(metrics?.blockedRuns),
    openDefects: asNumber(metrics?.openDefects),
    itemsWithoutOwner: asNumber(metrics?.itemsWithoutOwner),
    healthScore: asNumber(metrics?.healthScore),
    roleLabel,
    risks: risksRaw
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .slice(0, 3)
      .map((item) => ({
        severity: asString(item.severity, "atenção"),
        title: asString(item.title, "Risco operacional"),
        description: asString(item.description),
      })),
  };
}

function getModuleEmoji(module: string): string {
  switch (module) {
    case "support": return "🎫";
    case "dashboard": return "📊";
    case "permissions": return "🔐";
    case "test_plans": return "🧪";
    case "company": return "🏢";
    case "releases": return "🚀";
    case "integrations": return "🔗";
    case "admin": return "⚙️";
    default: return "📍";
  }
}

function buildImmediateActions(context: AssistantScreenContext, user: AuthUser): Array<{ emoji: string; text: string }> {
  switch (context.module) {
    case "support":
      return [
        { emoji: "🔍", text: "Localizar chamados por código, status, prioridade ou responsável" },
        { emoji: "📋", text: "Resumir um ticket antes de mover ou comentar" },
        { emoji: "✏️", text: "Transformar um relato em chamado estruturado" },
        { emoji: "🧪", text: "Gerar caso de teste a partir de um bug" },
      ];
    case "permissions":
      return [
        { emoji: "🔐", text: "Explicar por que um perfil não acessa determinada tela" },
        { emoji: "📊", text: "Comparar escopos entre perfis diferentes" },
        { emoji: "⚙️", text: "Apontar ajustes para liberar ou restringir acesso" },
      ];
    case "company":
      if (isEmpresaUser(user)) {
        return [
          { emoji: "🏢", text: "Resumir status atual da empresa" },
          { emoji: "🐛", text: "Ver defeitos e bugs ativos no projeto" },
          { emoji: "🧪", text: "Consultar planos de teste em andamento" },
          { emoji: "📊", text: "Analisar métricas de qualidade dos testes" },
        ];
      }
      return [
        { emoji: "📋", text: "Resumir a empresa atual e registros vinculados" },
        { emoji: "🔍", text: "Buscar chamados ou usuários desta empresa" },
        { emoji: "📊", text: "Analisar métricas de atendimento" },
        { emoji: "🔗", text: "Listar integrações ativas" },
      ];
    case "test_plans":
      return [
        { emoji: "🧪", text: "Gerar casos de teste a partir de bug ou fluxo" },
        { emoji: "📋", text: "Organizar pré-condições, passos e resultado esperado" },
        { emoji: "✅", text: "Validar cobertura de testes existente" },
      ];
    case "dashboard":
      return [
        { emoji: "📊", text: "Analisar métricas de qualidade do período" },
        { emoji: "🎯", text: "Identificar tendências nos indicadores" },
        { emoji: "⚠️", text: "Listar áreas que precisam de atenção" },
      ];
    case "releases":
      return [
        { emoji: "🚀", text: "Verificar status do último deploy" },
        { emoji: "📦", text: "Analisar testes pendentes para release" },
        { emoji: "📋", text: "Gerar relatório de qualidade da versão" },
      ];
    default:
      return [
        { emoji: "📍", text: "Entender o contexto atual e próximos passos" },
        { emoji: "🔍", text: "Buscar registros por palavra-chave ou contexto" },
        { emoji: "💡", text: "Transformar um pedido em ação objetiva" },
      ];
  }
}

function stripScreenLead(context: AssistantScreenContext) {
  const lead = `Você está em: ${context.screenLabel}.`;
  if (context.screenSummary.startsWith(lead)) {
    return context.screenSummary.slice(lead.length).trim();
  }
  return context.screenSummary.trim();
}

function buildScopeLabel(user: AuthUser, context: AssistantScreenContext) {
  return context.companySlug ?? user.companySlug ?? "global";
}

function buildPermissionLine(user: AuthUser) {
  const summary = summarizePermissionMatrix(user.permissions);
  if (summary === "sem módulos liberados") {
    return "⚠️ **Permissões:** Nenhum módulo liberado para o perfil atual";
  }
  return `🔐 **Permissões:** ${summary}`;
}

export async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);
  const actions = buildImmediateActions(context, user);
  const moduleEmoji = getModuleEmoji(context.module);
  const prompts = context.suggestedPrompts.slice(0, 4);
  const operations = getOperationsSnapshot(context);

  if (operations) {
    const userName = firstName(displayName(currentUser));
    const scopeLabel = operations.companyCount <= 1
      ? (operations.companyNames[0] ?? buildScopeLabel(user, context))
      : `${operations.companyCount} empresas selecionadas`;

    const riskLines = operations.risks.length > 0
      ? operations.risks.map((risk, index) => `${index + 1}. ${risk.title}${risk.description ? ` — ${risk.description}` : ""}`)
      : ["1. Sem riscos críticos destacados no recorte atual."];

    return {
      tool: "get_screen_context",
      success: true,
      summary: context.screenLabel,
      actions: buildPromptActions(context),
      reply: compactMultiline([
        `Oi, ${userName}. Estou com a ${context.screenLabel} carregada.`,
        "",
        `No contexto atual, há ${scopeLabel} ${operations.periodLabel}, com ${operations.failedRuns} runs com falha, ${operations.blockedRuns} runs bloqueadas, ${operations.openDefects} defeitos abertos e ${operations.itemsWithoutOwner} itens sem responsável.`,
        operations.healthScore > 0 ? `Saúde operacional atual: ${operations.healthScore}%.` : "Saúde operacional atual em nível crítico e precisa de atenção imediata.",
        "",
        "### Pontos de atenção",
        ...riskLines,
        "",
        "### Posso ajudar com:",
        ...prompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        "",
        `Perfil ativo: ${operations.roleLabel}.`,
      ].join("\n")),
    };
  }

  const replyParts = [
    `## ${moduleEmoji} ${context.screenLabel}`,
    "",
    `> ${stripScreenLead(context)}`,
    "",
    "### 🎯 O que posso fazer aqui:",
    "",
    ...actions.map((a) => `- ${a.emoji} ${a.text}`),
    "",
    "### 💡 Sugestões rápidas:",
    "",
    ...prompts.map((p, i) => `${i + 1}. ${p}`),
    "",
    "---",
    "",
    "### 📋 Contexto Atual:",
    "",
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Módulo** | ${context.module} |`,
    `| **Escopo** | ${buildScopeLabel(user, context)} |`,
    `| **Perfil** | ${displayRole(user)} |`,
    `| **Usuário** | ${displayName(currentUser)} |`,
    "",
    buildPermissionLine(user),
  ];

  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline(replyParts.join("\n")),
  };
}
