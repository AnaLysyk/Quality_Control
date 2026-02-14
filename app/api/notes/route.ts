import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { updateNotificationStatus } from "@/lib/userNotificationsStore";

export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id || id.length < 6) {
    return NextResponse.json({ error: "Id invalido" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const allowed = new Set(["closed"]);
  const status = allowed.has(body?.status) ? body.status : null;

  if (!status) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const updated = await updateNotificationStatus(user.id, id, status);

  if (!updated) {
    return NextResponse.json(
      { error: "Notificacao nao encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { item: updated },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
