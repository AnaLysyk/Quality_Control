import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, touchTicket } from "@/lib/ticketsStore";
import { findTicketCommentById, softDeleteTicketComment, updateTicketComment } from "@/lib/ticketCommentsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { canViewTicket, isItDev } from "@/lib/rbac/tickets";

type RouteContext = {
  params: {
    commentId?: string;
  };
};

export async function PATCH(req: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > 16384) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  const params = await context.params;
  const commentId = String(params.commentId ?? "").trim();
  if (!commentId) {
    return NextResponse.json({ error: "commentId ausente" }, { status: 400 });
  }
  if (commentId.length > 120) {
    return NextResponse.json({ error: "commentId invalido" }, { status: 400 });
  }

  const comment = await findTicketCommentById(commentId);
  if (!comment) {
    return NextResponse.json({ error: "Comentario nao encontrado" }, { status: 404 });
  }

  const ticket = await getTicketById(comment.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const isAuthor = comment.authorUserId === user.id;
  if (!isAuthor && !isItDev(user)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const bodyValue = (parsed as { body?: unknown }).body;
  if (typeof bodyValue !== "string") {
    return NextResponse.json({ error: "Campo body invalido" }, { status: 400 });
  }

  const trimmedValue = bodyValue.trim();
  if (trimmedValue.length === 0) {
    return NextResponse.json({ error: "Campo body obrigatorio" }, { status: 400 });
  }

  const updated = await updateTicketComment(commentId, trimmedValue, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Comentario invalido" }, { status: 400 });
  }

  touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({
    ticketId: ticket.id,
    type: "COMMENT_UPDATED",
    actorUserId: user.id,
    payload: { commentId },
  }).catch((err) => console.error("Falha ao registrar edicao:", err));

  return NextResponse.json({ item: updated }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > 0) {
    return NextResponse.json({ error: "Payload nao suportado" }, { status: 415 });
  }

  const params = await context.params;
  const commentId = String(params.commentId ?? "").trim();
  if (!commentId) {
    return NextResponse.json({ error: "commentId ausente" }, { status: 400 });
  }
  if (commentId.length > 120) {
    return NextResponse.json({ error: "commentId invalido" }, { status: 400 });
  }

  const comment = await findTicketCommentById(commentId);
  if (!comment) {
    return NextResponse.json({ error: "Comentario nao encontrado" }, { status: 404 });
  }

  const ticket = await getTicketById(comment.ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const isAuthor = comment.authorUserId === user.id;
  if (!isAuthor && !isItDev(user)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const removed = await softDeleteTicketComment(commentId, user.id);
  if (!removed) {
    return NextResponse.json({ error: "Falha ao remover comentario" }, { status: 400 });
  }

  touchTicket(ticket.id, user.id).catch(() => null);
  appendTicketEvent({
    ticketId: ticket.id,
    type: "COMMENT_DELETED",
    actorUserId: user.id,
    payload: { commentId },
  }).catch((err) => console.error("Falha ao registrar exclusao:", err));

  return NextResponse.json({ item: removed }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
