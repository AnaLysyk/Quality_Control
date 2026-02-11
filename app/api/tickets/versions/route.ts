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

  const items = await listVersions();
  return NextResponse.json({ items }, { status: 200 });
}
