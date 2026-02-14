import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicket } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { canEditTicketContent, canViewTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_TAGS = 50;

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function normalizeTagsInput(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  const source = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
  if (!source) return undefined;
  const normalized = source
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
  return normalized;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return noStoreJson({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const item = await getTicketById(id);
    if (!item) {
      return noStoreJson({ error: "Chamado nao encontrado" }, { status: 404 });
    }
    if (!canViewTicket(user, item)) {
      return noStoreJson({ error: "Sem permissao" }, { status: 403 });
    }

    const enriched = await attachAssigneeToTicket(item);
    return noStoreJson({ item: enriched }, { status: 200 });
  } catch (error) {
    console.error("[chamados][GET] erro ao carregar chamado", error);
    return noStoreJson({ error: "Falha ao carregar chamado" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return noStoreJson({ error: "Nao autorizado" }, { status: 401 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_REQUEST_BYTES) {
    return noStoreJson({ error: "Payload muito grande" }, { status: 413 });
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return noStoreJson({ error: "Content-Type invalido" }, { status: 415 });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return noStoreJson({ error: "JSON invalido" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object") {
    return noStoreJson({ error: "Payload invalido" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const item = await getTicketById(id);
    if (!item) {
      return noStoreJson({ error: "Chamado nao encontrado" }, { status: 404 });
    }
    if (!canEditTicketContent(user, item)) {
      return noStoreJson({ error: "Sem permissao" }, { status: 403 });
    }

    const body = parsed as Record<string, unknown>;
    const wantsUpdate =
      body.title !== undefined ||
      body.description !== undefined ||
      body.type !== undefined ||
      body.priority !== undefined ||
      body.tags !== undefined;

    if (!wantsUpdate) {
      return noStoreJson({ error: "Nenhuma alteracao informada" }, { status: 400 });
    }

    const tags = normalizeTagsInput(body.tags);

    const updated = await updateTicket(id, {
      title: body.title,
      description: body.description,
      type: body.type,
      priority: body.priority,
      tags,
      updatedBy: user.id,
    });

    if (!updated) {
      return noStoreJson({ error: "Chamado nao encontrado" }, { status: 404 });
    }

    appendTicketEvent({
      ticketId: updated.id,
      type: "UPDATED",
      actorUserId: user.id,
      payload: {
        title: updated.title,
        type: updated.type ?? null,
        priority: updated.priority,
        tags: updated.tags,
      },
    }).catch((err) => console.error("Falha ao registrar atualizacao:", err));

    const enriched = await attachAssigneeToTicket(updated);
    return noStoreJson({ item: enriched }, { status: 200 });
  } catch (error) {
    console.error("[chamados][PUT] erro ao atualizar chamado", error);
    return noStoreJson({ error: "Falha ao atualizar chamado" }, { status: 500 });
  }
}
