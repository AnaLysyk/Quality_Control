import { NextResponse } from "next/server";
// Autenticacao removida para endpoint publico
import { getTicketById } from "@/lib/ticketsStore";
import { listTicketEvents } from "@/lib/ticketEventsStore";
import { getLocalUserById } from "@/lib/auth/localStore";
// RBAC removido para endpoint publico

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json(
      { error: "Chamado nao encontrado. Atualize a pagina e tente novamente." },
      { status: 404 },
    );
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
