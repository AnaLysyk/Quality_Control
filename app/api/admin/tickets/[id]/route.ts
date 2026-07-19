import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/backend/ticketsStore";
import { attachAssigneeToTicket } from "@/backend/ticketsPresenter";
import { canMoveTicket, canViewTicket } from "@/backend/rbac/tickets";
import { notifyTicketStatusChanged } from "@/backend/notificationService";

export const revalidate = 0;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const enriched = await attachAssigneeToTicket(item);
  return NextResponse.json({ item: enriched }, { status: 200 });
}

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
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!canMoveTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissão para alterar status" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const updated = await updateTicketStatus(id, nextStatus, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Chamado não encontrado ou status invalido" }, { status: 404 });
  }

  notifyTicketStatusChanged({
    ticket: updated,
    actorId: user.id,
    nextStatusLabel: nextStatus,
  }).catch((err) => console.error("Falha ao notificar status:", err));

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}

