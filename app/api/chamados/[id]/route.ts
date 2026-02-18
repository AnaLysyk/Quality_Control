import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { canEditTicketContent, canViewTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";


export async function GET(req: Request, context: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const enriched = await attachAssigneeToTicket(item);
  return NextResponse.json({ item: enriched }, { status: 200 });
}


export async function PUT(req: Request, context: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = context.params;
  const body = await req.json().catch(() => ({}));
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canEditTicketContent(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const wantsUpdate =
    body?.title !== undefined ||
    body?.description !== undefined ||
    body?.type !== undefined ||
    body?.priority !== undefined ||
    body?.tags !== undefined;

  if (!wantsUpdate) {
    return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400 });
  }

  const tags =
    Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : body?.tags;

  const updated = await updateTicket(id, {
    title: body?.title,
    description: body?.description,
    type: body?.type,
    priority: body?.priority,
    tags,
    updatedBy: user.id,
  });

  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  appendTicketEvent({
    ticketId: updated.id,
    type: "UPDATED",
    actorUserId: user.id,
    payload: {
      title: updated.title,
      type: updated.type ?? null,
      priority: updated.priority,
      tags: updated.tags,
    },
  }).catch((err) => console.error("Falha ao registrar atualizacao:", err));

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
