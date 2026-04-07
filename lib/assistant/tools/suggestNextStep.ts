import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import type { AssistantScreenContext } from "../types";
import type { AssistantExecutorResult } from "./types";

export async function toolSuggestNextStep(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const suggestions: string[] = [];

  if (context.module === "support") {
    suggestions.push("Buscar tickets de alta prioridade sem responsavel.");
    suggestions.push("Resumir um chamado pelo ID para acelerar triagem.");
    if (hasPermissionAccess(user.permissions, "tickets", "create") || hasPermissionAccess(user.permissions, "support", "create")) {
      suggestions.push("Transformar um relato solto em chamado estruturado.");
    }
  }

  if (context.module === "permissions") {
    suggestions.push("Explicar por que um perfil nao ve um modulo.");
    suggestions.push("Listar acoes disponiveis para o usuario analisado.");
  }

  if (context.module === "test_plans") {
    suggestions.push("Gerar caso de teste a partir do bug atual.");
  }

  if (!suggestions.length) {
    suggestions.push("Mostrar o contexto atual.");
    suggestions.push("Buscar registros internos visiveis no seu escopo.");
    suggestions.push("Explicar permissoes da tela atual.");
  }

  return {
    tool: "suggest_next_step",
    success: true,
    summary: "proximos passos sugeridos",
    actions: suggestions.slice(0, 4).map((prompt) => ({ kind: "prompt", label: prompt, prompt })),
    reply: suggestions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  };
}
