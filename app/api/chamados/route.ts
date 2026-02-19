import { NextResponse } from "next/server";
import { createSuporte, listAllSuportes, listSuportesForUser } from "@/lib/ticketsStore";
import { appendTicketEvent as appendSuporteEvent } from "@/lib/suporteEventsStore";
import { notifySuporteCreated } from "@/lib/notificationService";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isItDev } from "@/lib/rbac/suportes";

// GET /api/chamados: Only the creator or dev can see chamados (not public)
export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 200)));
  let items;
  if (isItDev(user)) {
    items = await listAllSuportes();
  } else {
    items = await listSuportesForUser(user.id);
  }
  items = items.slice(0, limit);
  const enriched = await attachAssigneeInfo(items);
  return NextResponse.json({ items: enriched }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const tags =
      Array.isArray(body?.tags) ? body.tags : typeof body?.tags === "string" ? body.tags.split(",") : undefined;

    // Sempre usar usuário autenticado, se houver
    const createdBy = user?.id || "anonymous";
    const createdByName = user?.email || null;
    const createdByEmail = user?.email || null;

    const suporte = await createSuporte({
      title: body?.title,
      description: body?.description,
      type: body?.type,
      priority: body?.priority,
      tags,
      createdBy,
      createdByName,
      createdByEmail,
      companySlug: body?.companySlug ?? null,
      companyId: body?.companyId ?? null,
    });

    if (!suporte) {
      return NextResponse.json({ error: "Informe titulo ou descricao" }, { status: 400 });
    }

    appendSuporteEvent({
      await appendSuporteEvent({
        suporteId: suporte.id,
        type: "CREATED",
        actorUserId: suporte.createdBy ?? null,
        payload: { title: suporte.title },
      });
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



