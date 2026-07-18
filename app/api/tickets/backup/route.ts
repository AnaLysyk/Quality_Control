import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { createBackup } from "@/backend/ticketsStore";
import { isItDev } from "@/backend/rbac/tickets";

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

