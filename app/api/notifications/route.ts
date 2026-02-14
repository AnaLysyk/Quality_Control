import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listUserRequests } from "@/data/requestsStore";
import { createUserNotification, listUserNotifications } from "@/lib/userNotificationsStore";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const pendingResets = await listUserRequests(user.id, { status: "PENDING", type: "PASSWORD_RESET" });
  await Promise.all(
    pendingResets.map(request =>
      createUserNotification(user.id, {
        type: "PASSWORD_RESET_PENDING",
        title: "Solicitacao de reset enviada",
        description: "Aguardando aprovacao do administrador.",
        requestId: request.id,
        dedupeKey: `reset:user:${request.id}`,
      })
    )
  );

  let items = await listUserNotifications(user.id);
  if (unreadOnly) {
    items = items.filter((item) => item.status !== "closed");
  }
  items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
