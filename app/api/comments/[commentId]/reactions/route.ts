import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById } from "@/lib/ticketsStore";
import { findTicketCommentById } from "@/lib/ticketCommentsStore";
import { addReaction } from "@/lib/ticketReactionsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketReactionAdded } from "@/lib/notificationService";
import { canViewTicket } from "@/lib/rbac/tickets";

type RouteContext = {
  params: {
    commentId?: string;
  };
};

export async function POST(req: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > 4096) {
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const typeRaw = (body as { type?: unknown }).type;
  const type = typeof typeRaw === "string" ? typeRaw.trim().toLowerCase() : "";
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

  return NextResponse.json({ item: reaction }, { status: created ? 201 : 200, headers: { "Cache-Control": "no-store" } });
}
