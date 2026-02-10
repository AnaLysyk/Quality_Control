import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/jwtAuth";
import { getSupportRequestById, updateSupportRequest, type SupportRequestStatus } from "@/data/supportRequestsStore";

export const runtime = "nodejs";

function isValidStatus(value: unknown): value is SupportRequestStatus {
  return value === "open" || value === "in_progress" || value === "closed" || value === "rejected";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  if (!authUser.isGlobalAdmin) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSupportRequestById(id);
  if (!existing) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const nextStatus = body?.status;
  if (!isValidStatus(nextStatus)) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const updated = await updateSupportRequest(id, { status: nextStatus });
  return NextResponse.json({ ok: true, item: updated ?? existing }, { status: 200 });
}
