import { NextResponse } from "next/server";

import { addRequest } from "@/data/requestsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getLocalUserById } from "@/lib/auth/localStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { notifyProfileDeletionRequest } from "@/lib/notificationService";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  const authUser = await authenticateRequest(request);
  if (!authUser) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const rec = asRecord(body);
  const reason = typeof rec?.reason === "string" ? rec.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ message: "Motivo obrigatorio" }, { status: 400 });
  }

  const localUser = await getLocalUserById(authUser.id);
  const userName =
    (typeof localUser?.full_name === "string" ? localUser.full_name.trim() : "") ||
    (typeof localUser?.name === "string" ? localUser.name.trim() : "") ||
    authUser.email;

  try {
    const record = await addRequest(
      {
        id: authUser.id,
        name: userName,
        email: authUser.email,
        companyId: authUser.companyId ?? "",
        companyName: authUser.companySlug ?? "",
      },
      "PROFILE_DELETION",
      {
        reason,
        reviewQueue: "admin_and_global",
      },
    );

    addAuditLogSafe({
      action: "request.profile_deletion",
      entityType: "request",
      entityId: record.id,
      entityLabel: authUser.user ?? authUser.email ?? null,
      actorUserId: authUser.id,
      actorEmail: authUser.email ?? null,
      metadata: { reason },
    });

    await notifyProfileDeletionRequest(record).catch(() => undefined);
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const code = asRecord(err)?.code;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Ja existe uma solicitacao pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitacao" }, { status: 500 });
  }
}
