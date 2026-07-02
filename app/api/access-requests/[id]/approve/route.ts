import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { transitionAccessRequest } from "@/lib/accessRequestsV2/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "NÃ£o autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { comment?: string | null } | null;
  const { id } = await context.params;
  const result = await transitionAccessRequest(id, "approve", authUser, { comment: body?.comment });

  if (result === "forbidden") return NextResponse.json({ message: "Sem permissÃ£o" }, { status: 403 });
  if (result === "self-approval") return NextResponse.json({ message: "AutoaprovaÃ§Ã£o nÃ£o Ã© permitida" }, { status: 403 });
  if (result === "scope-denied") return NextResponse.json({ message: "Sem escopo para aprovar este perfil" }, { status: 403 });
  if (result === "missing-password") return NextResponse.json({ message: "Senha nÃ£o definida na solicitaÃ§Ã£o" }, { status: 400 });
  if (result === "testing-company-missing") return NextResponse.json({ message: "Testing Company nÃ£o encontrada" }, { status: 409 });
  if (result === "company-missing") return NextResponse.json({ message: "Empresa obrigatÃ³ria nÃ£o encontrada" }, { status: 400 });
  if (result === "company-name-missing") return NextResponse.json({ message: "Nome da empresa obrigatÃ³rio" }, { status: 400 });
  if (result === "invalid-profile") return NextResponse.json({ message: "Perfil solicitado invÃ¡lido" }, { status: 400 });
  if (result === "duplicate-user") return NextResponse.json({ message: "UsuÃ¡rio jÃ¡ cadastrado" }, { status: 409 });
  if (result === "invalid-transition") return NextResponse.json({ message: "TransiÃ§Ã£o de status invÃ¡lida" }, { status: 409 });
  if (!result) return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });

  return NextResponse.json({ item: result, forceRefreshMe: true }, { status: 200 });
}

