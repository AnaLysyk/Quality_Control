import { NextResponse } from "next/server";
import { getLocalUserById } from "@/backend/auth/localStore";
import { createTicket, listAllTickets, listTicketsForUser, type TicketRecord } from "@/backend/ticketsStore";
import { appendTicketEvent } from "@/backend/ticketEventsStore";
import { notifyTicketCreated } from "@/backend/notificationService";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/backend/ticketsPresenter";
import { brainOnTicketCreated } from "@/backend/brain/autoSync";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import {
  buildTicketsListCacheKey,
  clearTicketsListCache,
  readTicketsListCache,
  writeTicketsListCache,
} from "@/backend/ticketsListResponseCache";

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

function normalizeKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function ticketMatchesCompany(ticket: TicketRecord, companyKey?: string | null) {
  const key = normalizeKey(companyKey);
  if (!key) return true;
  return normalizeKey(ticket.companyId) === key || normalizeKey(ticket.companySlug) === key;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companyIdFilter = url.searchParams.get("companyId");
  const companySlugFilter = url.searchParams.get("companySlug");
  const companyFilter = companyIdFilter ?? companySlugFilter;

  const contextResult = await resolveOperationalContext(req, {
    moduleId: "tickets",
    action: "view",
    companyId: companyIdFilter,
    companySlug: companySlugFilter,
  });
  if (!contextResult.ok) return contextResult.response;

  const { context } = contextResult;
  const canUseGlobalScope = context.scope === "global";
  const cacheKey = buildTicketsListCacheKey({
    userId: context.access.userId,
    url,
    globalScope: canUseGlobalScope,
  });
  const forceRefresh = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const cached = forceRefresh ? null : readTicketsListCache<{ items: unknown[] }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { status: 200, headers: { "x-qc-cache": "hit" } });
  }

  const statusFilter = url.searchParams.get("status");
  const assignedTo = url.searchParams.get("assignedTo");
  const priority = url.searchParams.get("priority");
  const tags = url.searchParams.get("tags");
  const search = url.searchParams.get("search");
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));

  let items: TicketRecord[];
  if (canUseGlobalScope) {
    items = await listAllTickets();
  } else if (context.scope === "company") {
    const companyKey = companyFilter || context.companyId || context.companySlug;
    items = (await listAllTickets()).filter((ticket) => ticketMatchesCompany(ticket, companyKey));
  } else {
    items = await listTicketsForUser(context.access.userId);
  }

  if (statusFilter) {
    const statuses = statusFilter.split(",").map((value) => value.trim()).filter(Boolean);
    if (statuses.length) {
      items = items.filter((ticket) => statuses.includes(ticket.status));
    }
  }
  if (companyFilter) {
    items = items.filter((ticket) => ticketMatchesCompany(ticket, companyFilter));
  }
  if (assignedTo && canUseGlobalScope) {
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
  const payload = { items: enriched };
  writeTicketsListCache(cacheKey, payload);
  return NextResponse.json(payload, { status: 200, headers: { "x-qc-cache": "miss" } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedCompanyId = typeof body?.companyId === "string" ? body.companyId : null;
    const requestedCompanySlug = typeof body?.companySlug === "string" ? body.companySlug : null;

    const contextResult = await resolveOperationalContext(req, {
      moduleId: "tickets",
      action: "create",
      companyId: requestedCompanyId,
      companySlug: requestedCompanySlug,
    });
    if (!contextResult.ok) return contextResult.response;

    const { context } = contextResult;
    const targetCompanyId = requestedCompanyId ?? context.companyId ?? null;
    const targetCompanySlug = requestedCompanySlug ?? context.companySlug ?? context.access.companySlugs?.[0] ?? null;
    const localUser = await getLocalUserById(context.access.userId);
    const assignedToUserId =
      context.scope === "global" &&
      typeof body?.assignedToUserId === "string"
        ? body?.assignedToUserId
        : null;
    const tags =
      Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

    const ticket = await createTicket({
      title: body?.title,
      description: body?.description,
      type: body?.type,
      priority: body?.priority,
      tags,
      assignedToUserId,
      createdBy: context.access.userId,
      createdByName: resolveDisplayName(localUser),
      createdByEmail: localUser?.email ?? null,
      companySlug: targetCompanySlug,
      companyId: targetCompanyId,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Informe título ou descrição" }, { status: 400 });
    }

    clearTicketsListCache();

    appendTicketEvent({
      ticketId: ticket.id,
      type: "CREATED",
      actorUserId: context.access.userId,
      payload: { title: ticket.title, role: context.access.role ?? null },
    }).catch((err) => {
      console.error("Falha ao registrar evento de chamado:", err);
    });

    notifyTicketCreated(ticket).catch((err) => {
      console.error("Falha ao notificar novo chamado:", err);
    });

    brainOnTicketCreated(ticket).catch(() => {});

    const enriched = await attachAssigneeToTicket(ticket);
    return NextResponse.json({ item: enriched }, { status: 201 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[tickets] Falha ao criar chamado:", err);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
