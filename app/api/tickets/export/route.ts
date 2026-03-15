import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { exportTickets, type TicketRecord } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const allowAll = isItDev(user);
  const filter = (item: TicketRecord) => {
    if (allowAll) return true;
    return item.createdBy === user.id;
  };

  const payload = await exportTickets(filter);
  return NextResponse.json(payload, { status: 200 });
}
