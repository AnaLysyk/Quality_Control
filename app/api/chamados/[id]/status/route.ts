import { NextRequest, NextResponse } from "next/server";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel } from "@/lib/ticketsStatus";

// MÃ¡quina de estados: define transiÃ§Ãµes permitidas
const TICKET_STATE_MACHINE: Record<string, string[]> = {
  backlog: ["doing"],
  doing: ["review", "backlog"],
  review: ["done", "doing"],
  done: [],
};

// FunÃ§Ã£o para validar transiÃ§Ã£o
function isValidTransition(from: string, to: string) {
  return Array.isArray(TICKET_STATE_MACHINE[from]) && TICKET_STATE_MACHINE[from].includes(to);
}
import { notifyTicketStatusChanged } from "@/lib/notificationService";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessGlobalTicketWorkspace, canMoveTicket } from "@/lib/rbac/tickets";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  const current = await getTicketById(id);
  if (!current) {
    return NextResponse.json({ error: "Chamado nÃ£o encontrado" }, { status: 404 });
  }
  if (!canMoveTicket(user, current)) {
    return NextResponse.json({ error: "Sem permissÃ£o" }, { status: 403 });
  }
  if (canAccessGlobalTicketWorkspace(user) && !current.assignedToUserId) {
    return NextResponse.json(
      { error: "Selecione e salve um responsÃ¡vel antes de mover o ticket" },
      { status: 400 },
    );
  }


  // VÃ¡lida transiÃ§Ã£o de status
  const fromStatus = String(current.status);
  const toStatus = String(nextStatus);
  if (!isValidTransition(fromStatus, toStatus)) {
    return NextResponse.json({ error: `TransiÃ§Ã£o nÃ£o permitida: ${getTicketStatusLabel(fromStatus)} â†’ ${getTicketStatusLabel(toStatus)}` }, { status: 400 });
  }

  // Regra: nÃ£o pode ir para DONE sem comentÃ¡rio do operador responsÃ¡vel.
  if (toStatus === "done") {
    // Busca comentÃ¡rios do ticket
    const commentsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/chamados/${id}/comments`, { headers: { "Content-Type": "application/json" }, credentials: "include" });
    const commentsJson = await commentsRes.json().catch(() => ({}));
    const hasOperatorComment = Array.isArray(commentsJson.items) && commentsJson.items.some((c: any) => c.authorUserId === user.id && !c.deletedAt);
    if (!hasOperatorComment) {
      return NextResponse.json({ error: "Para concluir (DONE), Ã© obrigatÃ³rio pelo menos 1 comentÃ¡rio seu neste chamado." }, { status: 400 });
    }
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

