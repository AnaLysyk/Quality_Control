import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { AssistantScreenContext } from "../types";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayRole, isEmpresaUser } from "../data";
import type { AssistantExecutorResult } from "./types";

type ActionItem = {
  emoji: string;
  text: string;
  category: "read" | "write" | "analyze";
};

export async function toolListAvailableActions(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const actions: ActionItem[] = [];

  // Ações de leitura (sempre disponíveis)
  actions.push({ emoji: "📍", text: "Ler o contexto da tela atual", category: "read" });
  actions.push({ emoji: "🔍", text: "Buscar registros visíveis no seu escopo", category: "read" });
  actions.push({ emoji: "📋", text: "Resumir tickets, usuários ou empresas", category: "read" });

  // Ações de escrita (dependem de permissões)
  if (
    hasPermissionAccess(user.permissions, "tickets", "create") ||
    hasPermissionAccess(user.permissions, "support", "create")
  ) {
    actions.push({ emoji: "🎫", text: "Criar chamado a partir de texto ou descrição", category: "write" });
  }
  
  if (hasPermissionAccess(user.permissions, "tickets", "comment") || hasPermissionAccess(user.permissions, "support", "comment")) {
    actions.push({ emoji: "💬", text: "Adicionar comentário técnico em chamado", category: "write" });
  }

  // Ações de análise (dependem do contexto/módulo)
  if (context.module === "test_plans" || hasPermissionAccess(user.permissions, "test_plans", "create")) {
    actions.push({ emoji: "🧪", text: "Gerar caso de teste estruturado", category: "analyze" });
  }

  if (context.module === "permissions" || hasPermissionAccess(user.permissions, "permissions", "view")) {
    actions.push({ emoji: "🔐", text: "Explicar permissões e escopos de acesso", category: "analyze" });
  }

  if (context.module === "company") {
    if (isEmpresaUser(user)) {
      actions.push({ emoji: "🏢", text: "Resumir status atual da empresa", category: "read" });
      actions.push({ emoji: "🐛", text: "Listar defeitos e bugs ativos no projeto", category: "read" });
      actions.push({ emoji: "🚀", text: "Ver status dos planos de release", category: "read" });
      actions.push({ emoji: "📊", text: "Analisar métricas de qualidade dos testes", category: "analyze" });
    } else {
      actions.push({ emoji: "🏢", text: "Resumir perfil da empresa", category: "read" });
      actions.push({ emoji: "📊", text: "Analisar métricas de atendimento", category: "analyze" });
      actions.push({ emoji: "🔗", text: "Listar integrações ativas", category: "read" });
      actions.push({ emoji: "👥", text: "Ver usuários vinculados à empresa", category: "read" });
    }
  }

  actions.push({ emoji: "📊", text: "Analisar métricas e indicadores", category: "analyze" });
  actions.push({ emoji: "💡", text: "Sugerir próximo passo mais útil", category: "analyze" });

  // Agrupar por categoria
  const readActions = actions.filter((a) => a.category === "read");
  const writeActions = actions.filter((a) => a.category === "write");
  const analyzeActions = actions.filter((a) => a.category === "analyze");

  const replyParts = [
    "## 🤖 Ações Disponíveis",
    "",
    `> Operando como **${displayRole(user)}** no módulo **${context.module}**`,
    "",
  ];

  if (readActions.length) {
    replyParts.push(
      "### 📖 Consultas:",
      "",
      ...readActions.map((a) => `- ${a.emoji} ${a.text}`),
      "",
    );
  }

  if (writeActions.length) {
    replyParts.push(
      "### ✏️ Criação:",
      "",
      ...writeActions.map((a) => `- ${a.emoji} ${a.text}`),
      "",
    );
  }

  if (analyzeActions.length) {
    replyParts.push(
      "### 🔬 Análise:",
      "",
      ...analyzeActions.map((a) => `- ${a.emoji} ${a.text}`),
      "",
    );
  }

  replyParts.push(
    "---",
    "",
    "💡 Todas as ações respeitam seu **RBAC** e escopo de empresa.",
  );

  return {
    tool: "list_available_actions",
    success: true,
    summary: `${actions.length} ações disponíveis`,
    actions: buildPromptActions(context),
    reply: compactMultiline(replyParts.join("\n")),
  };
}
