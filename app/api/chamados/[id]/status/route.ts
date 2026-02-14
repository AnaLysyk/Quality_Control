import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { getTicketStatusLabel, normalizeKanbanStatus, TICKET_STATUS_OPTIONS } from "@/lib/ticketsStatus";
import { notifyTicketStatusChanged } from "@/lib/notificationService";
import { canMoveTicket } from "@/lib/rbac/tickets";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_REASON_LENGTH = 1000;
const ALLOWED_STATUSES = new Set(TICKET_STATUS_OPTIONS.map((option) => option.value));

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return noStoreJson({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;

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

  const body = parsed as { status?: unknown; reason?: unknown };
  const statusRaw = typeof body.status === "string" ? body.status.trim() : "";
  if (!statusRaw) {
    return noStoreJson({ error: "Status obrigatorio" }, { status: 400 });
  }

  const normalizedStatus = normalizeKanbanStatus(statusRaw);
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    return noStoreJson({ error: "Status invalido" }, { status: 400 });
  }

  const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reasonRaw.length > MAX_REASON_LENGTH) {
    return noStoreJson({ error: "Motivo muito longo" }, { status: 413 });
  }
  const reason = reasonRaw.length ? reasonRaw : null;

  const current = await getTicketById(id);
  if (!current) {
    return noStoreJson({ error: "Chamado nao encontrado" }, { status: 404 });
  }
  if (!canMoveTicket(user, current)) {
    return noStoreJson({ error: "Sem permissao" }, { status: 403 });
  }

  if (current.status === normalizedStatus) {
    const enrichedCurrent = await attachAssigneeToTicket(current);
    return noStoreJson({ item: enrichedCurrent }, { status: 200 });
  }

  const updated = await updateTicketStatus(id, normalizedStatus, user.id);
  if (!updated) {
    return noStoreJson({ error: "Status invalido" }, { status: 400 });
  }

  appendTicketEvent({
    ticketId: updated.id,
    type: "STATUS_CHANGED",
    actorUserId: user.id,
    payload: {
      from: current.status,
      to: updated.status,
      reason: reason || null,
    },
  }).catch((err) => console.error("Falha ao registrar status:", err));

  notifyTicketStatusChanged({
    ticket: updated,
    actorId: user.id,
    nextStatusLabel: getTicketStatusLabel(updated.status),
    reason,
  }).catch((err) => console.error("Falha ao notificar status:", err));

  const enriched = await attachAssigneeToTicket(updated);
  return noStoreJson({ item: enriched }, { status: 200 });
}
