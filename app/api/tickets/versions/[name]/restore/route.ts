import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { restoreVersion } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { name } = await context.params;

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[TICKET_VERSION_RESTORE]", {
    userId: user.id,
    email: user.email,
    version: name,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  try {
    await restoreVersion(name);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao restaurar versao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
