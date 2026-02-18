import { NextResponse } from "next/server";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel } from "@/lib/ticketsStatus";
import { notifyTicketStatusChanged } from "@/lib/notificationService";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isItDev } from "@/lib/rbac/tickets";

export async function PATCH(req: Request, context: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user || !isItDev(user)) {
    return NextResponse.json({ error: "Apenas dev pode mover chamado" }, { status: 403 });
  }
  // Next.js App Router: context.params pode ser Promise
  const params = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
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

  notifyTicketStatusChanged({
    ticket: updated,
    actorId: user.id,
    nextStatusLabel: getTicketStatusLabel(updated.status),
    reason,
  }).catch((err) => console.error("Falha ao notificar status:", err));

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
