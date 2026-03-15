import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById, listLocalUsers } from "@/lib/auth/localStore";
import { getTicketById, touchTicket } from "@/lib/ticketsStore";
import { listTicketComments, createTicketComment } from "@/lib/ticketCommentsStore";
import { listReactionsByTicket } from "@/lib/ticketReactionsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCommentAdded } from "@/lib/notificationService";
import { canCommentTicket } from "@/lib/rbac/tickets";

export const revalidate = 0;

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

function buildCommentAuthorPayload(
  comment: {
    authorUserId: string;
    authorName?: string | null;
  },
  user: {
    email?: string | null;
    user?: string | null;
    avatar_url?: string | null;
    full_name?: string | null;
    name?: string | null;
  } | null | undefined,
) {
  return {
    authorName: comment.authorName ?? resolveDisplayName(user),
    authorLogin: user?.user ?? null,
    authorEmail: user?.email ?? null,
    authorAvatarUrl: user?.avatar_url ?? null,
  };
}

function isRateLimited(lastCreatedAt?: string | null) {
  if (!lastCreatedAt) return false;
  const last = new Date(lastCreatedAt).getTime();
  if (!Number.isFinite(last)) return false;
  return Date.now() - last < 4000;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canCommentTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const comments = await listTicketComments(id, { limit, offset });
  const reactions = await listReactionsByTicket(id);
  const users = await listLocalUsers();
  const userById = new Map(users.map((item) => [item.id, item]));

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
    const author = userById.get(comment.authorUserId);
    return {
      ...comment,
      ...buildCommentAuthorPayload(comment, author),
      reactions: { like: reactionInfo.like },
      viewerHasLiked: reactionInfo.viewerHasLiked,
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canCommentTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const recent = await listTicketComments(id, { limit: 5, offset: 0 });
  const lastMine = recent.find((item) => item.authorUserId === user.id);
  if (isRateLimited(lastMine?.createdAt)) {
    return NextResponse.json({ error: "Aguarde alguns segundos para comentar novamente." }, { status: 429 });
  }

  const localUser = await getLocalUserById(user.id);
  const comment = await createTicketComment({
    ticketId: id,
    authorUserId: user.id,
    authorName: resolveDisplayName(localUser),
    body: body?.body,
  });

  if (!comment) {
    return NextResponse.json({ error: "Comentario invalido" }, { status: 400 });
  }

  await touchTicket(id, user.id).catch(() => null);

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
    actorName: resolveDisplayName(localUser),
  }).catch((err) => console.error("Falha ao notificar comentario:", err));

  return NextResponse.json(
    { item: { ...comment, ...buildCommentAuthorPayload(comment, localUser) } },
    { status: 201 },
  );
}
