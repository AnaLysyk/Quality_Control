
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketAssigned } from "@/lib/notificationService";
import { canAssignTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const params = await context.params;
  const { id } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (body?.assignedToUserId === undefined) {
    return NextResponse.json({ error: "Responsavel nao informado" }, { status: 400 });
  }

  if (
    typeof body.assignedToUserId === "string" &&
    !body.assignedToUserId.trim()
  ) {
    return NextResponse.json({ error: "Responsavel invalido" }, { status: 400 });
  }

  const assignedToUserId =
    typeof body.assignedToUserId === "string"
      ? body.assignedToUserId.trim() || null
      : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  if (!canAssignTicket(user, current)) {
    return NextResponse.json({ error: "Sem permissao para atribuir" }, { status: 403 });
  }

  if (current.assignedToUserId === assignedToUserId) {
    const enriched = await attachAssigneeToTicket(current);
    return NextResponse.json({ item: enriched }, { status: 200 });
  }

  // Para controle de versão: passar expectedUpdatedAt futuramente
  const updated = await updateTicket(id, {
    assignedToUserId,
    updatedBy: user.id,
    // expectedUpdatedAt: current.updatedAt, // descomente se implementar controle de versão
  });

  if (!updated) {
    // Pode ser conflito de versão se implementar expectedUpdatedAt
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  await appendTicketEvent({
    ticketId: updated.id,
    type: "ASSIGNED",
    actorUserId: user.id,
    payload: {
      from: current.assignedToUserId ?? null,
      to: updated.assignedToUserId ?? null,
    },
  }).catch((err) => console.error("Falha ao registrar atribuicao:", err));

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
