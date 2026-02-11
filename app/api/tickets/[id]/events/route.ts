import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById } from "@/lib/ticketsStore";
import { listTicketEvents } from "@/lib/ticketEventsStore";
import { canViewTicket } from "@/lib/rbac/tickets";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const items = await listTicketEvents(id, { limit, offset });

  return NextResponse.json({ items }, { status: 200 });
}
