import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { transitionAccessRequest } from "@/lib/accessRequestsV2/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "NÃ£o autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { comment?: string | null; adjustmentFields?: string[] } | null;
  const { id } = await context.params;
  const result = await transitionAccessRequest(id, "request-info", authUser, {
    comment: body?.comment,
    adjustmentFields: Array.isArray(body?.adjustmentFields) ? body.adjustmentFields : undefined,
  });

  if (result === "forbidden") return NextResponse.json({ message: "Sem permissÃ£o" }, { status: 403 });
  if (result === "adjustment-details-required") return NextResponse.json({ message: "ComentÃ¡rio e campos sÃ£o obrigatÃ³rios" }, { status: 400 });
  if (result === "invalid-transition") return NextResponse.json({ message: "TransiÃ§Ã£o de status invÃ¡lida" }, { status: 409 });
  if (!result) return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });

  return NextResponse.json({ item: result }, { status: 200 });
}

