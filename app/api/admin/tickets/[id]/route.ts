import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { canMoveTicket, canViewTicket } from "@/lib/rbac/tickets";
import { KANBAN_STATUS_OPTIONS, normalizeKanbanStatus } from "@/lib/ticketsStatus";

const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_STATUS = new Set(KANBAN_STATUS_OPTIONS.map((option) => option.value));

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function validateJsonRequest(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("BAD_CT");
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("TOO_LARGE");
  }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return json({ error: "Sem permissao" }, { status: 403 });
  }

  const enriched = await attachAssigneeToTicket(item);
  return json({ item: enriched }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    validateJsonRequest(req);
  } catch (error) {
    if (error instanceof Error && error.message === "BAD_CT") {
      return json({ error: "Content-Type invalido" }, { status: 415 });
    }
    if (error instanceof Error && error.message === "TOO_LARGE") {
      return json({ error: "Payload muito grande" }, { status: 413 });
    }
    return json({ error: "Requisicao invalida" }, { status: 400 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return json({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canViewTicket(user, item)) {
    return json({ error: "Sem permissao" }, { status: 403 });
  }
  if (!canMoveTicket(user, item)) {
    return json({ error: "Sem permissao para alterar status" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string | null } | null;
  const rawStatus = typeof body?.status === "string" ? body.status.trim() : "";
  const normalizedStatus = rawStatus ? normalizeKanbanStatus(rawStatus) : "";

  if (!normalizedStatus || !ALLOWED_STATUS.has(normalizedStatus)) {
    return json({ error: "Status invalido" }, { status: 400 });
  }

  if (normalizedStatus === item.status) {
    const enriched = await attachAssigneeToTicket(item);
    return json({ item: enriched }, { status: 200 });
  }

  const updated = await updateTicketStatus(id, normalizedStatus, user.id);
  if (!updated) {
    return json({ error: "Chamado nao encontrado ou status invalido" }, { status: 404 });
  }

  const enriched = await attachAssigneeToTicket(updated);
  return json({ item: enriched }, { status: 200 });
}
