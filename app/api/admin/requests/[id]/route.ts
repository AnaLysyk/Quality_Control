import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { updateRequestStatus } from "@/data/requestsStore";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (user.role !== "admin") {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body?.status as "APPROVED" | "REJECTED" | undefined;
  const reviewNote = body?.reviewNote as string | undefined;

  if (!status || (status !== "APPROVED" && status !== "REJECTED")) {
    return NextResponse.json({ message: "Status inválido" }, { status: 400 });
  }

  const updated = updateRequestStatus(params.id, status, user, reviewNote);
  if (!updated) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }

  // Efeito colateral simples (mock): aplica alteração no usuário
  if (status === "APPROVED") {
    if (updated.type === "EMAIL_CHANGE" && typeof updated.payload?.newEmail === "string") {
      const { updateUserEmail } = await import("@/data/usersStore");
      updateUserEmail(updated.userId, updated.payload.newEmail as string);
    }
    if (updated.type === "COMPANY_CHANGE" && typeof updated.payload?.newCompanyName === "string") {
      const { updateUserCompany } = await import("@/data/usersStore");
      updateUserCompany(updated.userId, updated.payload.newCompanyName as string);
    }
  }

  return NextResponse.json(updated);
}
