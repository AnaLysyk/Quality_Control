import { NextResponse } from "next/server";
import { createSuporte, listAllSuportes, listSuportesForUser } from "@/backend/ticketsStore";
import { appendSuporteEvent } from "@/backend/ticketEventsStore";
import { notifySuporteCreated } from "@/backend/notificationService";
import { attachAssigneeInfo, attachAssigneeToSuporte } from "@/backend/ticketsPresenter";
import { authenticateRequest } from "@/backend/jwtAuth";
import { getLocalUserById } from "@/backend/auth/localStore";
import { resolvePrimaryCompanySlug } from "@/backend/auth/normalizeAuthenticatedUser";
import { assertCompanyAccess } from "@/backend/rbac/validateCompanyAccess";
import { canAccessGlobalTicketWorkspace } from "@/backend/rbac/tickets";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { canCreateSupportTickets, canViewSupportBoard } from "@/backend/supportAccess";

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
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));
  let items = canAccessGlobalTicketWorkspace(user) ? await listAllSuportes() : await listSuportesForUser(user.id);
  items = items.slice(0, limit);
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
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
    const tags =
      Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

    const createdBy = user.id;
    const localUser = await getLocalUserById(user.id);
    const createdByName = resolveDisplayName(localUser) ?? user.email ?? null;
    const createdByEmail = localUser?.email ?? user.email ?? null;
    const normalizedCompanySlug = resolvePrimaryCompanySlug(user);

    const assignedToUserId =
      canAccessGlobalTicketWorkspace(user) &&
      typeof body?.assignedToUserId === "string"
        ? body?.assignedToUserId
        : null;

    const suporte = await createSuporte({
      title: body?.title,
      description: body?.description,
      type: body?.type,
      priority: body?.priority,
      tags,
      createdBy,
      createdByName,
      createdByEmail,
      companySlug: requestedCompanyId ? body?.companySlug ?? null : normalizedCompanySlug,
      companyId: targetCompanyId,
      assignedToUserId,
    });

    if (!suporte) {
      return NextResponse.json({ error: "Informe título ou descrição" }, { status: 400 });
    }

    appendSuporteEvent({
      suporteId: suporte.id,
      type: "CREATED",
      actorUserId: suporte.createdBy ?? null,
      payload: { title: suporte.title },
    }).catch((err) => {
      console.error("Falha ao registrar evento de suporte:", err);
    });

    notifySuporteCreated(suporte).catch((err) => {
      console.error("Falha ao notificar novo suporte:", err);
    });

    const enriched = await attachAssigneeToSuporte(suporte);

    addAuditLogSafe({
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      action: "ticket.created",
      entityType: "ticket",
      entityId: suporte.id,
      entityLabel: suporte.title ?? null,
      metadata: { type: suporte.type ?? null, priority: suporte.priority ?? null, companyId: targetCompanyId, role: user.role ?? null, _payload: body },
    });

    return NextResponse.json({ item: enriched }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[chamados] Falha ao criar chamado:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

