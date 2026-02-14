import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticketsStore";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { isItDev } from "@/lib/rbac/tickets";
import { attachAssigneeInfo, attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { withCompanyValidation } from "@/lib/middleware/withCompanyValidation";

const MAX_REQUEST_BYTES = 24 * 1024;
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4000;
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_TYPES = new Set(["bug", "melhoria", "tarefa"]);
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_LIST_LIMIT = 500; 
const DEFAULT_LIST_LIMIT = 200;

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function parseLimit(url: URL) {
  const raw = Number(url.searchParams.get("limit") ?? DEFAULT_LIST_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIST_LIMIT;
  const clamped = Math.floor(raw);
  return Math.max(1, Math.min(MAX_LIST_LIMIT, clamped));
}

function parseScope(scopeRaw: string | null): "mine" | "all" {
  const scope = (scopeRaw ?? "mine").trim().toLowerCase();
  if (scope === "mine" || scope === "all") return scope;
  throw new Error("INVALID_SCOPE");
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeTags(raw: unknown) {
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized) continue;
    const sliced = normalized.slice(0, MAX_TAG_LENGTH);
    if (seen.has(sliced)) continue;
    seen.add(sliced);
    tags.push(sliced);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags.length ? tags : [];
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return noStoreJson({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const role = (user.role ?? "").toLowerCase();
    const allowAll = isItDev(user);
    const allowCompanyScope = role === "company";
    let scope = parseScope(url.searchParams.get("scope"));
    if (scope === "mine" && allowCompanyScope) {
      scope = "all";
    }
    if (scope === "all" && !(allowAll || allowCompanyScope)) {
      return noStoreJson({ error: "Sem permissao" }, { status: 403 });
    }

    const limit = parseLimit(url);
    let items = scope === "all" ? await listAllTickets() : await listTicketsForUser(user.id);

    if (scope === "all" && !allowAll) {
      if (user.companyId) {
        items = items.filter((ticket) => ticket.companyId === user.companyId);
      } else if (user.companySlug) {
        items = items.filter((ticket) => ticket.companySlug === user.companySlug);
      } else if (Array.isArray(user.companySlugs) && user.companySlugs.length) {
        items = items.filter(
          (ticket) => ticket.companySlug && user.companySlugs?.includes(ticket.companySlug),
        );
      } else {
        items = [];
      }
    }

    const slice = items.slice(0, limit);
    const enriched = await attachAssigneeInfo(slice);
    return noStoreJson({ items: enriched }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SCOPE") {
      return noStoreJson({ error: "Scope invalido" }, { status: 400 });
    }
    console.error("[chamados][GET] erro ao listar chamados", error);
    return noStoreJson({ error: "Falha ao listar chamados" }, { status: 500 });
  }
}

export const POST = withCompanyValidation(async (user, companyId, req) => {
  try {
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

    const body = parsed as Record<string, unknown>;

    const title = normalizeOptionalString(body.title, MAX_TITLE_LENGTH);
    const description = normalizeOptionalString(body.description, MAX_DESCRIPTION_LENGTH);
    const type = normalizeOptionalString(body.type, 32);
    const priority = normalizeOptionalString(body.priority, 16);
    const tags = normalizeTags(body.tags);

    if (!title && !description) {
      return noStoreJson({ error: "Informe titulo ou descricao" }, { status: 400 });
    }

    if (title && title.length < MIN_TITLE_LENGTH) {
      return noStoreJson({ error: "Titulo muito curto" }, { status: 422 });
    }

    if (type && !ALLOWED_TYPES.has(type.toLowerCase())) {
      return noStoreJson({ error: "Tipo invalido" }, { status: 422 });
    }

    if (priority && !ALLOWED_PRIORITIES.has(priority.toLowerCase())) {
      return noStoreJson({ error: "Prioridade invalida" }, { status: 422 });
    }

    const localUser = await getLocalUserById(user.id);

    const ticket = await createTicket({
      title,
      description,
      type,
      priority,
      tags,
      createdBy: user.id,
      createdByName: localUser?.name ?? null,
      createdByEmail: localUser?.email ?? null,
      companySlug: user.companySlug ?? null,
      companyId: companyId ?? user.companyId ?? null,
    });

    if (!ticket) {
      return noStoreJson({ error: "Chamado invalido" }, { status: 400 });
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

    const enriched = await attachAssigneeToTicket(ticket);
    return noStoreJson({ item: enriched }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar chamado";
    console.error("[chamados] Falha ao criar chamado:", err);
    return noStoreJson({ error: message }, { status: 500 });
  }
});

