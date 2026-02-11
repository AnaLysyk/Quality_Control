import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listAllTickets } from "@/lib/ticketsStore";
import { attachAssigneeInfo } from "@/lib/ticketsPresenter";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!user.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const items = await listAllTickets();
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}
