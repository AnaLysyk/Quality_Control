import { NextResponse } from "next/server";
import { addRequest } from "@/data/requestsStore";
import { getSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = getSessionUser();
  const body = await request.json().catch(() => ({}));
  const newCompanyName = body?.newCompanyName as string | undefined;

  if (!newCompanyName) {
    return NextResponse.json({ message: "newCompanyName é obrigatório" }, { status: 400 });
  }

  try {
    const record = addRequest(user, "COMPANY_CHANGE", { newCompanyName });
    return NextResponse.json(record, { status: 201 });
  } catch (err: any) {
    if (err?.code === "DUPLICATE") {
      return NextResponse.json({ message: "Já existe uma solicitação pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitação" }, { status: 500 });
  }
}
