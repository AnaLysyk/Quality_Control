import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { canEditTicketContent, canViewTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { notifyTicketUpdated } from "@/lib/notificationService";

export const revalidate = 0;

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
  return NextResponse.json({ item: enriched }, { status: 200 });
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
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
  if (!canEditTicketContent(user, item)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const wantsUpdate =
    body?.title !== undefined ||
    body?.description !== undefined ||
    body?.type !== undefined ||
    body?.priority !== undefined ||
    body?.tags !== undefined;

  if (!wantsUpdate) {
    return NextResponse.json({ error: "Nenhuma alteração informada" }, { status: 400 });
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
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
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
  }).catch((err) => console.error("Falha ao registrar atualização:", err));

  const changedFields: string[] = [];
  if (body?.title !== undefined && body.title !== item.title) changedFields.push("titulo");
  if (body?.description !== undefined) changedFields.push("descricao");
  if (body?.priority !== undefined && body.priority !== item.priority) changedFields.push("prioridade");
  if (body?.type !== undefined && body.type !== item.type) changedFields.push("tipo");
  notifyTicketUpdated({
    ticket: updated,
    actorId: user.id,
    actorName: user.user ?? user.email ?? null,
    changedFields,
  }).catch((err) => console.error("Falha ao notificar atualizacao:", err));

  const enriched = await attachAssigneeToTicket(updated);

  addAuditLogSafe({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "ticket.updated",
    entityType: "ticket",
    entityId: updated.id,
    entityLabel: updated.title ?? null,
    metadata: { type: updated.type ?? null, priority: updated.priority, role: user.role ?? null, _payload: body },
  });

  return NextResponse.json({ item: enriched }, { status: 200 });
}
