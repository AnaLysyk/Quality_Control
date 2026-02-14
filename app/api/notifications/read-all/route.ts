import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { closeAllNotifications, closeNotificationsByTicketId } from "@/lib/userNotificationsStore";

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const ticketId = typeof body?.ticketId === "string" && body.ticketId.trim() ? body.ticketId.trim() : null;

  let changed: number | boolean = 0;
  if (ticketId) {
    changed = await closeNotificationsByTicketId(user.id, ticketId);
  } else {
    changed = await closeAllNotifications(user.id);
  }

  // Se a função retorna boolean, converte para 0/1 para manter contrato numérico
  if (typeof changed === "boolean") {
    changed = changed ? 1 : 0;
  }

  return NextResponse.json(
    { ok: true, changed },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
