import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { compactMultiline } from "../helpers";
import { buildPromptActions, displayName, displayRole, summarizePermissionMatrix } from "../data";
import type { AssistantScreenContext } from "../types";
import type { AssistantExecutorResult } from "./types";

function buildImmediateActions(context: AssistantScreenContext) {
  switch (context.module) {
    case "support":
      return [
        "Localizar chamados por codigo, status, prioridade ou responsavel.",
        "Entender o proximo passo de um ticket antes de mover ou comentar.",
        "Transformar um relato solto em chamado estruturado quando faltar registro.",
      ];
    case "permissions":
      return [
        "Explicar por que um perfil nao acessa determinada tela ou modulo.",
        "Comparar escopos e revisar quem consegue ver ou editar cada area.",
        "Apontar o ajuste necessario para liberar ou restringir acesso.",
      ];
    case "company":
      return [
        "Resumir a empresa atual e os registros ligados a ela.",
        "Buscar chamados, usuarios ou vinculos dentro deste contexto.",
        "Preparar a proxima acao antes de trocar de empresa ou abrir um ticket.",
      ];
    case "test_plans":
      return [
        "Rascunhar casos de teste com base em bug, ticket ou fluxo descrito.",
        "Organizar pre-condicoes, passos e resultado esperado sem perder contexto.",
        "Revisar a cobertura do fluxo antes de salvar ou compartilhar o plano.",
      ];
    case "dashboard":
      return [
        "Identificar qual modulo resolve a tarefa que voce quer destravar.",
        "Resumir o contexto atual antes de navegar para suporte, usuarios ou empresas.",
        "Buscar registros ou pedir o proximo passo com base na sua permissao.",
      ];
    default:
      return [
        "Entender onde voce esta e qual eh a proxima acao util na plataforma.",
        "Buscar registros por palavra-chave, codigo ou contexto atual.",
        "Transformar um pedido aberto em uma acao objetiva para o assistente.",
      ];
  }
}

function stripScreenLead(context: AssistantScreenContext) {
  const lead = `Voce esta em: ${context.screenLabel}.`;
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
  if (summary === "sem modulos liberados") {
    return "Permissoes relevantes: nenhum modulo liberado para o perfil atual.";
  }
  return `Permissoes relevantes: ${summary}`;
}

export async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);
  const actionList = buildImmediateActions(context).map((item) => `- ${item}`).join("\n");
  const promptList = context.suggestedPrompts.slice(0, 5).map((prompt) => `- ${prompt}`).join("\n");

  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `Voce esta em ${context.screenLabel}.`,
      stripScreenLead(context),
      "",
      "O que voce pode fazer agora:",
      actionList,
      "",
      "Sugestoes de prompt:",
      promptList,
      "",
      "Contexto atual:",
      `- Modulo: ${context.module}`,
      `- Escopo: ${buildScopeLabel(user, context)}`,
      `- Perfil: ${displayRole(user)}`,
      `- Usuario: ${displayName(currentUser)}`,
      "",
      buildPermissionLine(user),
    ].join("\n")),
  };
}
