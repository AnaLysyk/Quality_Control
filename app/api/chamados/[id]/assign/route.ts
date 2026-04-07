import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketAssigned } from "@/lib/notificationService";
import { canAssignTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const assignedToUserId =
    typeof body?.assignedToUserId === "string" ? body.assignedToUserId.trim() : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canAssignTicket(user, current)) {
    return NextResponse.json({ error: "Sem permissao para atribuir" }, { status: 403 });
  }

  if (body?.assignedToUserId === undefined) {
    return NextResponse.json({ error: "Responsavel nao informado" }, { status: 400 });
  }

  const updated = await updateTicket(id, {
    assignedToUserId: assignedToUserId || null,
    updatedBy: user.id,
  });

  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  appendTicketEvent({
    ticketId: updated.id,
    type: "ASSIGNED",
    actorUserId: user.id,
    payload: {
      from: current.assignedToUserId ?? null,
      to: updated.assignedToUserId ?? null,
    },
  }).catch((err) => console.error("Falha ao registrar atribuicao:", err));

  addAuditLogSafe({
    action: "ticket.assigned",
    entityType: "ticket",
    entityId: updated.id,
    entityLabel: updated.title ?? null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    metadata: {
      from: current.assignedToUserId ?? null,
      to: updated.assignedToUserId ?? null,
    },
  });

  if (updated.assignedToUserId) {
    notifyTicketAssigned({
      ticket: updated,
      assigneeId: updated.assignedToUserId,
      actorId: user.id,
    }).catch((err) => console.error("Falha ao notificar atribuicao:", err));
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
