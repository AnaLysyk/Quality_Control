import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, touchTicket } from "@/lib/ticketsStore";
import { findTicketCommentById, softDeleteTicketComment, updateTicketComment } from "@/lib/ticketCommentsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { canViewTicket, isItDev } from "@/lib/rbac/tickets";

export async function PATCH(req: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { commentId } = await context.params;
  const comment = await findTicketCommentById(commentId);
  if (!comment) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const ticket = await getTicketById(comment.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const isAuthor = comment.authorUserId === user.id;
  if (!isAuthor && !isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updated = await updateTicketComment(commentId, body?.body, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Comentário invalido" }, { status: 400 });
  }

  touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({
    ticketId: ticket.id,
    type: "COMMENT_UPDATED",
    actorUserId: user.id,
    payload: { commentId },
  }).catch((err) => console.error("Falha ao registrar edição:", err));

  return NextResponse.json({ item: updated }, { status: 200 });
}

export async function DELETE(req: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { commentId } = await context.params;
  const comment = await findTicketCommentById(commentId);
  if (!comment) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const ticket = await getTicketById(comment.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const isAuthor = comment.authorUserId === user.id;
  if (!isAuthor && !isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const removed = await softDeleteTicketComment(commentId, user.id);
  if (!removed) {
    return NextResponse.json({ error: "Falha ao remover comentário" }, { status: 400 });
  }

  touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({
    ticketId: ticket.id,
    type: "COMMENT_DELETED",
    actorUserId: user.id,
    payload: { commentId },
  }).catch((err) => console.error("Falha ao registrar exclusão:", err));

  return NextResponse.json({ item: removed }, { status: 200 });
}
