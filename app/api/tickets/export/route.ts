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
  const companyId = user.companyId ?? null;
  const companySlug = user.companySlug ?? null;

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[TICKET_EXPORT]", {
    userId: user.id,
    email: user.email,
    companyId,
    companySlug,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  const filter = (item: TicketRecord) => {
    const sameCompany =
      (companyId && item.companyId === companyId) ||
      (companySlug && item.companySlug === companySlug);
    if (!sameCompany) return false;
    if (allowAll) return true;
    return item.createdBy === user.id;
  };

  const payload = await exportTickets(filter);
  return NextResponse.json(payload, { status: 200 });
}
