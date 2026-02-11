import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicket, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel } from "@/lib/ticketsStatus";
import { notifyTicketAssigned, notifyTicketStatusChanged } from "@/lib/notificationService";
import { canMoveTicket, isItDev, isTicketAdmin } from "@/lib/rbac/tickets";

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
  if (!canMoveTicket(user)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const updated = await updateTicketStatus(id, nextStatus, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  let finalTicket = updated;
  if (!current.assignedToUserId && (isItDev(user) || isTicketAdmin(user))) {
    const assigned = await updateTicket(id, {
      assignedToUserId: user.id,
      updatedBy: user.id,
    });
    if (assigned) {
      finalTicket = assigned;
      notifyTicketAssigned({
        ticket: finalTicket,
        assigneeId: user.id,
        actorId: user.id,
      }).catch((err) => console.error("Falha ao notificar atribuicao:", err));
    }
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

  notifyTicketStatusChanged({
    ticket: finalTicket,
    actorId: user.id,
    nextStatusLabel: getTicketStatusLabel(updated.status),
    reason,
  }).catch((err) => console.error("Falha ao notificar status:", err));

  return NextResponse.json({ item: finalTicket }, { status: 200 });
}
