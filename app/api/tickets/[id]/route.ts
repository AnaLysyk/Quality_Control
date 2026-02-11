import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, deleteTicketForUser, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketAssigned } from "@/lib/notificationService";
import { canAssignTicket, canEditTicketContent, canViewTicket, isTicketAdmin } from "@/lib/rbac/tickets";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  return NextResponse.json({ item }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const wantsAssignment = body?.assignedToUserId !== undefined;
  const wantsContentUpdate =
    body?.title !== undefined ||
    body?.description !== undefined ||
    body?.priority !== undefined ||
    body?.tags !== undefined;

  if (!wantsAssignment && !wantsContentUpdate) {
    return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400 });
  }

  if (wantsAssignment && !canAssignTicket(user)) {
    return NextResponse.json({ error: "Sem permissao para atribuir" }, { status: 403 });
  }
  if (wantsContentUpdate && !canEditTicketContent(user, item)) {
    return NextResponse.json({ error: "Sem permissao para editar" }, { status: 403 });
  }

  const tags =
    Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : body?.tags;

  const updated = await updateTicket(id, {
    title: body?.title,
    description: body?.description,
    priority: body?.priority,
    tags,
    assignedToUserId: body?.assignedToUserId,
    updatedBy: user.id,
  });

  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  if (wantsAssignment && updated.assignedToUserId !== item.assignedToUserId) {
    appendTicketEvent({
      ticketId: updated.id,
      type: "ASSIGNED",
      actorUserId: user.id,
      payload: {
        from: item.assignedToUserId ?? null,
        to: updated.assignedToUserId ?? null,
      },
    }).catch((err) => console.error("Falha ao registrar atribuicao:", err));
    notifyTicketAssigned({
      ticket: updated,
      assigneeId: updated.assignedToUserId ?? "",
      actorId: user.id,
    }).catch((err) => console.error("Falha ao notificar atribuicao:", err));
  }

  if (wantsContentUpdate) {
    appendTicketEvent({
      ticketId: updated.id,
      type: "UPDATED",
      actorUserId: user.id,
      payload: {
        title: updated.title,
        priority: updated.priority,
        tags: updated.tags,
      },
    }).catch((err) => console.error("Falha ao registrar atualizacao:", err));
  }

  return NextResponse.json({ item: updated }, { status: 200 });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  const canDelete = isTicketAdmin(user) || item.createdBy === user.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }
  const removed = await deleteTicketForUser(item.createdBy, id);
  return NextResponse.json({ ok: removed }, { status: 200 });
}
