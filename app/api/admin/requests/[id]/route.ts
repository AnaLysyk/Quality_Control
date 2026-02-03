import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { updateRequestStatus, type RequestStatus } from "@/data/requestsStore";

function isFinalStatus(value: string | null): value is Exclude<RequestStatus, "PENDING"> {
  return value === "APPROVED" || value === "REJECTED";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }
  if (!authUser.isGlobalAdmin) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; reviewNote?: string } | null;
  const nextStatus = isFinalStatus(body?.status ?? null) ? body?.status ?? null : null;
  if (!nextStatus) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  const updated = updateRequestStatus(id, nextStatus, { id: authUser.id }, body?.reviewNote);
  if (!updated) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({ item: updated });
}
