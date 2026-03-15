import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById } from "@/lib/ticketsStore";
import { listTicketEvents } from "@/lib/ticketEventsStore";
import { getLocalUserById } from "@/lib/auth/localStore";
import { canViewTicket } from "@/lib/rbac/tickets";

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const items = await listTicketEvents(id, { limit, offset });

  const uniqueActors = Array.from(
    new Set(items.map((event) => event.actorUserId).filter((value): value is string => Boolean(value))),
  );
  const actors = await Promise.all(uniqueActors.map((actorId) => getLocalUserById(actorId)));
  const actorMap = new Map(
    uniqueActors.map((actorId, idx) => [actorId, actors[idx] ?? null]),
  );

  const enriched = items.map((event) => {
    const actor = event.actorUserId ? actorMap.get(event.actorUserId) ?? null : null;
    return {
      ...event,
      actorName: resolveDisplayName(actor),
      actorEmail: actor?.email ?? null,
    };
  });

  return NextResponse.json({ items: enriched }, { status: 200 });
}
