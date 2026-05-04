import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { restoreVersion } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { name } = await context.params;
  try {
    await restoreVersion(name);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao restaurar versão";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
