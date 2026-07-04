import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { resolvePrimaryCompanySlug } from "@/lib/auth/normalizeAuthenticatedUser";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { canAccessGlobalTicketWorkspace } from "@/lib/rbac/tickets";
import { canCreateSupportTickets, canViewSupportBoard } from "@/lib/supportAccess";
import { brainOnTicketCreated } from "@/lib/brain/autoSync";
import {
  buildTicketsListCacheKey,
  clearTicketsListCache,
  readTicketsListCache,
  writeTicketsListCache,
} from "@/lib/ticketsListResponseCache";

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!canViewSupportBoard(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const url = new URL(req.url);
  const canUseGlobalScope = canAccessGlobalTicketWorkspace(user);
  const cacheKey = buildTicketsListCacheKey({
    userId: user.id,
    url,
    globalScope: canUseGlobalScope,
  });
  const forceRefresh = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const cached = forceRefresh ? null : readTicketsListCache<{ items: unknown[] }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { status: 200, headers: { "x-qc-cache": "hit" } });
  }

  const statusFilter = url.searchParams.get("status");
  const companyFilter = url.searchParams.get("companyId") ?? url.searchParams.get("companySlug");
  const assignedTo = url.searchParams.get("assignedTo");
  const priority = url.searchParams.get("priority");
  const tags = url.searchParams.get("tags");
  const search = url.searchParams.get("search");
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));

  let items = canUseGlobalScope ? await listAllTickets() : await listTicketsForUser(user.id);
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
  const payload = { items: enriched };
  writeTicketsListCache(cacheKey, payload);
  return NextResponse.json(payload, { status: 200, headers: { "x-qc-cache": "miss" } });
}

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (!canCreateSupportTickets(user)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const requestedCompanyId = typeof body?.companyId === "string" ? body.companyId : null;
    const targetCompanyId = requestedCompanyId ?? user.companyId ?? null;
    if (requestedCompanyId) {
      await assertCompanyAccess(user, requestedCompanyId);
    }
    const localUser = await getLocalUserById(user.id);
    const normalizedCompanySlug = resolvePrimaryCompanySlug(user);
    const assignedToUserId =
      canAccessGlobalTicketWorkspace(user) &&
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
      createdBy: user.id,
      createdByName: resolveDisplayName(localUser),
      createdByEmail: localUser?.email ?? null,
      companySlug: normalizedCompanySlug,
      companyId: targetCompanyId,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Informe título ou descrição" }, { status: 400 });
    }

    clearTicketsListCache();

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

    brainOnTicketCreated(ticket).catch(() => {});

    const enriched = await attachAssigneeToTicket(ticket);
    return NextResponse.json({ item: enriched }, { status: 201 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[tickets] Falha ao criar chamado:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
