import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import store from "../store";
import type { Status } from "../types";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type Access = {
  userId: string;
  isGlobalAdmin: boolean;
  clientSlugs: string[];
  defaultSlug: string | null;
};

type ExportRow = {
  id: number;
  client_slug?: string;
  project: string;
  run_id: number;
  case_id: number | null;
  title: string;
  status: Status;
  bug: string | null;
  link: string | null;
  created_at: string | null;
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
      console.error("/api/kanban/export requireAccess user_clients error", linkError);
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
      console.error("/api/kanban/export requireAccess user_clients (auth) error", linkAuthError);
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
      console.error("/api/kanban/export requireAccess cliente error", clienteError);
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
        console.error("/api/kanban/export requireAccess clients error", clientsError);
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

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  if (!/[\n\r,\"]/g.test(s)) return s;
  return `"${s.replace(/\"/g, '""')}"`;
}

function toCsv(rows: ExportRow[]) {
  const header = [
    "id",
    "client_slug",
    "project",
    "run_id",
    "case_id",
    "title",
    "status",
    "bug",
    "link",
    "created_at",
  ].join(",");

  const lines = rows.map((r) =>
    [
      csvEscape(r.id),
      csvEscape(r.client_slug ?? ""),
      csvEscape(r.project),
      csvEscape(r.run_id),
      csvEscape(r.case_id ?? ""),
      csvEscape(r.title),
      csvEscape(r.status),
      csvEscape(r.bug ?? ""),
      csvEscape(r.link ?? ""),
      csvEscape(r.created_at ?? ""),
    ].join(","),
  );

  // include BOM for Excel compatibility
  return `\ufeff${header}\n${lines.join("\n")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = asProject(searchParams.get("project"));
  // Rate limit: 30 req/min per IP
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(request, `kanban-export:${ip}`);
  if (rate.limited) return rate.response;
  const runId = asRunId(searchParams.get("runId"));
  const requestedSlug = normalizeSlug(asSlug(searchParams.get("slug")));
  const format = (searchParams.get("format") || "csv").toLowerCase();

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }

  const access = await requireAccess(request);
  if (!access) return jsonError("Não autorizado", 401);

  let effectiveSlug: string | null = null;
  if (access.isGlobalAdmin) {
    effectiveSlug = requestedSlug;
  } else {
    if (!access.clientSlugs.length) return jsonError("Acesso proibido", 403);
    if (requestedSlug) {
      if (!access.clientSlugs.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
      effectiveSlug = requestedSlug;
    } else {
      effectiveSlug = access.defaultSlug;
    }
  }

  if (!effectiveSlug && !access.isGlobalAdmin) {
    return jsonError("slug é obrigatório", 400);
  }

  let rows: ExportRow[] = [];

  if (SUPABASE_MOCK) {
    rows = store
      .filter((c) => {
        if (c.project !== project || c.run_id !== runId) return false;
        if (!effectiveSlug) return true;
        return c.client_slug === effectiveSlug;
      })
      .map((c) => ({
        id: c.id,
        client_slug: c.client_slug ?? effectiveSlug ?? undefined,
        project: c.project,
        run_id: c.run_id ?? runId,
        case_id: c.case_id ?? null,
        title: c.title ?? "",
        status: (c.status ?? "NOT_RUN") as Status,
        bug: c.bug ?? null,
        link: c.link ?? null,
        created_at: c.created_at ?? null,
      }));
  } else {
    const supabase = getSupabaseServer();
    const baseQuery = supabase
      .from("kanban_cards")
      .select("id,client_slug,project,run_id,case_id,title,status,bug,link,created_at")
      .eq("project", project)
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    const { data, error } = effectiveSlug ? await baseQuery.eq("client_slug", effectiveSlug) : await baseQuery;

    if (!error) {
      rows = (data ?? []).map((row) => ({
        id: Number((row as { id: unknown }).id),
        client_slug: (row as { client_slug: string }).client_slug,
        project: (row as { project: string }).project,
        run_id: (row as { run_id: number }).run_id,
        case_id: (row as { case_id: number | null }).case_id ?? null,
        title: (row as { title: string }).title,
        status: (row as { status: string }).status as Status,
        bug: (row as { bug: string | null }).bug ?? null,
        link: (row as { link: string | null }).link ?? null,
        created_at: (row as { created_at: string | null }).created_at ?? null,
      }));
    } else if (isMissingRelationError(error)) {
      rows = store
        .filter((c) => {
          if (c.project !== project || c.run_id !== runId) return false;
          if (!effectiveSlug) return true;
          return c.client_slug === effectiveSlug;
        })
        .map((c) => ({
          id: c.id,
          client_slug: c.client_slug ?? effectiveSlug ?? undefined,
          project: c.project,
          run_id: c.run_id ?? runId,
          case_id: c.case_id ?? null,
          title: c.title ?? "",
          status: (c.status ?? "NOT_RUN") as Status,
          bug: c.bug ?? null,
          link: c.link ?? null,
          created_at: c.created_at ?? null,
        }));
    } else {
      console.error("GET /api/kanban/export error", error);
      return jsonError("Erro ao exportar cards", 500);
    }
  }

  if (format === "json") {
    return NextResponse.json({ items: rows });
  }

  const csv = toCsv(rows);
  const filename = `kanban_${project}_${runId}${effectiveSlug ? `_${effectiveSlug}` : ""}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
