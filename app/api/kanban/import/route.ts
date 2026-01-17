import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Papa from "papaparse";
import { getSupabaseServer } from "@/lib/supabaseServer";
import store, { nextId } from "../store";
import type { Status } from "../types";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type Access = {
  userId: string;
  isGlobalAdmin: boolean;
  clientSlugs: string[];
  defaultSlug: string | null;
};

type ImportItem = {
  title: string;
  status: Status;
  case_id?: number | null;
  bug?: string | null;
  link?: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function slugFromName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    return { userId: "mock-uid", isGlobalAdmin: true, clientSlugs: ["mock-client"], defaultSlug: "mock-client" };
  }

  const token = await extractToken(req);
  if (!token) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;

  const { data: userRow } = await supabase
    .from("users")
    .select("id,client_id,client_slug,cliente,role,is_global_admin,active")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: profileByAuth } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("auth_user_id", userId)
    .limit(1)
    .maybeSingle();

  let profileRow = profileByAuth as Record<string, unknown> | null;
  if (!profileRow) {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("is_global_admin,role")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();
    profileRow = (profileById ?? null) as Record<string, unknown> | null;
  }

  const userRecord = (userRow ?? null) as Record<string, unknown> | null;

  const roleFromUser = normalizeSlug(userRecord?.role);
  const roleFromProfile = normalizeSlug(profileRow?.role);
  const metadataRole = (() => {
    const metadata = asRecord(data.user.app_metadata);
    if (!metadata) return null;
    return normalizeSlug(metadata["role"]);
  })();

  const isGlobalAdmin =
    userRecord?.is_global_admin === true ||
    roleFromUser === "global_admin" ||
    roleFromUser === "admin" ||
    profileRow?.is_global_admin === true ||
    roleFromProfile === "global_admin" ||
    roleFromProfile === "admin" ||
    metadataRole === "global_admin" ||
    metadataRole === "admin";

  const slugCandidates = new Map<string, number>();
  const registerSlug = (slug: string | null, priority: number) => {
    if (!slug) return;
    const currentPriority = slugCandidates.get(slug);
    if (currentPriority === undefined || priority < currentPriority) {
      slugCandidates.set(slug, priority);
    }
  };

  const registerPotentialSlug = (value: unknown, priority: number, fallbackPriority?: number) => {
    if (typeof value !== "string") return;
    const normalized = normalizeSlug(value);
    if (!normalized) return;
    if (/^[a-z0-9-]+$/.test(normalized)) {
      registerSlug(normalized, priority);
      return;
    }
    const fallback = slugFromName(value);
    if (fallback) registerSlug(fallback, fallbackPriority ?? priority + 10);
  };

  const registerNameDerivedSlug = (value: unknown, priority: number) => {
    const fallback = slugFromName(value);
    if (fallback) registerSlug(fallback, priority);
  };

  const clientIds = new Set<string>();
  const addClientId = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) clientIds.add(trimmed);
  };

  registerPotentialSlug(userRecord?.client_slug, 10);
  registerNameDerivedSlug(userRecord?.cliente, 40);
  addClientId(userRecord?.client_id);

  if (userRecord?.id) {
    const { data: linkRows, error: linkError } = await supabase
      .from("user_clients")
      .select("client_id,active")
      .eq("user_id", userRecord.id)
      .eq("active", true);

    if (!linkError && Array.isArray(linkRows)) {
      for (const link of linkRows) addClientId((link as { client_id?: string | null }).client_id);
    } else if (linkError && !isMissingRelationError(linkError)) {
      console.error("/api/kanban/import requireAccess user_clients error", linkError);
    }
  }

  if (!clientIds.size) {
    const { data: linkRowsByAuth, error: linkAuthError } = await supabase
      .from("user_clients")
      .select("client_id,active")
      .eq("auth_user_id", userId)
      .eq("active", true);

    if (!linkAuthError && Array.isArray(linkRowsByAuth)) {
      for (const link of linkRowsByAuth) addClientId((link as { client_id?: string | null }).client_id);
    } else if (linkAuthError && !isMissingRelationError(linkAuthError)) {
      console.error("/api/kanban/import requireAccess user_clients (auth) error", linkAuthError);
    }
  }

  if (clientIds.size) {
    const ids = Array.from(clientIds);
    const { data: clienteRows, error: clienteError } = await supabase
      .from("cliente")
      .select("id,slug,company_name,name")
      .in("id", ids);

    if (!clienteError && Array.isArray(clienteRows)) {
      for (const rowAny of clienteRows) {
        const row = rowAny as Record<string, unknown>;
        registerPotentialSlug(row.slug, 5);
        registerNameDerivedSlug(row.company_name, 25);
        registerNameDerivedSlug(row.name, 26);
      }
    } else if (clienteError && !isMissingRelationError(clienteError)) {
      console.error("/api/kanban/import requireAccess cliente error", clienteError);
    }

    if (!slugCandidates.size) {
      const { data: clientsRows, error: clientsError } = await supabase
        .from("clients")
        .select("id,slug,company_name,name")
        .in("id", ids);

      if (!clientsError && Array.isArray(clientsRows)) {
        for (const rowAny of clientsRows) {
          const row = rowAny as Record<string, unknown>;
          registerPotentialSlug(row.slug, 8);
          registerNameDerivedSlug(row.company_name, 28);
          registerNameDerivedSlug(row.name, 29);
        }
      } else if (clientsError && !isMissingRelationError(clientsError)) {
        console.error("/api/kanban/import requireAccess clients error", clientsError);
      }
    }
  }

  const slugList = Array.from(slugCandidates.entries())
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([slug]) => slug);

  const defaultSlug = slugList[0] ?? null;

  return {
    userId,
    isGlobalAdmin,
    clientSlugs: slugList,
    defaultSlug,
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

function parseItemsFromJson(body: unknown): { project: string | null; runId: number | null; slug: string | null; items: ImportItem[] } {
  if (!body || typeof body !== "object") return { project: null, runId: null, slug: null, items: [] };
  const record = body as Record<string, unknown>;

  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const slug = asSlug(record.slug);

  const rawItems = (record.items ?? record.cards) as unknown;
  if (!Array.isArray(rawItems)) return { project, runId, slug, items: [] };

  const items: ImportItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = asTitle(r.title);
    const status = normalizeStatus(r.status);
    if (!title || !status) continue;

    const case_id = asOptionalCaseId(r.case_id ?? r.caseId ?? r.id);
    const bug = asOptionalString(r.bug);
    const link = asOptionalString(r.link);

    items.push({ title, status, case_id, bug, link });
  }

  return { project, runId, slug, items };
}

