import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { getTicketById, touchTicket } from "@/lib/ticketsStore";
import { listTicketComments, createTicketComment, getLastCommentByUser } from "@/lib/ticketCommentsStore";
import { listReactionsByTicket } from "@/lib/ticketReactionsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCommentAdded } from "@/lib/notificationService";
import { canCommentTicket } from "@/lib/rbac/tickets";

function isRateLimited(lastCreatedAt?: string | null) {
  if (!lastCreatedAt) return false;
  const last = new Date(lastCreatedAt).getTime();
  if (!Number.isFinite(last)) return false;
  return Date.now() - last < 4000;
}

const MAX_COMMENT_LENGTH = 2000;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json(
      { error: "Chamado nao encontrado. Atualize a pagina e tente novamente." },
      { status: 404 },
    );
  }
  if (!canCommentTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 100;
  const rawOffset = Number(url.searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

  try {
    const [comments, reactions] = await Promise.all([
      listTicketComments(id, { limit, offset }),
      listReactionsByTicket(id),
    ]);

    const reactionMap = new Map<string, { like: number; viewerHasLiked: boolean }>();
    for (const reaction of reactions) {
      const current = reactionMap.get(reaction.commentId) ?? { like: 0, viewerHasLiked: false };
      if (reaction.type === "like") {
        current.like += 1;
        if (reaction.userId === user.id) {
          current.viewerHasLiked = true;
        }
      }
      reactionMap.set(reaction.commentId, current);
    }

    const items = comments.map((comment) => {
      const reactionInfo = reactionMap.get(comment.id) ?? { like: 0, viewerHasLiked: false };
      return {
        ...comment,
        reactions: { like: reactionInfo.like },
        viewerHasLiked: reactionInfo.viewerHasLiked,
      };
    });

    const res = NextResponse.json({ items }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[chamados][comments][GET] falha ao carregar comentarios", err);
    return NextResponse.json({ error: "Falha ao carregar comentarios" }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json(
      { error: "Chamado nao encontrado. Atualize a pagina e tente novamente." },
      { status: 404 },
    );
  }
  if (!canCommentTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const commentBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!commentBody) {
    return NextResponse.json({ error: "Comentario invalido" }, { status: 400 });
  }
  if (commentBody.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: "Comentario muito longo" }, { status: 413 });
  }

  const lastMine = await getLastCommentByUser(id, user.id);
  if (isRateLimited(lastMine?.createdAt)) {
    return NextResponse.json({ error: "Aguarde alguns segundos para comentar novamente." }, { status: 429 });
  }

  const localUser = await getLocalUserById(user.id);
  try {
    const comment = await createTicketComment({
      ticketId: id,
      authorUserId: user.id,
      authorName: localUser?.name ?? null,
      body: commentBody,
    });

    if (!comment) {
      return NextResponse.json({ error: "Comentario invalido" }, { status: 400 });
    }

    touchTicket(id, user.id).catch(() => null);

    appendTicketEvent({
      ticketId: id,
      type: "COMMENT_ADDED",
      actorUserId: user.id,
      payload: { commentId: comment.id },
    }).catch((err) => console.error("Falha ao registrar comentario:", err));

    notifyTicketCommentAdded({
      ticket,
      comment,
      actorId: user.id,
      actorName: localUser?.name ?? null,
    }).catch((err) => console.error("Falha ao notificar comentario:", err));

    const res = NextResponse.json({ item: comment }, { status: 201 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[chamados][comments][POST] erro ao criar comentario", err);
    return NextResponse.json({ error: "Erro ao criar comentario" }, { status: 500 });
  }
}
