import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { canAssignTicket, isItDev, isTicketAdmin } from "@/lib/rbac/tickets";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "mine").toLowerCase();
  const allowAll = isItDev(user) || isTicketAdmin(user);
  if (scope === "all" && !allowAll) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const statusFilter = url.searchParams.get("status");
  const companyFilter = url.searchParams.get("companyId") ?? url.searchParams.get("companySlug");
  const assignedTo = url.searchParams.get("assignedTo");
  const priority = url.searchParams.get("priority");
  const tags = url.searchParams.get("tags");
  const search = url.searchParams.get("search");
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));

  let items = scope === "all" ? await listAllTickets() : await listTicketsForUser(user.id);
  if (!user.isGlobalAdmin && Array.isArray(user.companySlugs) && user.companySlugs.length) {
    items = items.filter((ticket) =>
      ticket.companySlug ? user.companySlugs?.includes(ticket.companySlug) : true,
    );
  }
  if (statusFilter) {
    const statuses = statusFilter.split(",").map((value) => value.trim()).filter(Boolean);
    if (statuses.length) {
      items = items.filter((ticket) => statuses.includes(ticket.status));
    }
  }
  if (companyFilter) {
    items = items.filter(
      (ticket) => ticket.companyId === companyFilter || ticket.companySlug === companyFilter,
    );
  }
  if (assignedTo) {
    items = items.filter((ticket) => ticket.assignedToUserId === assignedTo);
  }
  if (priority) {
    items = items.filter((ticket) => ticket.priority === priority);
  }
  if (tags) {
    const tagList = tags.split(",").map((value) => value.trim()).filter(Boolean);
    if (tagList.length) {
      items = items.filter((ticket) => ticket.tags.some((tag) => tagList.includes(tag)));
    }
  }
  if (search) {
    const query = search.toLowerCase();
    items = items.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query) ||
        (ticket.createdByName ?? "").toLowerCase().includes(query),
    );
  }

  items = items.slice(0, limit);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const localUser = await getLocalUserById(user.id);
  const assignedToUserId =
    canAssignTicket(user) && typeof body?.assignedToUserId === "string" ? body.assignedToUserId : null;
  const tags =
    Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

  const ticket = await createTicket({
    title: body?.title,
    description: body?.description,
    priority: body?.priority,
    tags,
    assignedToUserId,
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

  return NextResponse.json({ item: ticket }, { status: 201 });
}
