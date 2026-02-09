import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listUserRequests } from "@/data/requestsStore";
import { createUserNotification, listUserNotifications } from "@/lib/userNotificationsStore";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const pendingResets = await listUserRequests(user.id, { status: "PENDING", type: "PASSWORD_RESET" });
  for (const request of pendingResets) {
    await createUserNotification(user.id, {
      type: "PASSWORD_RESET_PENDING",
      title: "Solicitacao de reset enviada",
      description: "Aguardando aprovacao do administrador.",
      requestId: request.id,
      dedupeKey: `reset:user:${request.id}`,
    });
  }

  const items = await listUserNotifications(user.id);
  return NextResponse.json({ items }, { status: 200 });
}
