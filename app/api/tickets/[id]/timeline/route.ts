import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, listTicketTimeline } from "@/lib/ticketsStore";
import { canViewTicket } from "@/lib/rbac/tickets";

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

  let timeline = await listTicketTimeline(id);
  if (!Array.isArray(timeline)) timeline = [];
  if (timeline.length > 200) timeline = timeline.slice(0, 200);
  return NextResponse.json({ items: timeline }, { status: 200 });
}
