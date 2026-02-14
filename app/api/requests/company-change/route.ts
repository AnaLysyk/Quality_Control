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
    const newCompanyName =
      typeof rec?.newCompanyName === "string"
        ? rec.newCompanyName.trim()
        : "";

    if (!newCompanyName || newCompanyName.length < 2 || newCompanyName.length > 120) {
      return NextResponse.json({ message: "Nome inválido" }, { status: 400 });
    }

    const record = await addRequest(
      { id: authUser.id, email: authUser.email },
      "COMPANY_CHANGE",
      { newCompanyName }
    );
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    console.error("Erro ao criar solicitação COMPANY_CHANGE", err);
    const code = asRecord(err)?.code;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Já existe uma solicitação pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitação" }, { status: 500 });
  }
}
