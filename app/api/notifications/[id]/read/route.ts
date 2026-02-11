import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { updateNotificationStatus } from "@/lib/userNotificationsStore";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const updated = await updateNotificationStatus(user.id, id, "closed");
  if (!updated) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 });
  }
  return NextResponse.json({ item: updated }, { status: 200 });
}
