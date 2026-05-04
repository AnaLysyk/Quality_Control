import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, listTicketTimeline } from "@/lib/ticketsStore";
import { canViewTicket } from "@/lib/rbac/tickets";

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

  const timeline = await listTicketTimeline(id);
  return NextResponse.json({ items: timeline ?? [] }, { status: 200 });
}
