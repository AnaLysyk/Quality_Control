import { NextResponse } from "next/server";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";
import { fetchBackend } from "@/lib/backendProxy";
import { getRedis } from "@/lib/redis";

type AuthCompany = {
  id: string;
  slug: string;
  name: string;
  role: string;
  active: boolean;
};

type LandingRole = "admin" | "company" | "user";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  return (
    readCookieValue(cookieHeader, "sb-access-token") ||
    readCookieValue(cookieHeader, "auth_token") ||
    readCookieValue(cookieHeader, "access_token") ||
    (process.env.AUTH_COOKIE_NAME ? readCookieValue(cookieHeader, process.env.AUTH_COOKIE_NAME) : null) ||
    null
  );
}

function extractSessionId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return readCookieValue(cookieHeader, "session_id");
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .map((segment) => {
      if (!segment) return "";
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseMockCompanySlugs(cookieHeader: string) {
  const rawValue = readCookieValue(cookieHeader, "mock_companies");
  if (rawValue !== null) {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0);
        }
      } catch {
        // ignore and fallback to comma split
      }
    }
    return trimmed
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  const fallback = (readCookieValue(cookieHeader, "mock_client_slug") ?? "griaule").trim();
  return fallback ? [fallback] : [];
}

function buildMockCompanies(cookieHeader: string) {
  const normalizedRole = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
  const rawCompanies = readCookieValue(cookieHeader, "mock_companies");
  const uniqueSlugs = Array.from(new Set(parseMockCompanySlugs(cookieHeader)));
  const slugs = rawCompanies !== null ? uniqueSlugs : uniqueSlugs.length ? uniqueSlugs : ["griaule"];
  const companyRole: "ADMIN" | "USER" =
    normalizedRole === "admin" || normalizedRole === "company" ? "ADMIN" : "USER";

  const companies: AuthCompany[] = slugs.map((slug) => ({
    id: `mock-company-${slug}`,
    slug,
    name: toTitleCase(slug),
    role: companyRole,
    active: true,
  }));

  const landingRole: LandingRole =
    normalizedRole === "admin" ? "admin" : normalizedRole === "company" ? "company" : "user";

  const first = companies[0];
  return {
    user: {
      id: `mock-${landingRole}-${slugs.join("_")}`,
      email: `${landingRole}@example.com`,
      name: landingRole === "admin" ? "Mock Admin" : "Mock User",
      role: landingRole,
      clientId: first?.id ?? null,
      clientSlug: first?.slug ?? null,
      defaultClientSlug: first?.slug ?? null,
      clientSlugs: companies.map((company) => company.slug),
      isGlobalAdmin: landingRole === "admin",
    },
    companies: companies,
  };
}

function dedupeCompanies(companies: AuthCompany[]) {
  const seen = new Set<string>();
  const output: AuthCompany[] = [];
  for (const company of companies) {
    if (!company.slug) continue;
    if (seen.has(company.slug)) continue;
    seen.add(company.slug);
    output.push(company);
  }
  return output;
}

function decideLandingRole(linked: AuthCompany[], sessionRole?: string | null): LandingRole {
  const normalizedSession = (sessionRole ?? "").toLowerCase();
  if (normalizedSession === "admin") return "admin";
  if (normalizedSession === "company") return "company";
  if (normalizedSession === "user") return "user";

  const hasAdminLink = linked.some((company) => company.role.toLowerCase() === "admin");
  if (hasAdminLink) return "admin";
  if (linked.length === 1) return "company";
  return "user";
}

function roleToUi(role: unknown): "ADMIN" | "USER" {
  if (typeof role !== "string") return "USER";
  const r = role.toLowerCase();
  if (r === "global_admin" || r === "admin" || r === "client_admin" || r === "client_owner" || r === "client_manager") {
    return "ADMIN";
  }
  return "USER";
}

