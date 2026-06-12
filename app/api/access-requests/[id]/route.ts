import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { getAccessRequestForUser } from "@/lib/accessRequestsV2/service";

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
