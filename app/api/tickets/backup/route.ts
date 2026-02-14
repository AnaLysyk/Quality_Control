import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createBackup } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function POST(req: Request) {
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
  console.info("[TICKET_BACKUP]", {
    userId: user.id,
    email: user.email,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  try {
    await createBackup();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar backup";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
