import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { listVersions } from "@/backend/ticketsStore";
import { isItDev } from "@/backend/rbac/tickets";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const items = await listVersions();
  return NextResponse.json({ items }, { status: 200 });
}

