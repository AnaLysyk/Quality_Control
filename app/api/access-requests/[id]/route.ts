import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { getAccessRequestForUser, patchAccessRequestForReviewer } from "@/lib/accessRequestsV2/service";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getAccessRequestForUser(id, authUser);
  if (result === "forbidden") {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }
  if (!result) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ item: result }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    status?: string | null;
    priority?: string | null;
    reviewComment?: string | null;
  } | null;

  const { id } = await context.params;
  const result = await patchAccessRequestForReviewer(id, {
    status: body?.status,
    priority: body?.priority,
    reviewComment: body?.reviewComment,
  }, authUser);

  if (result === "forbidden") {
    return NextResponse.json({ message: "Sem permissão para atualizar solicitações" }, { status: 403 });
  }
  if (result === "reject-comment-required") {
    return NextResponse.json({ message: "Comentário é obrigatório para rejeitar" }, { status: 400 });
  }
  if (!result) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ item: result }, { status: 200 });
}
