import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
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

  try {
    const record = await addRequest(
      {
        id: authUser.id,
        email: authUser.email,
      },
      "PASSWORD_RESET",
      {}
    );
    addAuditLogSafe({
      action: "auth.password.reset_requested",
      entityType: "request",
      entityId: record.id,
      entityLabel: authUser.user ?? authUser.email ?? null,
      actorUserId: authUser.id,
      actorEmail: authUser.email ?? null,
      metadata: {},
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const code = asRecord(err)?.code;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Já existe uma solicitação pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitação" }, { status: 500 });
  }
}
