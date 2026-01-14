import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { getSessionUser } from "@/lib/session";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  const body = (await request.json().catch(() => null)) as unknown;
  const rec = asRecord(body);
  const newEmail = typeof rec?.newEmail === "string" ? rec.newEmail : undefined;

  if (!newEmail) {
    return NextResponse.json({ message: "newEmail é obrigatório" }, { status: 400 });
  }

  try {
    const record = addRequest(user, "EMAIL_CHANGE", { newEmail });
    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const code = asRecord(err)?.code;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Já existe uma solicitação pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitação" }, { status: 500 });
  }
}
