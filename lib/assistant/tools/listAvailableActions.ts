import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { AssistantScreenContext } from "../types";
import { compactMultiline } from "../helpers";
import { buildPromptActions } from "../data";
import type { AssistantExecutorResult } from "./types";

export async function toolListAvailableActions(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const actions: string[] = [];

  actions.push("Ler o contexto da tela atual");
  actions.push("Buscar registros internos visiveis para o seu perfil");

  if (
    hasPermissionAccess(user.permissions, "tickets", "create") ||
    hasPermissionAccess(user.permissions, "support", "create")
  ) {
    actions.push("Montar e criar chamado a partir de texto solto");
  }
  if (hasPermissionAccess(user.permissions, "tickets", "comment") || hasPermissionAccess(user.permissions, "support", "comment")) {
    actions.push("Montar comentario tecnico em chamado visivel");
  }
  if (context.module === "test_plans") {
    actions.push("Gerar caso de teste estruturado com base no contexto");
  }
  if (context.module === "permissions" || hasPermissionAccess(user.permissions, "permissions", "view")) {
    actions.push("Explicar por que um perfil ve ou nao ve um modulo");
  }
  actions.push("Resumir tickets, usuarios, empresas e conversas acessiveis");
  actions.push("Sugerir o proximo passo mais util nesta tela");

  return {
    tool: "list_available_actions",
    success: true,
    summary: `${actions.length} acoes disponiveis`,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      "Posso agir dentro do seu perfil atual, sem ultrapassar RBAC, usando a sessao ativa, o contexto da tela e os dados do seu proprio perfil.",
      "",
      ...actions.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n")),
  };
}