async function executeInFilter<T extends Record<string, unknown>>(
  builder: unknown,
  column: string,
  values: string[]
): Promise<{ data: T[] | null; error: unknown }> {
  if (builder && typeof builder === "object" && typeof (builder as { in?: unknown }).in === "function") {
    const typed = builder as { in: (col: string, vals: string[]) => Promise<{ data: T[] | null; error: unknown }> };
    return typed.in(column, values);
  }

  const result = await builder;
  if (!result || typeof result !== "object" || !("data" in result)) {
    return { data: null, error: new Error("Query builder result missing data") };
  }

  const typed = result as { data: unknown; error: unknown };
  const dataset = Array.isArray(typed.data) ? typed.data : typed.data ? [typed.data] : [];

  const filtered = dataset.filter((row) => {
    const record = row as Record<string, unknown>;
    const raw = record[column];
    if (typeof raw === "string") return values.includes(raw);
    if (typeof raw === "number") return values.includes(String(raw));
    if (typeof raw === "object" && raw !== null && "toString" in raw) return values.includes(String(raw));
    return false;
  }) as T[];

  return { data: filtered, error: typed.error ?? null };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      user: null,
      companies: [],
      error: { code, message },
    },
    { status }
  );
}

export async function GET(req: Request) {
  const sessionId = extractSessionId(req);
  if (sessionId) {
    try {
      const redis = getRedis();
      const raw = await redis.get(`session:${sessionId}`);
      if (raw) {
        const session = typeof raw === "string" ? JSON.parse(raw) : raw;
        const user = {
          id: session.userId ?? session.id ?? session.sub ?? "session-user",
          email: session.email ?? null,
          name: session.name ?? null,
          role: session.role ?? "user",
          clientId: session.companyId ?? session.clientId ?? null,
          clientSlug: session.companySlug ?? session.clientSlug ?? null,
          defaultClientSlug: session.companySlug ?? session.clientSlug ?? null,
          clientSlugs: session.companySlug ? [session.companySlug] : session.clientSlug ? [session.clientSlug] : [],
          isGlobalAdmin: session.isGlobalAdmin === true || session.role === "admin",
        };
        const res = NextResponse.json({ user, companies: [] });
        res.cookies.set("session_id", sessionId, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 8,
        });
        await redis.expire(`session:${sessionId}`, 60 * 60 * 8);
        return res;
      }
    } catch {
      // ignore and continue auth flow
    }
  }

  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const mockRole = readCookieValue(cookieHeader, "mock_role");
    if (!mockRole) {
      return errorResponse(401, "NO_TOKEN", "Nao autorizado");
    }
    const baseMock = buildMockCompanies(cookieHeader);
    const landingRole = decideLandingRole(baseMock.companies, baseMock.user.role);
    const user = {
      id: baseMock.user.id,
      email: baseMock.user.email,
      name: baseMock.user.name,
      role: landingRole,
      clientId: baseMock.user.clientId,
      clientSlug: baseMock.user.clientSlug,
      defaultClientSlug: baseMock.user.defaultClientSlug,
      clientSlugs: baseMock.user.clientSlugs,
      isGlobalAdmin: baseMock.user.isGlobalAdmin,
    };
    return NextResponse.json({ user, companies: baseMock.companies });
  }

  const token = extractToken(req);
  if (!token) return errorResponse(401, "NO_TOKEN", "Nao autorizado");

  let backendUser: Record<string, unknown> | null = null;
  const backendRes = await fetchBackend(req, "/auth/me");
  if (backendRes) {
    const payload = (await backendRes.json().catch(() => null)) as Record<string, unknown> | null;
    if (!backendRes.ok) {
      const message =
        (payload?.error as Record<string, unknown> | undefined)?.message ||
        (payload?.message as string | undefined) ||
        "Nao autorizado";
      return errorResponse(backendRes.status, "BACKEND_AUTH_FAILED", String(message));
    }

    const rawUser = payload?.user;
    if (rawUser && typeof rawUser === "object") {
      backendUser = rawUser as Record<string, unknown>;
    } else {
      return errorResponse(401, "INVALID_TOKEN", "Nao autorizado");
    }
  }

  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return errorResponse(401, "INVALID_TOKEN", "Nao autorizado");

  const authUserId = authData.user.id;
  const authEmail = authData.user.email ?? null;
  const userMetadata = asRecord(authData.user.user_metadata);
  const displayName =
    typeof userMetadata?.full_name === "string" ? userMetadata.full_name.trim() :
    typeof userMetadata?.name === "string" ? userMetadata.name.trim() :
    authEmail ?? "";

  const baseUserSelect = "id, email, role, client_id, is_global_admin";
  let userRowResult = await supabase
    .from("users")
    .select(`${baseUserSelect}, name, active`)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (
    userRowResult.error &&
    (String(userRowResult.error?.message || "").toLowerCase().includes("column \"name\"") ||
      String(userRowResult.error?.message || "").toLowerCase().includes("column \"active\""))
  ) {
    userRowResult = await supabase
      .from("users")
      .select(`${baseUserSelect}, nome, ativo`)
      .eq("auth_user_id", authUserId)
      .maybeSingle();
  }

  if (userRowResult.error) {
    return errorResponse(500, "USER_LOOKUP_FAILED", "Erro ao buscar usuario");
  }

  const userRow = userRowResult.data as Record<string, unknown> | null;
  if (!userRow) return errorResponse(401, "NEEDS_BOOTSTRAP", "Usuario nao provisionado");

  const userActive = userRow.active === true || (userRow as { ativo?: unknown }).ativo === true;
  if (!userActive) return errorResponse(403, "USER_INACTIVE", "Usuario inativo");

  const { data: globalAdminLink, error: globalAdminError } = await supabase
    .from("global_admins")
    .select("user_id")
    .eq("user_id", authUserId)
    .limit(1)
    .maybeSingle();

  if (globalAdminError) {
    return errorResponse(500, "GLOBAL_ADMIN_LOOKUP_FAILED", "Erro ao validar admin global");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin, role")
    .eq("id", authUserId)
    .maybeSingle();

  const rawRole = typeof (userRow as { role?: unknown } | null)?.role === "string" ? String((userRow as { role?: unknown }).role) : null;
  const role = rawRole ? rawRole.toLowerCase() : null;
  const backendRole = typeof backendUser?.role === "string" ? String(backendUser.role) : null;
  const backendIsGlobalAdmin =
    backendUser?.isGlobalAdmin === true ||
    backendUser?.is_global_admin === true ||
    (typeof backendRole === "string" && backendRole.toLowerCase() === "global_admin") ||
    (typeof backendRole === "string" && backendRole.toLowerCase() === "admin");

  const isGlobalAdmin =
    Boolean((globalAdminLink as { user_id?: unknown } | null)?.user_id) ||
    (userRow as { is_global_admin?: unknown } | null)?.is_global_admin === true ||
    role === "global_admin" ||
    role === "admin" ||
    profileRow?.is_global_admin === true ||
    (typeof profileRow?.role === "string" ? profileRow.role.toLowerCase() === "global_admin" : false) ||
    (() => {
      const metadata = asRecord(authData.user.app_metadata);
      const metaRole = typeof metadata?.role === "string" ? metadata.role.toLowerCase() : null;
      return metaRole === "admin";
    })();

  const backendClientId =
    typeof backendUser?.clientId === "string"
      ? (backendUser.clientId as string)
      : typeof backendUser?.client_id === "string"
        ? (backendUser.client_id as string)
        : null;
  const clientId = backendClientId || (typeof (userRow as { client_id?: unknown } | null)?.client_id === "string" ? (userRow as { client_id: string }).client_id : null);

  if (!isGlobalAdmin && !clientId) {
    return errorResponse(403, "NO_COMPANY_LINK", "Sem empresa vinculada");
  }

  type CompanyRecord = {
    client_id: string | null;
    client_slug: string | null;
    client_name: string | null;
    client_active: boolean | null;
    role: "ADMIN" | "USER";
    link_active: boolean;
  };

  const companies = new Map<string, CompanyRecord>();
  const ensureCompany = (id: string | null, slug: string | null): CompanyRecord => {
    const key = id ?? slug ?? Math.random().toString(36);
    const existing = companies.get(key);
    if (existing) {
      if (id && !existing.client_id) existing.client_id = id;
      if (slug && !existing.client_slug) existing.client_slug = slug;
      return existing;
    }
    const record: CompanyRecord = {
      client_id: id,
      client_slug: slug,
      client_name: null,
      client_active: null,
      role: roleToUi(rawRole),
      link_active: true,
    };
    companies.set(key, record);
    return record;
  };

  if (clientId) ensureCompany(clientId, null);

  const clientIds = new Set<string>();
  if (clientId) clientIds.add(clientId);

  const collectLinks = async (column: "user_id" | "auth_user_id", value: string) => {
    const { data: linkRows, error: linkError } = await supabase
      .from("user_clients")
      .select("client_id, client_slug, role, active")
      .eq(column, value)
      .eq("active", true);

    if (linkError || !Array.isArray(linkRows)) return;
    for (const linkAny of linkRows) {
      const link = linkAny as Record<string, unknown>;
      const linkId = typeof link.client_id === "string" ? link.client_id : null;
      const linkSlug = typeof link.client_slug === "string" ? link.client_slug : null;
      const record = ensureCompany(linkId, linkSlug);
      record.role = roleToUi(link.role);
      record.link_active = true;
      if (linkId) clientIds.add(linkId);
    }
  };

  if (typeof (userRow as { id?: unknown } | null)?.id === "string") {
    await collectLinks("user_id", (userRow as { id: string }).id);
  }
  await collectLinks("auth_user_id", authUserId);

  if (clientIds.size) {
    const ids = Array.from(clientIds);
    const clienteQuery = supabase.from("cliente").select("id, company_name, slug, active");
    const { data: clienteRows, error: clienteError } = await executeInFilter<Record<string, unknown>>(clienteQuery, "id", ids);

    if (!clienteError && Array.isArray(clienteRows)) {
      for (const rowAny of clienteRows) {
        const row = rowAny as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : null;
        const slug = typeof row.slug === "string" ? row.slug : null;
        const name = typeof row.company_name === "string" && row.company_name.trim()
          ? row.company_name
          : typeof row.name === "string"
            ? row.name
            : slug ?? "Empresa";
        const record = ensureCompany(id, slug);
        record.client_name = name;
        record.client_slug = slug ?? record.client_slug ?? (typeof name === "string" ? slugifyRelease(name) ?? null : null);
        record.client_active = row.active === true;
      }
    }

    const unresolved = Array.from(companies.values()).filter((c) => c.client_id && !c.client_name);
    if (unresolved.length) {
      const missingIds = unresolved
        .map((c) => c.client_id)
        .filter((id): id is string => typeof id === "string");
      if (missingIds.length) {
        const clientsQuery = supabase.from("clients").select("id, slug, company_name, name, active");
        const { data: clientsRows, error: clientsError } = await executeInFilter<Record<string, unknown>>(clientsQuery, "id", missingIds);

        if (!clientsError && Array.isArray(clientsRows)) {
          for (const rowAny of clientsRows) {
            const row = rowAny as Record<string, unknown>;
            const id = typeof row.id === "string" ? row.id : null;
            if (!id) continue;
            const record = ensureCompany(id, typeof row.slug === "string" ? row.slug : null);
            const name = typeof row.company_name === "string" && row.company_name.trim()
              ? row.company_name
              : typeof row.name === "string"
                ? row.name
                : record.client_slug ?? "Empresa";
            record.client_name = name;
            record.client_slug = record.client_slug ?? (typeof row.slug === "string" ? row.slug : slugifyRelease(name));
            record.client_active = row.active === true || record.client_active;
          }
        }
      }
    }
  }

  const items = Array.from(companies.values())
    .map((company) => {
      const slug = company.client_slug ?? (company.client_name ? slugifyRelease(company.client_name) : null);
      return {
        id: company.client_id ?? slug ?? "",
        name: company.client_name ?? slug ?? "Empresa",
        slug: slug ?? "",
        role: company.role,
        active: company.client_active ?? true,
      };
    })
    .filter((item) => Boolean(item.slug));

  const companiesOut = dedupeCompanies(items);

  const landingRole = decideLandingRole(companiesOut, backendRole ?? role);
  const first = companiesOut[0];
  const user = {
    id:
      typeof backendUser?.id === "string"
        ? (backendUser.id as string)
        : typeof (userRow as { id?: unknown } | null)?.id === "string"
          ? (userRow as { id: string }).id
          : authUserId,
    email: typeof backendUser?.email === "string" ? (backendUser.email as string) : authEmail,
    name: typeof backendUser?.name === "string" ? (backendUser.name as string) : displayName || null,
    role: landingRole,
    clientId: first?.id ?? clientId ?? null,
    clientSlug: first?.slug ?? null,
    defaultClientSlug: first?.slug ?? null,
    clientSlugs: companiesOut.map((company) => company.slug),
    isGlobalAdmin: backendIsGlobalAdmin || isGlobalAdmin,
  };

  return NextResponse.json({ user, companies: companiesOut });
}

export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
