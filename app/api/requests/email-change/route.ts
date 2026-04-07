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
  const body = (await request.json().catch(() => null)) as unknown;
  const rec = asRecord(body);
  const newEmail = typeof rec?.newEmail === "string" ? rec.newEmail : undefined;

  if (!newEmail) {
    return NextResponse.json({ message: "newEmail é obrigatório" }, { status: 400 });
  }

  try {
    const record = await addRequest(
      {
        id: authUser.id,
        email: authUser.email,
      },
      "EMAIL_CHANGE",
      { newEmail }
    );
    addAuditLogSafe({
      action: "request.email_change",
      entityType: "request",
      entityId: record.id,
      entityLabel: authUser.email ?? null,
      actorUserId: authUser.id,
      actorEmail: authUser.email ?? null,
      metadata: { newEmail },
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
