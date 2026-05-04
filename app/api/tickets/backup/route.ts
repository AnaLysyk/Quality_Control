import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createBackup } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    await createBackup();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar backup";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
