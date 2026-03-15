import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo } from "@/lib/ticketsPresenter";

export const revalidate = 0;

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const allowAll = isItDev(user);
  const items = allowAll ? await listAllTickets() : await listTicketsForUser(user.id);
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}
