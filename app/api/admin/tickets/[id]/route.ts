import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { canMoveTicket, canViewTicket } from "@/lib/rbac/tickets";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const enriched = await attachAssigneeToTicket(item);
  return NextResponse.json({ item: enriched }, { status: 200 });
}

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
  if (!canViewTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }
  if (!canMoveTicket(user, item)) {
    return NextResponse.json({ error: "Sem permissao para alterar status" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const updated = await updateTicketStatus(id, nextStatus, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado ou status invalido" }, { status: 404 });
  }

  const enriched = await attachAssigneeToTicket(updated);
  return NextResponse.json({ item: enriched }, { status: 200 });
}
