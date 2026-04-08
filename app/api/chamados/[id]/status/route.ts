import { NextRequest, NextResponse } from "next/server";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel } from "@/lib/ticketsStatus";

// Máquina de estados: define transições permitidas
const TICKET_STATE_MACHINE: Record<string, string[]> = {
  backlog: ["doing"],
  doing: ["review", "backlog"],
  review: ["done", "doing"],
  done: [],
};

// Função para validar transição
function isValidTransition(from: string, to: string) {
  return Array.isArray(TICKET_STATE_MACHINE[from]) && TICKET_STATE_MACHINE[from].includes(to);
}
import { notifyTicketStatusChanged } from "@/lib/notificationService";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessGlobalTicketWorkspace, canMoveTicket } from "@/lib/rbac/tickets";

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  // Next.js App Router: context.params pode ser Promise
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ id: string }>)
    : (context.params as { id: string });
  const id = params.id;
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
      { error: "Selecione e salve um responsavel antes de mover o ticket" },
      { status: 400 },
    );
  }


  // Valida transição de status
  const fromStatus = String(current.status);
  const toStatus = String(nextStatus);
  if (!isValidTransition(fromStatus, toStatus)) {
    return NextResponse.json({ error: `Transição não permitida: ${getTicketStatusLabel(fromStatus)} → ${getTicketStatusLabel(toStatus)}` }, { status: 400 });
  }

  // Regra: não pode ir para DONE sem comentário de dev
  if (toStatus === "done") {
    // Busca comentários do ticket
    const commentsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/chamados/${id}/comments`, { headers: { "Content-Type": "application/json" }, credentials: "include" });
    const commentsJson = await commentsRes.json().catch(() => ({}));
    const hasDevComment = Array.isArray(commentsJson.items) && commentsJson.items.some((c: any) => c.authorUserId === user.id && !c.deletedAt);
    if (!hasDevComment) {
      return NextResponse.json({ error: "Para concluir (DONE), é obrigatório pelo menos 1 comentário seu neste chamado." }, { status: 400 });
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
