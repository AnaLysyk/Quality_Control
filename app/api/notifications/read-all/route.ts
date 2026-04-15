import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { closeAllNotifications, closeNotificationsByTicketId } from "@/lib/userNotificationsStore";

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";

  if (ticketId) {
    const changed = await closeNotificationsByTicketId(user.id, ticketId);
    return NextResponse.json({ ok: true, changed }, { status: 200 });
  }

  const changed = await closeAllNotifications(user.id);
  return NextResponse.json({ ok: true, changed }, { status: 200 });
}
