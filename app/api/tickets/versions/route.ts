import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listVersions } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[TICKET_VERSION_LIST]", {
    userId: user.id,
    email: user.email,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  const items = await listVersions();
  return NextResponse.json({ items }, { status: 200 });
}
