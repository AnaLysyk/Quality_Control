import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { exportTickets, type TicketRecord } from "@/backend/ticketsStore";
import { isItDev } from "@/backend/rbac/tickets";
import { addAuditLogSafe } from "@/data/auditLogRepository";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowAll = isItDev(user);
  const filter = (item: TicketRecord) => {
    if (allowAll) return true;
    return item.createdBy === user.id;
  };

  const payload = await exportTickets(filter);

  addAuditLogSafe({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "export.executed",
    entityType: "export",
    entityLabel: "tickets_export",
    metadata: { format: "json", scope: allowAll ? "all" : "own", role: user.role ?? null },
  });

  return NextResponse.json(payload, { status: 200 });
}

