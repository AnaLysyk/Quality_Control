import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext } from "../types";
import { compactMultiline } from "../helpers";
import { displayName, displayRole, summarizePermissionMatrix, buildPromptActions } from "../data";
import type { AssistantExecutorResult } from "./types";

/* ──────────────────── Module-aware purpose line ──────────────────── */

function buildModulePurpose(context: AssistantScreenContext) {
  switch (context.module) {
    case "support":
      return "Esta tela é voltada para triagem, acompanhamento e ação sobre chamados.";
    case "permissions":
      return "Esta tela ajuda a entender acessos, bloqueios e visibilidade por perfil.";
    case "company":
      return `Esta tela trabalha no contexto da empresa${context.companySlug ? ` "${context.companySlug}"` : ""} e ajuda a navegar por dados e registros vinculados.`;
    case "test_plans":
      return "Esta tela é usada para estruturar e revisar planos e casos de teste.";
    case "dashboard":
      return "Esta tela centraliza indicadores, navegação e ações administrativas.";
    default:
      return "Esta tela representa o contexto atual da plataforma.";
  }
}

/* ──────────────────── Screen focus (quick-read line) ──────────────────── */

function buildScreenFocus(context: AssistantScreenContext): string {
  switch (context.module) {
    case "support":     return "chamados";
    case "permissions": return "permissões e acessos";
    case "company":     return "empresa atual";
    case "test_plans":  return "casos de teste";
    case "dashboard":   return "operação e gestão";
    default:            return "plataforma";
  }
}

/* ──────────────────── Tool executor ──────────────────── */

export async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);

  const promptList = context.suggestedPrompts
    .map((p) => `- ${p}`)
    .join("\n");

  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `${context.screenLabel}`,
      `Foco desta tela: ${buildScreenFocus(context)}`,
      "",
      context.screenSummary,
      buildModulePurpose(context),
      "",
      "Contexto atual:",
      `- Rota: ${context.route}`,
      `- Modulo: ${context.module}`,
      `- Usuario: ${displayName(currentUser)} | ${currentUser?.user ?? currentUser?.email ?? user.email}`,
      `- Perfil: ${displayRole(user)}`,
      `- Escopo: ${context.companySlug ?? user.companySlug ?? "global"}`,
      "",
      "Voce pode usar esta tela para:",
      promptList,
      "",
      `Permissoes relevantes: ${summarizePermissionMatrix(user.permissions)}`,
    ].join("\n")),
  };
}
