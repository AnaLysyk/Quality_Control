import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById } from "@/lib/ticketsStore";
import { listTicketEvents } from "@/lib/ticketEventsStore";
import { getLocalUserById } from "@/lib/auth/localStore";
import { canViewTicket } from "@/lib/rbac/tickets";

const MAX_LIMIT = 100;

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

function clampOffset(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string" || id.length > 100) {
    return NextResponse.json({ error: "Chamado invalido" }, { status: 400 });
  }
  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json(
      { error: "Chamado nao encontrado. Atualize a pagina e tente novamente." },
      { status: 404 },
    );
  }
  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = clampLimit(Number(url.searchParams.get("limit") ?? 50));
  const offset = clampOffset(Number(url.searchParams.get("offset") ?? 0));

  try {
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
        actorName: actor?.name ?? null,
        actorEmail: actor?.email ?? null,
      };
    });

    const res = NextResponse.json({ items: enriched }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[chamados][events][GET] falha ao carregar timeline", error);
    return NextResponse.json({ error: "Falha ao carregar timeline" }, { status: 500 });
  }
}
