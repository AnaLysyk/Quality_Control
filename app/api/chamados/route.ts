import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "mine").toLowerCase();
  const allowAll = isItDev(user);
  if (scope === "all" && !allowAll) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));
  let items = scope === "all" ? await listAllTickets() : await listTicketsForUser(user.id);

  if (scope === "all") {
    if (user.companyId) {
      items = items.filter((ticket) => ticket.companyId === user.companyId);
    } else if (user.companySlug) {
      items = items.filter((ticket) => ticket.companySlug === user.companySlug);
    } else if (Array.isArray(user.companySlugs) && user.companySlugs.length) {
      items = items.filter((ticket) => ticket.companySlug && user.companySlugs?.includes(ticket.companySlug));
    } else {
      items = [];
    }
  }

  items = items.slice(0, limit);
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const localUser = await getLocalUserById(user.id);
  const tags =
    Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

  const ticket = await createTicket({
    title: body?.title,
    description: body?.description,
    type: body?.type,
    priority: body?.priority,
    tags,
    createdBy: user.id,
    createdByName: localUser?.name ?? null,
    createdByEmail: localUser?.email ?? null,
    companySlug: user.companySlug ?? null,
    companyId: user.companyId ?? null,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Informe titulo ou descricao" }, { status: 400 });
  }

  appendTicketEvent({
    ticketId: ticket.id,
    type: "CREATED",
    actorUserId: user.id,
    payload: { title: ticket.title },
  }).catch((err) => {
    console.error("Falha ao registrar evento de chamado:", err);
  });

  notifyTicketCreated(ticket).catch((err) => {
    console.error("Falha ao notificar novo chamado:", err);
  });

  const enriched = await attachAssigneeToTicket(ticket);
  return NextResponse.json({ item: enriched }, { status: 201 });
}

