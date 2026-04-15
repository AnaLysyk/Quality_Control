import { NextResponse } from "next/server";

import { getRequestById, resubmitRequest } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const body = asRecord(await request.json().catch(() => null));
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  if (!requestId) {
    return NextResponse.json({ message: "requestId é obrigatório" }, { status: 400 });
  }

  const existing = await getRequestById(requestId);
  if (!existing) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }
  if (existing.userId !== authUser.id) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }
  if (existing.status !== "NEEDS_REVISION") {
    return NextResponse.json({ message: "Solicitação não está aguardando ajuste" }, { status: 409 });
  }

  const payload: Record<string, unknown> = {};
  if (existing.type === "EMAIL_CHANGE" && typeof body?.newEmail === "string" && body.newEmail.trim()) {
    payload.newEmail = body.newEmail.trim();
  }
  if (existing.type === "COMPANY_CHANGE" && typeof body?.newCompanyName === "string" && body.newCompanyName.trim()) {
    payload.newCompanyName = body.newCompanyName.trim();
  }
  if (existing.type === "PROFILE_DELETION" && typeof body?.reason === "string" && body.reason.trim()) {
    payload.reason = body.reason.trim();
  }

  const updated = await resubmitRequest(requestId, payload);
  return NextResponse.json({ item: updated });
}
