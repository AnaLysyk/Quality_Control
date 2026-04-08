import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel } from "@/lib/ticketsStatus";
import { notifyTicketStatusChanged } from "@/lib/notificationService";
import { canAccessGlobalTicketWorkspace, canMoveTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canMoveTicket(user, current)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }
  if (canAccessGlobalTicketWorkspace(user) && !current.assignedToUserId) {
    return NextResponse.json(
      { error: "Selecione e salve um responsavel antes de mover o chamado" },
      { status: 400 },
    );
  }

  const updated = await updateTicketStatus(id, nextStatus, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  appendTicketEvent({
    ticketId: updated.id,
    type: "STATUS_CHANGED",
    actorUserId: user.id,
    payload: {
      from: current.status,
      to: updated.status,
      reason: reason || null,
    },
  }).catch((err) => console.error("Falha ao registrar status:", err));

  addAuditLogSafe({
    action: updated.status === "closed" || updated.status === "done" ? "ticket.closed" : "ticket.status.changed",
    entityType: "ticket",
    entityId: updated.id,
    entityLabel: updated.title ?? null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    metadata: {
      _before: { status: current.status },
      status: updated.status,
      reason: reason || null,
    },
  });

  notifyTicketStatusChanged({
    ticket: updated,
    actorId: user.id,
    nextStatusLabel: getTicketStatusLabel(updated.status),
    reason,
  }).catch((err) => console.error("Falha ao notificar status:", err));

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
