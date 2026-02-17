import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { canAssignTicket, isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { withCompanyValidation } from "@/lib/middleware/withCompanyValidation";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const role = (user.role ?? "").toLowerCase();
  const allowAll = isItDev(user);
  const allowCompanyScope = role === "company";
  let scope = (url.searchParams.get("scope") ?? "mine").toLowerCase();
  if (scope === "mine" && allowCompanyScope) {
    scope = "all";
  }
  if (scope === "all" && !(allowAll || allowCompanyScope)) {
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
  if (scope === "all" && !allowAll) {
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
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}

export const POST = withCompanyValidation(async (user, companyId, req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const localUser = await getLocalUserById(user.id);
    const assignedToUserId =
      canAssignTicket(user) && typeof body?.assignedToUserId === "string" ? body.assignedToUserId : null;
    const tags =
      Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

    const ticket = await createTicket({
      title: body?.title,
      description: body?.description,
      type: body?.type,
      priority: body?.priority,
      tags,
      assignedToUserId,
      createdBy: user.id,
      createdByName: localUser?.name ?? null,
      createdByEmail: localUser?.email ?? null,
      companySlug: user.companySlug ?? null,
      companyId: companyId ?? user.companyId ?? null,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Informe titulo ou descricao" }, { status: 400 });
    }

    appendTicketEvent({
      ticketId: ticket.id,
      type: "CREATED",
      actorUserId: user.id,
      payload: { title: ticket.title, role: user.role ?? null },
    }).catch((err) => {
      console.error("Falha ao registrar evento de chamado:", err);
    });

    notifyTicketCreated(ticket).catch((err) => {
      console.error("Falha ao notificar novo chamado:", err);
    });

    const enriched = await attachAssigneeToTicket(ticket);
    return NextResponse.json({ item: enriched }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[tickets] Falha ao criar chamado:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
