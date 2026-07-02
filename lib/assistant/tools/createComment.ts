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
    .replace(/\b(comentar|comente|comentario|comentÃ¡rio|responder|resposta|adicione|adiciona)\b/gi, "")
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
    normalized.includes("montar comentÃ¡rio tÃ©cnico") ||
    normalized.includes("gerar comentario tecnico") ||
    normalized.includes("gerar comentÃ¡rio tÃ©cnico") ||
    genericBody.length < 18
  );
}

function buildDraftCommentFromTicket(
  ticket: Awaited<ReturnType<typeof findVisibleTicket>>,
  recentCommentCount = 0,
) {
  if (!ticket) return "";
  const itemTypeLabel =
    ticket.type === "bug" ? "bug reportado" : ticket.type === "melhoria" ? "solicitaÃ§Ã£o de melhoria" : "chamado";
  const statusLine =
    ticket.status === "backlog"
      ? "O item segue em backlog aguardando triagem operacional."
      : ticket.status === "doing"
        ? "O item estÃ¡ em atendimento ativo pelo suporte."
        : ticket.status === "review"
          ? "O item estÃ¡ em revisÃ£o tÃ©cnica."
          : "O item consta como concluÃ­do no fluxo.";
  const continuationLine =
    recentCommentCount > 0
      ? "Atualizando o histÃ³rico tÃ©cnico com base no contexto atual e nos comentÃ¡rios jÃ¡ registrados."
      : "Registrando a primeira triagem tÃ©cnica deste chamado.";

  return compactMultiline([
    `${continuationLine}`,
    `AnÃ¡lise do ${itemTypeLabel} ${ticket.code}: tÃ­tulo "${ticket.title}".`,
    `Contexto atual: status ${ticket.status}, prioridade ${ticket.priority} e responsÃ¡vel ${ticket.assignedToName ?? "nÃ£o definido"}.`,
    statusLine,
    "PrÃ³ximo passo sugerido: reproduzir o fluxo informado, validar impacto real e anexar evidÃªncia tÃ©cnica ou conclusÃ£o objetiva.",
  ].join("\n"));
}

export async function buildCommentCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  const ticket = await findVisibleTicket(user, message);
  if (!ticket) {
    return {
      tool: "create_comment",
      success: false,
      summary: "ticket nÃ£o identificado",
      reply: "Preciso do ID/cÃ³digo do chamado para montar o comentÃ¡rio. Exemplo: `Comentar no chamado SP-000027 ...`",
      actions: buildPromptActions(context),
    };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "sem permissÃ£o para comentar", reply: `Seu perfil nÃ£o pode comentar no chamado ${ticket.code}.` };
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
      summary: "pendÃªncias para comentar",
      reply: compactMultiline([
        `Antes de publicar no chamado ${ticket.code}, preciso passar pelas validaÃ§Ãµes do mÃ³dulo de comentÃ¡rios.`,
        "",
        formatValidationIssues(validation.issues),
        "",
        `Exemplo: comentar no chamado ${ticket.code} com [seu texto tÃ©cnico aqui]`,
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
      summary: "comentÃ¡rio jÃ¡ existente",
      actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
      reply: compactMultiline([
        `JÃ¡ existe um comentÃ¡rio muito parecido no chamado ${ticket.code}.`,
        "",
        `Ãšltimo registro similar: ${formatDateTime(duplicateComment.updatedAt)}`,
        "Se precisar, posso montar uma atualizaÃ§Ã£o diferente ou resumir o chamado antes de comentar de novo.",
      ].join("\n")),
    };
  }

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [
      { kind: "tool", label: "Publicar comentÃ¡rio", tool: "create_comment", input: { ticketId: ticket.id, body: validation.body } },
    ],
    reply: compactMultiline([
      `ComentÃ¡rio pronto para ${ticket.code}.`,
      "",
      validation.body,
      "",
      "Se estiver ok, execute a aÃ§Ã£o abaixo para publicar no chamado.",
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
      summary: "dados invÃ¡lidos",
      reply: compactMultiline([
        "NÃ£o consegui publicar o comentÃ¡rio porque ele nÃ£o passou nas validaÃ§Ãµes do mÃ³dulo de comentÃ¡rios.",
        "",
        ...(validation.issues.length ? [formatValidationIssues(validation.issues)] : ["Identificador do chamado ausente."]),
      ].join("\n")),
    };
  }

  const ticket = await getTicketById(ticketId);
  if (!ticket || !canViewTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "ticket nÃ£o encontrado", reply: "Esse chamado nÃ£o estÃ¡ disponÃ­vel para o seu perfil atual." };
  }

  if (!canCommentTicket(user, ticket)) {
    return { tool: "create_comment", success: false, summary: "comentÃ¡rio bloqueado", reply: `Seu perfil nÃ£o pode comentar no chamado ${ticket.code}.` };
  }

  const recentComments = await listTicketComments(ticket.id, { limit: 5, offset: 0 });
  const duplicateComment = recentComments.find(
    (c) => normalizeCommentForComparison(c.body) === normalizeCommentForComparison(validation.body),
  );
  if (duplicateComment) {
    return {
      tool: "create_comment",
      success: false,
      summary: "comentÃ¡rio duplicado bloqueado",
      reply: compactMultiline([
        `NÃ£o publiquei o comentÃ¡rio porque jÃ¡ existe um registro muito parecido no chamado ${ticket.code}.`,
        "",
        `ComentÃ¡rio similar atualizado em ${formatDateTime(duplicateComment.updatedAt)}.`,
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
    return { tool: "create_comment", success: false, summary: "falha ao comentar", reply: "NÃ£o consegui publicar o comentÃ¡rio. Verifique se o texto nÃ£o ficou vazio." };
  }

  await touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({ ticketId: ticket.id, type: "COMMENT_ADDED", actorUserId: user.id, payload: { commentId: comment.id, source: "assistant" } }).catch(() => null);
  notifyTicketCommentAdded({ ticket, comment, actorId: user.id, actorName: displayName(localUser) }).catch(() => null);

  return {
    tool: "create_comment",
    success: true,
    summary: ticket.code,
    actions: [{ kind: "prompt", label: "Resumir chamado atualizado", prompt: `Resumir o chamado ${ticket.code}` }],
    reply: `ComentÃ¡rio publicado com sucesso no chamado ${ticket.code}.`,
  };
}

