import { NextResponse } from "next/server";
// Autenticação removida para endpoint público
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketAssigned } from "@/lib/notificationService";
// RBAC removido para endpoint público
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const assignedToUserId = typeof body?.assignedToUserId === "string" ? body.assignedToUserId.trim() : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (body?.assignedToUserId === undefined) {
    return NextResponse.json({ error: "Responsavel nao informado" }, { status: 400 });
  }

  const updated = await updateTicket(id, {
    assignedToUserId: assignedToUserId || null,
    updatedBy: body?.actorUserId ?? null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  appendTicketEvent({
    ticketId: updated.id,
    type: "ASSIGNED",
    actorUserId: body?.actorUserId ?? null,
    payload: {
      from: current.assignedToUserId ?? null,
      to: updated.assignedToUserId ?? null,
    },
  }).catch((err) => console.error("Falha ao registrar atribuicao:", err));

  if (updated.assignedToUserId) {
    notifyTicketAssigned({
      ticket: updated,
      assigneeId: updated.assignedToUserId,
      actorId: body?.actorUserId ?? null,
    }).catch((err) => console.error("Falha ao notificar atribuicao:", err));
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
