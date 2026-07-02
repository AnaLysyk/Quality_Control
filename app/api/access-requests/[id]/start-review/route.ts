import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { transitionAccessRequest } from "@/lib/accessRequestsV2/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "NÃ£o autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { comment?: string | null } | null;
  const { id } = await context.params;
  const result = await transitionAccessRequest(id, "start-review", authUser, { comment: body?.comment });

  if (result === "forbidden") return NextResponse.json({ message: "Sem permissÃ£o" }, { status: 403 });
  if (result === "invalid-transition") return NextResponse.json({ message: "TransiÃ§Ã£o de status invÃ¡lida" }, { status: 409 });
  if (!result) return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });

  return NextResponse.json({ item: result }, { status: 200 });
}

