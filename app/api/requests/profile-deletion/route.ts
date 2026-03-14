import { NextResponse } from "next/server";

import { addRequest } from "@/data/requestsStore";
import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById } from "@/lib/auth/localStore";

export async function POST(request: Request) {
  const access = await getAccessContext(request);
  if (!access) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ message: "Motivo obrigatorio" }, { status: 400 });
  }

  const localUser = await getLocalUserById(access.userId);
  const userName = localUser?.name?.trim() || access.userId;

  try {
    const record = await addRequest(
      {
        id: access.userId,
        name: userName,
        email: localUser?.email ?? "",
        companyId: access.companyId ?? "",
        companyName: access.companySlug ?? "",
      },
      "PROFILE_DELETION",
      {
        reason,
        reviewQueue: "admin_and_global",
      },
    );

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code === "DUPLICATE") {
      return NextResponse.json({ message: "Ja existe uma solicitacao pendente" }, { status: 409 });
    }
    return NextResponse.json({ message: "Erro ao criar solicitacao" }, { status: 500 });
  }
}
