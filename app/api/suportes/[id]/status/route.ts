import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/backend/ticketsStore";
import { attachAssigneeToTicket } from "@/backend/ticketsPresenter";
import { canAccessGlobalTicketWorkspace, canMoveTicket } from "@/backend/rbac/tickets";
import { appendTicketEvent } from "@/backend/ticketEventsStore";
import { notifyTicketStatusChanged } from "@/backend/notificationService";
import { getTicketStatusLabel } from "@/backend/ticketsStatus";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }

  if (!canMoveTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão para alterar status" }, { status: 403 });
  }
  if (canAccessGlobalTicketWorkspace(user) && !item.assignedToUserId) {
    return NextResponse.json(
      { error: "Selecione e salve um responsável antes de mover o ticket" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!status || typeof status !== "string") {
    return NextResponse.json({ error: "Campo 'status' obrigatório" }, { status: 400 });
  }

  const updated = await updateTicketStatus(id, status, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Chamado não encontrado ou status invalido" }, { status: 404 });
  }

  if (updated.status !== item.status) {
    appendTicketEvent({
      ticketId: updated.id,
      type: "STATUS_CHANGED",
      actorUserId: user.id,
      payload: { from: item.status, to: updated.status },
    }).catch((err) => console.error("Falha ao registrar evento de status:", err));

    notifyTicketStatusChanged({
      ticket: updated,
      actorId: user.id,
      nextStatusLabel: getTicketStatusLabel(updated.status),
    }).catch((err) => console.error("Falha ao notificar status:", err));
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}

