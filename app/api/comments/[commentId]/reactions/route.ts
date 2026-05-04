import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById } from "@/lib/ticketsStore";
import { findTicketCommentById } from "@/lib/ticketCommentsStore";
import { addReaction } from "@/lib/ticketReactionsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketReactionAdded } from "@/lib/notificationService";
import { canViewTicket } from "@/lib/rbac/tickets";

export async function POST(req: Request, context: { params: Promise<{ commentId: string }> }) {
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

  const body = await req.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type.toLowerCase() : "";
  if (type !== "like") {
    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
  }

  const { reaction, created } = await addReaction({
    ticketId: ticket.id,
    commentId,
    userId: user.id,
    type: "like",
  });

  if (created) {
    appendTicketEvent({
      ticketId: ticket.id,
      type: "REACTION_ADDED",
      actorUserId: user.id,
      payload: { commentId, type: "like" },
    }).catch((err) => console.error("Falha ao registrar reacao:", err));

    notifyTicketReactionAdded({
      ticket,
      comment,
      actorId: user.id,
    }).catch((err) => console.error("Falha ao notificar reacao:", err));
  }

  return NextResponse.json({ item: reaction }, { status: 201 });
}
