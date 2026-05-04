import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { updateNotificationStatus } from "@/lib/userNotificationsStore";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status === "closed" ? "closed" : null;
  if (!status) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  }

  const updated = await updateNotificationStatus(user.id, id, status);
  if (!updated) {
    return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ item: updated }, { status: 200 });
}
