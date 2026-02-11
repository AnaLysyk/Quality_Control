import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo } from "@/lib/ticketsPresenter";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const allowAll = isItDev(user);
  let items = allowAll ? await listAllTickets() : await listTicketsForUser(user.id);
  if (allowAll) {
    if (user.companyId) {
      items = items.filter((ticket) => ticket.companyId === user.companyId);
    } else if (user.companySlug) {
      items = items.filter((ticket) => ticket.companySlug === user.companySlug);
    } else if (Array.isArray(user.companySlugs) && user.companySlugs.length) {
      items = items.filter((ticket) => ticket.companySlug && user.companySlugs?.includes(ticket.companySlug));
    } else {
      items = [];
    }
  }
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}
