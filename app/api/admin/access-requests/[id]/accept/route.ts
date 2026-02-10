import { NextResponse } from "next/server";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { getSupportRequestById, updateSupportRequest } from "@/data/supportRequestsStore";

export const runtime = "nodejs";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  const existing = await getSupportRequestById(id);
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const updated = await updateSupportRequest(id, { status: "closed" });
  if (!updated) {
    return NextResponse.json({ error: "Falha ao atualizar solicitacao" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
    },
  });
}