function parseItemsFromCsv(csvText: string): ImportItem[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const items: ImportItem[] = [];
  for (const row of parsed.data ?? []) {
    const title = asTitle(row.title);
    const status = normalizeStatus(row.status);
    if (!title || !status) continue;

    const case_id = asOptionalCaseId(row.case_id ?? row.caseId ?? row.id);
    const bug = asOptionalString(row.bug);
    const link = asOptionalString(row.link);

    items.push({ title, status, case_id, bug, link });
  }

  return items;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryProject = asProject(searchParams.get("project"));
  const queryRunId = asRunId(searchParams.get("runId"));
  const requestedSlug = normalizeSlug(asSlug(searchParams.get("slug")));

  const access = await requireAccess(request);
  if (!access) return jsonError("Não autorizado", 401);

  let effectiveSlug: string | null = null;
  if (access.isGlobalAdmin) {
    effectiveSlug = requestedSlug ?? access.defaultSlug;
  } else {
    if (!access.clientSlugs.length) return jsonError("Acesso proibido", 403);
    if (requestedSlug) {
      if (!access.clientSlugs.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
      effectiveSlug = requestedSlug;
    } else {
      effectiveSlug = access.defaultSlug;
    }
  }

  if (!effectiveSlug) return jsonError("slug é obrigatório", 400);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  let project: string | null = queryProject;
  let runId: number | null = queryRunId;
  let items: ImportItem[] = [];

  if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
    if (!project || runId === null) {
      return jsonError("project e runId sao obrigatorios para importação CSV", 400);
    }
    const text = await request.text();
    items = parseItemsFromCsv(text);
  } else {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError("JSON invalido", 400);
    const parsed = parseItemsFromJson(body);
    project = parsed.project ?? project;
    runId = parsed.runId ?? runId;
    // slug no body só é aceito se bater com o slug efetivo (ou for admin)
    const bodySlug = normalizeSlug(parsed.slug);
    if (bodySlug) {
      if (access.isGlobalAdmin) {
        effectiveSlug = bodySlug;
      } else {
        if (!access.clientSlugs.includes(bodySlug)) return jsonError("Acesso proibido", 403);
        if (requestedSlug && bodySlug !== requestedSlug) return jsonError("Acesso proibido", 403);
        effectiveSlug = bodySlug;
      }
    }
    items = parsed.items;
  }

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }
  if (!items.length) {
    return jsonError("Nenhum item válido para importar (verifique title/status)", 400);
  }

  if (SUPABASE_MOCK) {
    for (const item of items) {
      store.push({
        id: nextId(),
        client_slug: effectiveSlug,
        project,
        run_id: runId,
        case_id: item.case_id ?? null,
        title: item.title,
        status: item.status,
        bug: item.bug ?? null,
        link: item.link ?? null,
        created_at: new Date().toISOString(),
      });
    }
    return NextResponse.json({ inserted: items.length, mode: "mock" }, { status: 201 });
  }

  const supabase = getSupabaseServer();
  const rows = items.map((item) => ({
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: item.case_id ?? null,
    title: item.title,
    status: item.status,
    bug: item.bug ?? null,
    link: item.link ?? null,
    created_by: access.userId,
  }));

  const { data, error } = await supabase.from("kanban_cards").insert(rows).select("id");

  if (!error) {
    return NextResponse.json({ inserted: (data ?? []).length }, { status: 201 });
  }

  if (!isMissingRelationError(error)) {
    console.error("POST /api/kanban/import error", error);
    return jsonError("Erro ao importar cards", 500);
  }

  // Fallback para dev/local (tabela ainda não criada)
  for (const item of items) {
    store.push({
      id: nextId(),
      client_slug: effectiveSlug,
      project,
      run_id: runId,
      case_id: item.case_id ?? null,
      title: item.title,
      status: item.status,
      bug: item.bug ?? null,
      link: item.link ?? null,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ inserted: items.length, mode: "memory" }, { status: 201 });
}
