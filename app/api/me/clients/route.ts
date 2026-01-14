import { NextResponse } from "next/server";
import { slugifyRelease } from "@/lib/slugifyRelease";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : "";
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
    null
  );
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

export async function GET(request: Request) {
  if (SUPABASE_MOCK) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const slugCookie = (readCookieValue(cookieHeader, "mock_client_slug") ?? "").trim();
    const isAdmin = roleCookie === "admin";

    if (isAdmin) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    if (!slugCookie) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json(
      {
        items: [
          {
            client_id: "mock-client",
            client_name: slugCookie,
            client_slug: slugCookie,
            client_active: true,
            role: "USER",
            link_active: true,
          },
        ],
      },
      { status: 200 }
    );
  }

  const token = extractToken(request);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Use require so Jest's module mocking is honored.
  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authUserId = authData.user.id;

  const { data: globalAdminLink } = await supabase
    .from("global_admins")
    .select("user_id")
    .eq("user_id", authUserId)
    .limit(1)
    .maybeSingle();

  const { data: userRow } = await supabase
    .from("users")
    .select("role,client_id,is_global_admin,active")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", authUserId)
    .maybeSingle();

  const rawRole = typeof (userRow as { role?: unknown } | null)?.role === "string" ? ((userRow as any).role as string) : null;
  const role = rawRole ? rawRole.toLowerCase() : null;
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

  if (isGlobalAdmin) {
    // Admin global não precisa de vínculo explícito para operar.
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const clientId = typeof (userRow as { client_id?: unknown } | null)?.client_id === "string" ? ((userRow as any).client_id as string) : null;
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
    await collectLinks("user_id", (userRow as any).id as string);
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
        client_id: company.client_id ?? slug ?? "",
        client_name: company.client_name ?? slug ?? "Empresa",
        client_slug: slug,
        client_active: company.client_active ?? true,
        role: company.role,
        link_active: company.link_active,
      };
    })
    .filter((item) => Boolean(item.client_slug));

  return NextResponse.json({ items }, { status: 200 });
}
