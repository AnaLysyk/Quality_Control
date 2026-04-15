import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, deleteTicketForUser, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketAssigned } from "@/lib/notificationService";
import { canAssignTicket, canEditTicketContent, canManageAllTickets, canMoveTicket, canViewTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { listAdminUserItems } from "@/lib/adminUsers";
import { isTechnicalSupportUser } from "@/lib/supportAccess";

export const revalidate = 0;

function buildSupportAssigneeOptions(items: Awaited<ReturnType<typeof listAdminUserItems>>) {
  return items
    .filter(
      (item) =>
        item.active !== false &&
        isTechnicalSupportUser({
          role: item.role ?? null,
          permissionRole: item.permission_role ?? null,
        }),
    )
    .map((item) => ({
      id: item.id,
      label: item.name || item.email || item.id,
      email: item.email,
      role: item.permission_role,
    }));
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const enriched = await attachAssigneeToTicket(item);
  const assigneeOptions = canAssignTicket(user, item)
    ? buildSupportAssigneeOptions(await listAdminUserItems())
    : [];
  return NextResponse.json(
    {
      item: enriched,
      assigneeOptions,
      capabilities: {
        canEditContent: canEditTicketContent(user, item),
        canAssign: canAssignTicket(user, item),
        canMoveStatus: canMoveTicket(user, item),
      },
    },
    { status: 200 },
  );
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const wantsAssignment = body?.assignedToUserId !== undefined;
  const wantsContentUpdate =
    body?.title !== undefined ||
    body?.description !== undefined ||
    body?.type !== undefined ||
    body?.priority !== undefined ||
    body?.tags !== undefined;

  if (!wantsAssignment && !wantsContentUpdate) {
    return NextResponse.json({ error: "Nenhuma alteração informada" }, { status: 400 });
  }

  if (wantsAssignment && !canAssignTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão para atribuir" }, { status: 403 });
  }
  if (wantsContentUpdate && !canEditTicketContent(user, item)) {
    return NextResponse.json({ error: "Sem permissão para editar" }, { status: 403 });
  }

  const tags =
    Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : body?.tags;

  const updated = await updateTicket(id, {
    title: body?.title,
    description: body?.description,
    type: body?.type,
    priority: body?.priority,
    tags,
    assignedToUserId: body?.assignedToUserId,
    updatedBy: user.id,
  });

  if (!updated) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
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
        type: updated.type ?? null,
        priority: updated.priority,
        tags: updated.tags,
      },
    }).catch((err) => console.error("Falha ao registrar atualização:", err));
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }

  const canDelete = canManageAllTickets(user);

  if (!canDelete) {
    return NextResponse.json({ error: "Somente o suporte pode excluir tickets" }, { status: 403 });
  }

  const removed = await deleteTicketForUser(item.createdBy, id);
  return NextResponse.json({ ok: removed }, { status: 200 });
}
