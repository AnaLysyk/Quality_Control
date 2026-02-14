import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { authenticateRequest } from "@/lib/jwtAuth";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rec = asRecord(body);
    const newEmail =
      typeof rec?.newEmail === "string"
        ? rec.newEmail.trim().toLowerCase()
        : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newEmail || !emailRegex.test(newEmail) || newEmail.length > 160) {
      return NextResponse.json({ message: "Email inválido" }, { status: 400 });
    }
    if (newEmail === authUser.email?.toLowerCase()) {
      return NextResponse.json({ message: "Novo email deve ser diferente do atual" }, { status: 400 });
    }

    const record = await addRequest(
      { id: authUser.id, email: authUser.email },
      "EMAIL_CHANGE",
      { newEmail }
    );
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    console.error("Erro ao criar solicitação EMAIL_CHANGE", err);
    const code = asRecord(err)?.code;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Já existe uma solicitação pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitação" }, { status: 500 });
  }
}
