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
    ticket.type === "bug" ? "bug reportado" : ticket.type === "melhoria" ? "solicitacao de melhoria" : "chamado";
  const statusLine =
    ticket.status === "backlog"
      ? "O item segue em backlog aguardando triagem operacional."
      : ticket.status === "doing"
        ? "O item esta em atendimento ativo pelo suporte."
        : ticket.status === "review"
          ? "O item esta em revisao tecnica."
          : "O item consta como concluido no fluxo.";
  const continuationLine =
    recentCommentCount > 0
      ? "Atualizando o historico tecnico com base no contexto atual e nos comentarios ja registrados."
      : "Registrando a primeira triagem tecnica deste chamado.";

  return compactMultiline([
    `${continuationLine}`,
    `Analise do ${itemTypeLabel} ${ticket.code}: titulo "${ticket.title}".`,
    `Contexto atual: status ${ticket.status}, prioridade ${ticket.priority} e responsavel ${ticket.assignedToName ?? "nao definido"}.`,
    statusLine,
    "Proximo passo sugerido: reproduzir o fluxo informado, validar impacto real e anexar evidencia tecnica ou conclusao objetiva.",
  ].join("\n"));
}

export async function buildCommentCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  if (!ticket) {
    return {
      tool: "create_comment",
      success: false,
      summary: "ticket nao identificado",
      reply: "Preciso do ID/codigo do chamado para montar o comentario. Exemplo: `Comentar no chamado SP-000027 ...`",
      actions: buildPromptActions(context),
    };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "sem permissao para comentar", reply: `Seu perfil nao pode comentar no chamado ${ticket.code}.` };
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
      summary: "pendencias para comentar",
      reply: compactMultiline([
        `Antes de publicar no chamado ${ticket.code}, preciso passar pelas validacoes do modulo de comentarios.`,
        "",
        formatValidationIssues(validation.issues),
        "",
        `Exemplo: comentar no chamado ${ticket.code} com [seu texto tecnico aqui]`,
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
      summary: "comentario ja existente",
      actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
      reply: compactMultiline([
        `Ja existe um comentario muito parecido no chamado ${ticket.code}.`,
        "",
        `Ultimo registro similar: ${formatDateTime(duplicateComment.updatedAt)}`,
        "Se precisar, posso montar uma atualizacao diferente ou resumir o chamado antes de comentar de novo.",
      ].join("\n")),
    };
  }

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [
      { kind: "tool", label: "Publicar comentario", tool: "create_comment", input: { ticketId: ticket.id, body: validation.body } },
    ],
    reply: compactMultiline([
      `Comentario pronto para ${ticket.code}.`,
      "",
      validation.body,
      "",
      "Se estiver ok, execute a acao abaixo para publicar no chamado.",
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
      summary: "dados invalidos",
      reply: compactMultiline([
        "Nao consegui publicar o comentario porque ele nao passou nas validacoes do modulo de comentarios.",
        "",
        ...(validation.issues.length ? [formatValidationIssues(validation.issues)] : ["Identificador do chamado ausente."]),
      ].join("\n")),
    };
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket || !canViewTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "ticket nao encontrado", reply: "Esse chamado nao esta disponivel para o seu perfil atual." };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "comentario bloqueado", reply: `Seu perfil nao pode comentar no chamado ${ticket.code}.` };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const duplicateComment = recentComments.find(
    (c) => normalizeCommentForComparison(c.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: false,
      summary: "comentario duplicado bloqueado",
      reply: compactMultiline([
        `Nao publiquei o comentario porque ja existe um registro muito parecido no chamado ${ticket.code}.`,
        "",
        `Comentario similar atualizado em ${formatDateTime(duplicateComment.updatedAt)}.`,
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
    return { tool: "create_comment", success: false, summary: "falha ao comentar", reply: "Nao consegui publicar o comentario. Verifique se o texto nao ficou vazio." };
  }

  await touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({ ticketId: ticket.id, type: "COMMENT_ADDED", actorUserId: user.id, payload: { commentId: comment.id, source: "assistant" } }).catch(() => null);
  notifyTicketCommentAdded({ ticket, comment, actorId: user.id, actorName: displayName(localUser) }).catch(() => null);

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
    reply: `Comentario publicado com sucesso no chamado ${ticket.code}.`,
  };
}
