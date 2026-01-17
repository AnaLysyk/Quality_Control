import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import store from "../store";
import type { Status } from "../types";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type Access = {
  userId: string;
  isGlobalAdmin: boolean;
  clientSlug: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function extractToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }
  const store = await cookies();
  return store.get("sb-access-token")?.value || store.get("auth_token")?.value || null;
}

function isMissingRelationError(error: unknown) {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string") return false;
  return message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist");
}

async function requireAccess(req: Request): Promise<Access | null> {
  if (SUPABASE_MOCK) {
    return { userId: "mock-uid", isGlobalAdmin: true, clientSlug: "mock-client" };
  }

  const token = await extractToken(req);
  if (!token) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;

  const { data: userRow } = await supabase
    .from("users")
    .select("client_id,is_global_admin,role")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", userId)
    .maybeSingle();

  const isGlobalAdmin =
    (userRow as { is_global_admin?: unknown } | null)?.is_global_admin === true ||
    (userRow as { role?: unknown } | null)?.role === "global_admin" ||
    (userRow as { role?: unknown } | null)?.role === "admin" ||
    profileRow?.is_global_admin === true ||
    profileRow?.role === "global_admin";

  let clientSlug: string | null = null;
  const clientId = (userRow as { client_id?: unknown } | null)?.client_id;
  if (typeof clientId === "string" && clientId.trim()) {
    const { data: clientRow } = await supabase.from("cliente").select("slug").eq("id", clientId).maybeSingle();
    const slug = (clientRow as { slug?: unknown } | null)?.slug;
    if (typeof slug === "string" && slug.trim()) clientSlug = slug.trim();
  }

  return {
    userId,
    isGlobalAdmin,
    clientSlug,
  };
}

function normalizeStatus(value: unknown): Status | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["PASS", "FAIL", "BLOCKED", "NOT_RUN"].includes(upper)) return upper as Status;

  const lower = raw.toLowerCase();
  if (lower === "pass" || lower === "passed") return "PASS";
  if (lower === "fail" || lower === "failed") return "FAIL";
  if (lower === "blocked") return "BLOCKED";
  if (lower === "notrun" || lower === "not_run" || lower === "not run" || lower === "untested") return "NOT_RUN";
  return null;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNumber = Number(id);
  if (!Number.isFinite(idNumber)) {
    return jsonError("Id invalido", 400);
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const access = await requireAccess(request);
  if (!access) return jsonError("Não autorizado", 401);

  if (!access.isGlobalAdmin && !access.clientSlug) return jsonError("Usuário sem empresa vinculada", 403);

  const record = body as Record<string, unknown>;
  const nextStatus = record.status !== undefined ? normalizeStatus(record.status) : null;
  if (record.status !== undefined && !nextStatus) {
    return jsonError("Status invalido", 400);
  }

  const updateRow: Record<string, unknown> = {};
  if (record.status !== undefined) updateRow.status = nextStatus;

  if (record.title !== undefined) {
    const title = asTitle(record.title);
    if (!title) return jsonError("Title invalido", 400);
    updateRow.title = title;
  }
  if (record.bug !== undefined) updateRow.bug = record.bug === null ? null : asOptionalString(record.bug);
  if (record.link !== undefined) updateRow.link = record.link === null ? null : asOptionalString(record.link);

  if (!Object.keys(updateRow).length) {
    return jsonError("Nenhum campo para atualizar", 400);
  }

  if (SUPABASE_MOCK) {
    const card = store.find(
      (c) => c.id === idNumber && (access.isGlobalAdmin || c.client_slug === access.clientSlug),
    );
    if (!card) return jsonError("Card nao encontrado", 404);
    if (updateRow.status !== undefined) card.status = updateRow.status as Status;
    if (updateRow.title !== undefined) card.title = updateRow.title as string;
    if (record.bug !== undefined) card.bug = (updateRow.bug as string | null) ?? null;
    if (record.link !== undefined) card.link = (updateRow.link as string | null) ?? null;
    return NextResponse.json(card);
  }

  const supabase = getSupabaseServer();
  const updateQuery = supabase.from("kanban_cards").update(updateRow).eq("id", idNumber);
  const scopedUpdateQuery = access.isGlobalAdmin ? updateQuery : updateQuery.eq("client_slug", access.clientSlug ?? "");
  const { data, error } = await scopedUpdateQuery
    .select("id,client_slug,project,run_id,case_id,title,status,bug,link,created_at")
    .maybeSingle();

  if (!error && data) {
    return NextResponse.json({
      id: Number((data as { id: unknown }).id),
      project: (data as { project: string }).project,
      run_id: (data as { run_id: number }).run_id,
      case_id: (data as { case_id: number | null }).case_id ?? null,
      title: (data as { title: string }).title,
      status: (data as { status: string }).status as Status,
      bug: (data as { bug: string | null }).bug ?? null,
      link: (data as { link: string | null }).link ?? null,
      created_at: (data as { created_at: string | null }).created_at ?? null,
      client_slug: (data as { client_slug: string }).client_slug,
    });
  }

  if (!isMissingRelationError(error)) {
    console.error("PATCH /api/kanban/:id error", error);
    return jsonError("Erro ao atualizar card", 500);
  }

  // Fallback to in-memory store when table is missing (dev/local).
  const card = store.find((c) => c.id === idNumber && (access.isGlobalAdmin || c.client_slug === access.clientSlug));
  if (!card) return jsonError("Card nao encontrado", 404);
  if (updateRow.status !== undefined) card.status = updateRow.status as Status;
  if (updateRow.title !== undefined) card.title = updateRow.title as string;
  if (record.bug !== undefined) card.bug = (updateRow.bug as string | null) ?? null;
  if (record.link !== undefined) card.link = (updateRow.link as string | null) ?? null;
  return NextResponse.json(card);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNumber = Number(id);
  if (!Number.isFinite(idNumber)) {
    return jsonError("Id invalido", 400);
  }

  const access = await requireAccess(request);
  if (!access) return jsonError("Não autorizado", 401);

  if (!access.isGlobalAdmin && !access.clientSlug) return jsonError("Usuário sem empresa vinculada", 403);

  if (SUPABASE_MOCK) {
    const idx = store.findIndex(
      (c) => c.id === idNumber && (access.isGlobalAdmin || c.client_slug === access.clientSlug),
    );
    if (idx === -1) return jsonError("Card nao encontrado", 404);
    const [removed] = store.splice(idx, 1);
    return NextResponse.json({ id: removed.id });
  }

  const supabase = getSupabaseServer();
  const deleteQuery = supabase.from("kanban_cards").delete().eq("id", idNumber);
  const scopedDeleteQuery = access.isGlobalAdmin ? deleteQuery : deleteQuery.eq("client_slug", access.clientSlug ?? "");
  const { data, error } = await scopedDeleteQuery.select("id").maybeSingle();

  if (!error && data) {
    return NextResponse.json({ id: Number((data as { id: unknown }).id) });
  }

  if (!isMissingRelationError(error)) {
    console.error("DELETE /api/kanban/:id error", error);
    return jsonError("Erro ao remover card", 500);
  }

  // Fallback to in-memory store.
  const idx = store.findIndex((c) => c.id === idNumber && (access.isGlobalAdmin || c.client_slug === access.clientSlug));
  if (idx === -1) return jsonError("Card nao encontrado", 404);
  const [removed] = store.splice(idx, 1);
  return NextResponse.json({ id: removed.id });
}
