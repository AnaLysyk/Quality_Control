import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { canMoveTicket } from "@/lib/rbac/tickets";
import { appendTicketEvent } from "@/lib/ticketEventsStore";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  if (!canMoveTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao para alterar status" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!status || typeof status !== "string") {
    return NextResponse.json({ error: "Campo 'status' obrigatorio" }, { status: 400 });
  }

  const updated = await updateTicketStatus(id, status, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado ou status invalido" }, { status: 404 });
  }

  if (updated.status !== item.status) {
    appendTicketEvent({
      ticketId: updated.id,
      type: "STATUS_CHANGED",
      actorUserId: user.id,
      payload: { from: item.status, to: updated.status },
    }).catch((err) => console.error("Falha ao registrar evento de status:", err));
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
