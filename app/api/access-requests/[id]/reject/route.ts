import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { transitionAccessRequest } from "@/lib/accessRequestsV2/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { comment?: string | null } | null;
  const { id } = await context.params;
  const result = await transitionAccessRequest(id, "reject", authUser, { comment: body?.comment });

  if (result === "forbidden") return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  if (result === "reject-comment-required") return NextResponse.json({ message: "Comentário é obrigatório para rejeitar" }, { status: 400 });
  if (!result) return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });

  return NextResponse.json({ item: result }, { status: 200 });
}
