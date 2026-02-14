import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { updateNotificationStatus } from "@/lib/userNotificationsStore";

export async function POST(
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

  const updated = await updateNotificationStatus(user.id, id, "closed");
  if (!updated) {
    return NextResponse.json(
      { error: "Notificacao nao encontrada" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Auditoria opcional:
  // await appendUserEvent({ type: "NOTIFICATION_CLOSED", userId: user.id, notificationId: id });

  return NextResponse.json(
    { item: updated },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

