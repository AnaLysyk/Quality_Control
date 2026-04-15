import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayName, displayRole, summarizePermissionMatrix, isEmpresaUser } from "../data";
import type { AssistantScreenContext } from "../types";
import type { AssistantExecutorResult } from "./types";

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
