import { NextResponse } from "next/server";
import { createSuporte, listAllSuportes, listSuportesForUser } from "@/lib/ticketsStore";
import { appendSuporteEvent } from "@/lib/ticketEventsStore";
import { notifySuporteCreated } from "@/lib/notificationService";
import { attachAssigneeInfo, attachAssigneeToSuporte } from "@/lib/ticketsPresenter";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { canAccessGlobalTicketWorkspace } from "@/lib/rbac/tickets";

function resolveDisplayName(user: { full_name?: string | null; name?: string | null; email?: string | null } | null | undefined) {
  return user?.full_name?.trim() || user?.name?.trim() || user?.email?.trim() || null;
}

// GET /api/chamados: each authenticated user can only see their own chamados
export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (
    !hasPermissionAccess(user.permissions, "tickets", "view") &&
    !hasPermissionAccess(user.permissions, "support", "view")
  ) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
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
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }
    if (
      !hasPermissionAccess(user.permissions, "support", "create") &&
      !hasPermissionAccess(user.permissions, "tickets", "create")
    ) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const requestedCompanyId = typeof body?.companyId === "string" ? body.companyId : null;
    const targetCompanyId = requestedCompanyId ?? user.companyId ?? null;
    if (requestedCompanyId) {
      assertCompanyAccess(user, requestedCompanyId);
    }
    const tags =
      Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

    const createdBy = user.id;
    const localUser = await getLocalUserById(user.id);
    const createdByName = resolveDisplayName(localUser) ?? user.email ?? null;
    const createdByEmail = localUser?.email ?? user.email ?? null;

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
      companySlug: requestedCompanyId ? body?.companySlug ?? null : user.companySlug ?? null,
      companyId: targetCompanyId,
      assignedToUserId,
    });

    if (!suporte) {
      return NextResponse.json({ error: "Informe titulo ou descricao" }, { status: 400 });
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
    return NextResponse.json({ item: enriched }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[chamados] Falha ao criar chamado:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
