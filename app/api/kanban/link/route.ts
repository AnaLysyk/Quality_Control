import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import store, { nextId } from "../store";
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

  return { userId, isGlobalAdmin, clientSlug };
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

function asOptionalString(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asCaseId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const access = await requireAccess(request);
  if (!access) return jsonError("Não autorizado", 401);

  const record = body as Record<string, unknown>;
  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const caseId = asCaseId(record.caseId ?? record.case_id ?? record.id);

  const requestedSlug = asSlug(record.slug);
  let effectiveSlug: string | null = null;
  if (access.isGlobalAdmin) {
    effectiveSlug = requestedSlug ?? access.clientSlug;
  } else {
    if (!access.clientSlug) return jsonError("slug é obrigatório", 400);
    if (requestedSlug && requestedSlug !== access.clientSlug) return jsonError("Acesso proibido", 403);
    effectiveSlug = access.clientSlug;
  }

  if (!effectiveSlug) return jsonError("slug é obrigatório", 400);
  if (!project || runId === null || caseId === null) {
    return jsonError("Campos obrigatorios: project, runId, caseId", 400);
  }

  const title = record.title !== undefined ? asTitle(record.title) : null;
  const status = record.status !== undefined ? normalizeStatus(record.status) : null;
  if (record.status !== undefined && !status) return jsonError("Status invalido", 400);

  const bug = record.bug !== undefined ? (record.bug === null ? null : asOptionalString(record.bug)) : undefined;
  const link = record.link !== undefined ? (record.link === null ? null : asOptionalString(record.link)) : undefined;

  if (bug === undefined && link === undefined && title === null && status === null) {
    return jsonError("Nenhum campo para atualizar", 400);
  }

  if (SUPABASE_MOCK) {
    const existing = store.find(
      (c) => c.project === project && c.run_id === runId && c.case_id === caseId && c.client_slug === effectiveSlug,
    );
    if (existing) {
      if (title) existing.title = title;
      if (status) existing.status = status;
      if (bug !== undefined) existing.bug = bug as string | null;
      if (link !== undefined) existing.link = link as string | null;
      return NextResponse.json(existing);
    }

    if (!title || !status) {
      return jsonError("Para criar, informe title e status", 400);
    }

    const created = {
      id: nextId(),
      client_slug: effectiveSlug,
      project,
      run_id: runId,
      case_id: caseId,
      title,
      status,
      bug: (bug as string | null | undefined) ?? null,
      link: (link as string | null | undefined) ?? null,
      created_at: new Date().toISOString(),
    };
    store.push(created);
    return NextResponse.json(created, { status: 201 });
  }

  const supabase = getSupabaseServer();

  // 1) Try update by composite key
  const { data: existing, error: existingError } = await supabase
    .from("kanban_cards")
    .select("id")
    .eq("client_slug", effectiveSlug)
    .eq("project", project)
    .eq("run_id", runId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (existingError && !isMissingRelationError(existingError)) {
    console.error("POST /api/kanban/link lookup error", existingError);
    return jsonError("Erro ao salvar link", 500);
  }

  const updateRow: Record<string, unknown> = {};
  if (title) updateRow.title = title;
  if (status) updateRow.status = status;
  if (bug !== undefined) updateRow.bug = bug;
  if (link !== undefined) updateRow.link = link;

  if (existing && (existing as { id?: unknown }).id) {
    const id = Number((existing as { id: unknown }).id);
    const { data, error } = await supabase
      .from("kanban_cards")
      .update(updateRow)
      .eq("id", id)
      .select("id,client_slug,project,run_id,case_id,title,status,bug,link,created_at")
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        id: Number((data as { id: unknown }).id),
        project: (data as { project: string }).project,
        run_id: (data as { run_id: number }).run_id,
        case_id: (data as { case_id: number | null }).case_id ?? null,
        title: (data as { title: string }).title,
        status: (data as { status: string }).status,
        bug: (data as { bug: string | null }).bug ?? null,
        link: (data as { link: string | null }).link ?? null,
        created_at: (data as { created_at: string | null }).created_at ?? null,
        client_slug: (data as { client_slug: string }).client_slug,
      });
    }

    if (!isMissingRelationError(error)) {
      console.error("POST /api/kanban/link update error", error);
      return jsonError("Erro ao salvar link", 500);
    }
  }

  // 2) Inserir quando não encontrado
  if (!title || !status) {
    return jsonError("Para criar, informe title e status", 400);
  }

  const insertRow = {
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: caseId,
    title,
    status,
    bug: bug === undefined ? null : bug,
    link: link === undefined ? null : link,
    created_by: access.userId,
  };

  const { data, error } = await supabase
    .from("kanban_cards")
    .insert(insertRow)
    .select("id,client_slug,project,run_id,case_id,title,status,bug,link,created_at")
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
        client_slug: (data as { client_slug: string }).client_slug,
      },
      { status: 201 },
    );
  }

  if (!isMissingRelationError(error)) {
    console.error("POST /api/kanban/link insert error", error);
    return jsonError("Erro ao salvar link", 500);
  }

  // Table missing fallback is SUPABASE_MOCK store; already handled above.
  return jsonError("Kanban não disponível", 501);
}
