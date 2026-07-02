import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { transitionAccessRequest } from "@/lib/accessRequestsV2/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { comment?: string | null } | null;
  const { id } = await context.params;
  const result = await transitionAccessRequest(id, "approve", authUser, { comment: body?.comment });

  if (result === "forbidden") return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  if (result === "self-approval") return NextResponse.json({ message: "Autoaprovação não é permitida" }, { status: 403 });
  if (result === "scope-denied") return NextResponse.json({ message: "Sem escopo para aprovar este perfil" }, { status: 403 });
  if (result === "missing-password") return NextResponse.json({ message: "Senha não definida na solicitação" }, { status: 400 });
  if (result === "testing-company-missing") return NextResponse.json({ message: "Testing Company não encontrada" }, { status: 409 });
  if (result === "company-missing") return NextResponse.json({ message: "Empresa obrigatória não encontrada" }, { status: 400 });
  if (result === "company-name-missing") return NextResponse.json({ message: "Nome da empresa obrigatório" }, { status: 400 });
  if (result === "invalid-profile") return NextResponse.json({ message: "Perfil solicitado inválido" }, { status: 400 });
  if (result === "duplicate-user") return NextResponse.json({ message: "Usuário já cadastrado" }, { status: 409 });
  if (result === "invalid-transition") return NextResponse.json({ message: "Transição de status inválida" }, { status: 409 });
  if (!result) return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });

  return NextResponse.json({ item: result, forceRefreshMe: true }, { status: 200 });
}

