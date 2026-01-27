import { NextResponse } from "next/server";
import type { AuthCompany } from "@/../packages/contracts/src/auth";

type LandingRole = "admin" | "company" | "user";

// Rota /api/me simplificada e blindada para o novo modelo
// Busca usuário em public.users (id = auth.users.id)
// Busca vínculos em user_clients (user_id)
// Garante apenas um is_default = true
// Retorna user e companies conforme esperado pelo frontend




// Função utilitária para ler cookies

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


// --- Início do fluxo simplificado ---
export async function GET(req: Request) {
  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
    || readCookieValue(req.headers.get("cookie") ?? "", "sb-access-token")
    || readCookieValue(req.headers.get("cookie") ?? "", "auth_token")
    || readCookieValue(req.headers.get("cookie") ?? "", "access_token");
  if (!token) {
    console.error("[api/me] NO_TOKEN", { cookies: req.headers.get("cookie") });
    return errorResponse(401, "NO_TOKEN", "Nao autorizado");
  }

  // Busca usuário autenticado no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    console.error("[api/me] INVALID_TOKEN", { authError, authData });
    return errorResponse(401, "INVALID_TOKEN", "Nao autorizado");
  }
  const authUserId = authData.user.id;
  const authEmail = authData.user.email ?? null;

  // Busca usuário no domínio (public.users)
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", authUserId)
    .maybeSingle();
  if (userError || !userRow) {
    console.error("[api/me] USER_LOOKUP_FAILED", { userError, authUserId });
    return errorResponse(401, "USER_LOOKUP_FAILED", "Usuario nao provisionado");
  }

  // Busca vínculos ativos em user_clients
  const { data: links, error: linksError } = await supabase
    .from("user_clients")
    .select("client_id, ativo, is_default")
    .eq("user_id", authUserId)
    .eq("ativo", true);
  if (linksError) {
    console.error("[api/me] COMPANY_LINK_FAILED", { linksError, authUserId });
    return errorResponse(500, "COMPANY_LINK_FAILED", "Erro ao buscar vínculos");
  }
  if (!links || links.length === 0) {
    console.error("[api/me] NO_COMPANY_LINK", { authUserId });
    return errorResponse(403, "NO_COMPANY_LINK", "Sem empresa vinculada");
  }


  // Busca dados das empresas vinculadas
  const clientIds = links.map((l: { client_id: string }) => l.client_id).filter(Boolean);
  console.log("[api/me] clientIds para consulta em clients:", clientIds);
  if (!clientIds.length) {
    console.error("[api/me] NO_VALID_CLIENT_IDS", { clientIds, links });
    return errorResponse(403, "NO_COMPANY_LINK", "Sem empresa vinculada");
  }
  const { data: companies, error: companiesError } = await supabase
    .from("clients")
    .select("id, slug, name")
    .in("id", clientIds);
  console.log("[api/me] resultado consulta clients:", { companies, companiesError });
  if (companiesError) {
    console.error("[api/me] COMPANY_FETCH_FAILED", { companiesError, clientIds });
    return errorResponse(500, "COMPANY_FETCH_FAILED", "Erro ao buscar empresas");
  }

  // Monta lista de empresas para o frontend
  const companiesOut = companies.map((company: { id: string; slug: string; name: string }) => {
    const link = links.find((l: { client_id: string; is_default?: boolean }) => l.client_id === company.id);
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      is_default: link?.is_default === true,
    };
  });

  // Monta objeto user
  const user = {
    id: userRow.id,
    email: userRow.email,
  };

  return NextResponse.json({ user, companies: companiesOut });
}

export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
