import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { canCommentTicket, canViewTicket } from "@/lib/rbac/tickets";
import { createTicketComment, listTicketComments } from "@/lib/ticketCommentsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCommentAdded } from "@/lib/notificationService";
import { getTicketById, touchTicket } from "@/lib/ticketsStore";
import type { AssistantScreenContext, AssistantToolAction } from "../types";
import { compactMultiline, formatDateTime, normalizeCommentForComparison, normalizeSearch, normalizeText, formatValidationIssues } from "../helpers";
import { buildPromptActions, displayName, findVisibleTicket } from "../data";
import { validateAssistantCommentBody } from "../validations";
import type { AssistantExecutorResult } from "./types";

function extractCommentBody(message: string) {
  return message
    .replace(/\b(comentar|comente|comentario|comentário|responder|resposta|adicione|adiciona)\b/gi, "")
    .replace(/\b(montar|monta|gerar|gera|criar|cria)\b/gi, "")
    .replace(/\b(chamado|ticket|suporte)\b/gi, "")
    .replace(/\bSP[-\s]?\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericCommentRequest(message: string, body: string) {
  const normalized = normalizeSearch(message);
  const genericBody = normalizeSearch(body);
  return (
    normalized.includes("montar comentario tecnico") ||
    normalized.includes("montar comentário técnico") ||
    normalized.includes("gerar comentario tecnico") ||
    normalized.includes("gerar comentário técnico") ||
    genericBody.length < 18
  );
}

function buildDraftCommentFromTicket(
  ticket: Awaited<ReturnType<typeof findVisibleTicket>>,
  recentCommentCount = 0,
) {
  if (!ticket) return "";
  const itemTypeLabel =
    ticket.type === "bug" ? "bug reportado" : ticket.type === "melhoria" ? "solicitação de melhoria" : "chamado";
  const statusLine =
    ticket.status === "backlog"
      ? "O item segue em backlog aguardando triagem operacional."
      : ticket.status === "doing"
        ? "O item está em atendimento ativo pelo suporte."
        : ticket.status === "review"
          ? "O item está em revisão técnica."
          : "O item consta como concluído no fluxo.";
  const continuationLine =
    recentCommentCount > 0
      ? "Atualizando o histórico técnico com base no contexto atual e nos comentários já registrados."
      : "Registrando a primeira triagem técnica deste chamado.";

  return compactMultiline([
    `${continuationLine}`,
    `Análise do ${itemTypeLabel} ${ticket.code}: título "${ticket.title}".`,
    `Contexto atual: status ${ticket.status}, prioridade ${ticket.priority} e responsável ${ticket.assignedToName ?? "não definido"}.`,
    statusLine,
    "Próximo passo sugerido: reproduzir o fluxo informado, validar impacto real e anexar evidência técnica ou conclusão objetiva.",
  ].join("\n"));
}

export async function buildCommentCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  if (!ticket) {
    return {
      tool: "create_comment",
      success: false,
      summary: "ticket não identificado",
      reply: "Preciso do ID/código do chamado para montar o comentário. Exemplo: `Comentar no chamado SP-000027 ...`",
      actions: buildPromptActions(context),
    };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "sem permissão para comentar", reply: `Seu perfil não pode comentar no chamado ${ticket.code}.` };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const extractedBody = extractCommentBody(message);
  const body = isGenericCommentRequest(message, extractedBody)
    ? buildDraftCommentFromTicket(ticket, recentComments.length)
    : extractedBody;
  const validation = validateAssistantCommentBody(body);

  if (!validation.ok) {
    return {
      tool: "create_comment",
      success: true,
      summary: "pendências para comentar",
      reply: compactMultiline([
        `Antes de publicar no chamado ${ticket.code}, preciso passar pelas validações do módulo de comentários.`,
        "",
        formatValidationIssues(validation.issues),
        "",
        `Exemplo: comentar no chamado ${ticket.code} com [seu texto técnico aqui]`,
      ].join("\n")),
    };
  }

  const duplicateComment = recentComments.find(
    (c) => normalizeCommentForComparison(c.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: true,
      summary: "comentário já existente",
      actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
      reply: compactMultiline([
        `Já existe um comentário muito parecido no chamado ${ticket.code}.`,
        "",
        `Último registro similar: ${formatDateTime(duplicateComment.updatedAt)}`,
        "Se precisar, posso montar uma atualização diferente ou resumir o chamado antes de comentar de novo.",
      ].join("\n")),
    };
  }

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [
      { kind: "tool", label: "Publicar comentário", tool: "create_comment", input: { ticketId: ticket.id, body: validation.body } },
    ],
    reply: compactMultiline([
      `Comentário pronto para ${ticket.code}.`,
      "",
      validation.body,
      "",
      "Se estiver ok, execute a ação abaixo para publicar no chamado.",
    ].join("\n")),
  };
}

export async function executeCreateComment(user: AuthUser, action: AssistantToolAction): Promise<AssistantExecutorResult> {
  const ticketId = normalizeText(action.input.ticketId, 80);
  const validation = validateAssistantCommentBody(action.input.body);
  if (!ticketId || !validation.ok) {
    return {
      tool: "create_comment",
      success: false,
      summary: "dados inválidos",
      reply: compactMultiline([
        "Não consegui publicar o comentário porque ele não passou nas validações do módulo de comentários.",
        "",
        ...(validation.issues.length ? [formatValidationIssues(validation.issues)] : ["Identificador do chamado ausente."]),
      ].join("\n")),
    };
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket || !canViewTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "ticket não encontrado", reply: "Esse chamado não está disponível para o seu perfil atual." };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "comentário bloqueado", reply: `Seu perfil não pode comentar no chamado ${ticket.code}.` };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const duplicateComment = recentComments.find(
    (c) => normalizeCommentForComparison(c.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: false,
      summary: "comentário duplicado bloqueado",
      reply: compactMultiline([
        `Não publiquei o comentário porque já existe um registro muito parecido no chamado ${ticket.code}.`,
        "",
        `Comentário similar atualizado em ${formatDateTime(duplicateComment.updatedAt)}.`,
      ].join("\n")),
    };
  }

  const localUser = await getLocalUserById(user.id);
  const comment = await createTicketComment({
    ticketId: ticket.id,
    authorUserId: user.id,
    authorName: displayName(localUser),
    body: validation.body,
  });

  if (!comment) {
    return { tool: "create_comment", success: false, summary: "falha ao comentar", reply: "Não consegui publicar o comentário. Verifique se o texto não ficou vazio." };
  }

  await touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({ ticketId: ticket.id, type: "COMMENT_ADDED", actorUserId: user.id, payload: { commentId: comment.id, source: "assistant" } }).catch(() => null);
  notifyTicketCommentAdded({ ticket, comment, actorId: user.id, actorName: displayName(localUser) }).catch(() => null);

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
    reply: `Comentário publicado com sucesso no chamado ${ticket.code}.`,
  };
}
