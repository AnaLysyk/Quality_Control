import { NextRequest, NextResponse } from "next/server";
import { updateRequestStatus } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

type ReviewStatus = "APPROVED" | "REJECTED";

function readReviewStatus(value: unknown): ReviewStatus | null {
  return value === "APPROVED" || value === "REJECTED" ? value : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  if (!authUser.isGlobalAdmin) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;
  const status = readReviewStatus(record?.status);
  const reviewNote = typeof record?.reviewNote === "string" ? record.reviewNote : undefined;

  if (!status) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const updated = updateRequestStatus(
    id,
    status,
    {
      id: authUser.id,
    },
    reviewNote
  );
  if (!updated) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }

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
