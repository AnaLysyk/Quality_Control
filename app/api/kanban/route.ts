import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import store, { nextId } from "./store";
import type { Status } from "./types";

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

  // Prefer the app-level `users` table (auth_user_id) used by `/api/me`.
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

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asProject(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function asRunId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

function asOptionalCaseId(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = asProject(searchParams.get("project"));
  const runId = asRunId(searchParams.get("runId"));
  const requestedSlug = asSlug(searchParams.get("slug"));

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }

  const access = await requireAccess(request);
  if (!access) return jsonError("Unauthorized", 401);

  let effectiveSlug: string | null = null;
  if (access.isGlobalAdmin) {
    effectiveSlug = requestedSlug;
  } else {
    if (!access.clientSlug) return jsonError("Usuário sem empresa vinculada", 403);
    if (requestedSlug && requestedSlug !== access.clientSlug) return jsonError("Forbidden", 403);
    // default to user's own company if slug wasn't provided
    effectiveSlug = access.clientSlug;
  }

  if (SUPABASE_MOCK) {
    const items = store
      .filter((c) => {
        if (c.project !== project || c.run_id !== runId) return false;
        if (!effectiveSlug) return true;
        return c.client_slug === effectiveSlug;
      })
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });

    if (!items.length) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ items });
  }

  const supabase = getSupabaseServer();
  const query = supabase
    .from("kanban_cards")
    .select("id,client_slug,project,run_id,case_id,title,status,bug,link,created_at")
    .eq("project", project)
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  const { data, error } = effectiveSlug ? await query.eq("client_slug", effectiveSlug) : await query;

  if (!error) {
    const items = (data ?? []).map((row) => ({
      id: Number((row as { id: unknown }).id),
      project: (row as { project: string }).project,
      run_id: (row as { run_id: number }).run_id,
      case_id: (row as { case_id: number | null }).case_id ?? null,
      title: (row as { title: string }).title,
      status: (row as { status: string }).status as Status,
      bug: (row as { bug: string | null }).bug ?? null,
      link: (row as { link: string | null }).link ?? null,
      created_at: (row as { created_at: string | null }).created_at ?? null,
      client_slug: (row as { client_slug: string }).client_slug,
    }));
    if (!items.length) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ items });
  }

  // Fallback to in-memory store when table is missing (dev/local).
  if (!isMissingRelationError(error)) {
    console.error("GET /api/kanban error", error);
    return jsonError("Erro ao buscar cards", 500);
  }

  const items = store
    .filter((c) => {
      if (c.project !== project || c.run_id !== runId) return false;
      if (!effectiveSlug) return true;
      return c.client_slug === effectiveSlug;
    })
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });

  if (!items.length) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const access = await requireAccess(request);
  if (!access) return jsonError("Unauthorized", 401);

  const record = body as Record<string, unknown>;
  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const title = asTitle(record.title);
  const status = normalizeStatus(record.status);

  const requestedSlug = asSlug(record.slug);
  let effectiveSlug: string | null = null;
  if (access.isGlobalAdmin) {
    effectiveSlug = requestedSlug ?? access.clientSlug;
  } else {
    if (!access.clientSlug) return jsonError("slug é obrigatório para usuários não-admin", 400);
    if (requestedSlug && requestedSlug !== access.clientSlug) return jsonError("Forbidden", 403);
    effectiveSlug = access.clientSlug;
  }

  if (!effectiveSlug) return jsonError("slug é obrigatório", 400);
  if (!project || runId === null || !title || !status) {
    return jsonError("Campos obrigatorios: project, runId, title, status valido", 400);
  }

  const caseId = asOptionalCaseId(record.case_id ?? record.caseId ?? record.id);
  const bug = asOptionalString(record.bug);
  const link = asOptionalString(record.link);

  if (SUPABASE_MOCK) {
    const card = {
      id: nextId(),
      client_slug: effectiveSlug,
      project,
      run_id: runId,
      case_id: caseId,
      title,
      status,
      bug,
      link,
      created_at: new Date().toISOString(),
    };
    store.push(card);
    return NextResponse.json(card, { status: 201 });
  }

  const supabase = getSupabaseServer();
  const insertRow = {
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: caseId,
    title,
    status,
    bug,
    link,
    created_by: access.userId,
  };

  const { data, error } = await supabase
    .from("kanban_cards")
    .insert(insertRow)
    .select("id,project,run_id,case_id,title,status,bug,link,created_at")
    .maybeSingle();

  if (!error && data) {
    return NextResponse.json(
      {
        id: Number((data as { id: unknown }).id),
        project: (data as { project: string }).project,
        run_id: (data as { run_id: number }).run_id,
        case_id: (data as { case_id: number | null }).case_id ?? null,
        title: (data as { title: string }).title,
        status: (data as { status: string }).status,
        bug: (data as { bug: string | null }).bug ?? null,
        link: (data as { link: string | null }).link ?? null,
        created_at: (data as { created_at: string | null }).created_at ?? null,
      },
      { status: 201 },
    );
  }

  if (!isMissingRelationError(error)) {
    console.error("POST /api/kanban error", error);
    return jsonError("Erro ao criar card", 500);
  }

  // Fallback to in-memory store.
  const card = {
    id: nextId(),
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: caseId,
    title,
    status,
    bug,
    link,
    created_at: new Date().toISOString(),
  };
  store.push(card);
  return NextResponse.json(card, { status: 201 });
}
