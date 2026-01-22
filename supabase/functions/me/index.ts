type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type UserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  client_id?: string | null;
  is_global_admin?: boolean | null;
  active?: boolean | null;
};

type CompanyLink = {
  id: string;
  slug: string | null;
  name: string;
  active: boolean | null;
  role: string | null;
};

export {};

const denoEnvGet = (key: string): string | undefined => {
  const deno = (globalThis as any).Deno;
  return deno?.env?.get?.(key);
};

const SUPABASE_URL = denoEnvGet("SUPABASE_URL") || denoEnvGet("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = denoEnvGet("SUPABASE_ANON_KEY") || denoEnvGet("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return { res, data };
  }
  const data = await res.text().catch(() => null);
  return { res, data };
}

function isSchemaMismatch(res: Response, payload: unknown): boolean {
  if (res.status === 404) return true;
  const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const msg = typeof rec?.message === "string" ? rec?.message?.toLowerCase() : "";
  const details = typeof rec?.details === "string" ? rec?.details?.toLowerCase() : "";
  return (
    msg.includes("relation") ||
    msg.includes("schema cache") ||
    msg.includes("column") ||
    details.includes("does not exist") ||
    details.includes("column")
  );
}

function buildFilterParam(filters: string[]): string {
  if (!filters.length) return "";
  if (filters.length === 1) return `&${filters[0]}`;
  return `&or=(${filters.join(",")})`;
}

async function fetchLinkRows(params: {
  token: string;
  table: string;
  select: string;
  filters: string[];
  requireActive: boolean;
}): Promise<{ rows: Array<Record<string, unknown>>; ok: boolean; mismatch: boolean }> {
  const activeParam = params.requireActive ? "&active=eq.true" : "";
  const url = `${REST_BASE}/${params.table}?select=${params.select}${activeParam}${buildFilterParam(params.filters)}`;
  const { res, data } = await fetchJson(url, { headers: authHeaders(params.token) });
  if (!res.ok) {
    return { rows: [], ok: false, mismatch: isSchemaMismatch(res, data) };
  }
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  return { rows, ok: true, mismatch: false };
}

async function fetchCompanyRows(params: {
  token: string;
  table: string;
  filter: string;
}): Promise<{ rows: Array<Record<string, unknown>>; ok: boolean; mismatch: boolean }> {
  const url = `${REST_BASE}/${params.table}?select=id,slug,name,company_name,title,active&${params.filter}`;
  const { res, data } = await fetchJson(url, { headers: authHeaders(params.token) });
  if (!res.ok) {
    return { rows: [], ok: false, mismatch: isSchemaMismatch(res, data) };
  }
  const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  return { rows, ok: true, mismatch: false };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY!,
  };
}

async function fetchAuthUser(token: string): Promise<SupabaseAuthUser | null> {
  const { res, data } = await fetchJson(`${AUTH_BASE}/user`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return null;
  const user = data as SupabaseAuthUser | null;
  return user?.id ? user : null;
}

async function fetchUserRow(token: string, authUserId: string): Promise<UserRow | null> {
  const url = `${REST_BASE}/users?select=id,name,email,role,client_id,is_global_admin,active&auth_user_id=eq.${encodeURIComponent(
    authUserId,
  )}&limit=1`;
  const { res, data } = await fetchJson(url, { headers: authHeaders(token) });
  if (!res.ok) return null;
  const rows = Array.isArray(data) ? (data as UserRow[]) : [];
  return rows[0] ?? null;
}

function getStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function normalizeCompanyName(row: Record<string, unknown>): string {
  const companyName =
    (typeof row.company_name === "string" && row.company_name) ||
    (typeof row.name === "string" && row.name) ||
    (typeof row.title === "string" && row.title) ||
    (typeof row.slug === "string" && row.slug) ||
    "";
  return companyName || "Company";
}

async function fetchCompaniesFromCompanyUsers(
  token: string,
  authUserId: string,
  appUserId: string | null,
): Promise<CompanyLink[] | null> {
  const filters: string[] = [];
  filters.push(`auth_user_id.eq.${encodeURIComponent(authUserId)}`);
  if (appUserId) filters.push(`user_id.eq.${encodeURIComponent(appUserId)}`);

  const filterVariants: string[][] = [];
  if (appUserId) filterVariants.push(filters);
  filterVariants.push([`auth_user_id.eq.${encodeURIComponent(authUserId)}`]);
  if (appUserId) filterVariants.push([`user_id.eq.${encodeURIComponent(appUserId)}`]);

  let linkRows: Array<Record<string, unknown>> | null = null;
  let sawMismatch = false;

  for (const requireActive of [true, false]) {
    for (const currentFilters of filterVariants) {
      const result = await fetchLinkRows({
        token,
        table: "company_users",
        select: "company_id,role,active",
        filters: currentFilters,
        requireActive,
      });
      if (result.ok) {
        linkRows = result.rows;
        break;
      }
      if (result.mismatch) {
        sawMismatch = true;
        continue;
      }
      return [];
    }
    if (linkRows) break;
  }

  if (!linkRows) {
    return sawMismatch ? null : [];
  }
  const companyIds = linkRows
    .map((row) => (typeof row.company_id === "string" ? row.company_id : null))
    .filter((id): id is string => Boolean(id));
  if (!companyIds.length) return [];

  const companyFilter = `id=in.(${companyIds.map((id) => encodeURIComponent(id)).join(",")})`;
  const { rows: companyRows, ok: companyOk, mismatch: companyMismatch } = await fetchCompanyRows({
    token,
    table: "companies",
    filter: companyFilter,
  });
  if (!companyOk) {
    if (companyMismatch) {
      return linkRows.map((link) => ({
        id: String(link.company_id ?? ""),
        slug: null,
        name: "Company",
        active: null,
        role: typeof link.role === "string" ? (link.role as string) : null,
      }));
    }
    return [];
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of companyRows) {
    const id = getStringField(row, "id");
    if (id) byId.set(id, row);
  }

  return linkRows.map((link) => {
    const companyId = String(link.company_id ?? "");
    const companyRow = byId.get(companyId) ?? {};
    return {
      id: companyId,
      slug: typeof companyRow.slug === "string" ? (companyRow.slug as string) : null,
      name: normalizeCompanyName(companyRow),
      active: typeof companyRow.active === "boolean" ? (companyRow.active as boolean) : null,
      role: typeof link.role === "string" ? (link.role as string) : null,
    };
  });
}

async function fetchCompaniesFromUserClients(
  token: string,
  authUserId: string,
  appUserId: string | null,
): Promise<CompanyLink[]> {
  const filters: string[] = [];
  filters.push(`auth_user_id.eq.${encodeURIComponent(authUserId)}`);
  if (appUserId) filters.push(`user_id.eq.${encodeURIComponent(appUserId)}`);

  const filterVariants: string[][] = [];
  if (appUserId) filterVariants.push(filters);
  filterVariants.push([`auth_user_id.eq.${encodeURIComponent(authUserId)}`]);
  if (appUserId) filterVariants.push([`user_id.eq.${encodeURIComponent(appUserId)}`]);

  let linkRows: Array<Record<string, unknown>> = [];
  let found = false;

  for (const requireActive of [true, false]) {
    for (const currentFilters of filterVariants) {
      const result = await fetchLinkRows({
        token,
        table: "user_clients",
        select: "client_id,client_slug,role,active",
        filters: currentFilters,
        requireActive,
      });
      if (result.ok) {
        linkRows = result.rows;
        found = true;
        break;
      }
      if (result.mismatch) {
        continue;
      }
      return [];
    }
    if (found) break;
  }

  if (!found) return [];
  const clientIds = linkRows
    .map((row) => (typeof row.client_id === "string" ? row.client_id : null))
    .filter((id): id is string => Boolean(id));
  const clientSlugs = linkRows
    .map((row) => (typeof row.client_slug === "string" ? row.client_slug : null))
    .filter((slug): slug is string => Boolean(slug));

  const companies: Record<string, Record<string, unknown>> = {};

  if (clientIds.length) {
    const filter = `id=in.(${clientIds.map((id) => encodeURIComponent(id)).join(",")})`;
    const { rows: clienteRows, ok: clienteOk, mismatch: clienteMismatch } = await fetchCompanyRows({
      token,
      table: "cliente",
      filter,
    });
    if (!clienteOk && clienteMismatch) {
      const { rows: clientsRows, ok: clientsOk } = await fetchCompanyRows({
        token,
        table: "clients",
        filter,
      });
      if (clientsOk) {
        for (const row of clientsRows) {
          const id = getStringField(row, "id");
          if (id) companies[id] = row;
        }
      }
    } else if (clienteOk) {
      for (const row of clienteRows) {
        const id = getStringField(row, "id");
        if (id) companies[id] = row;
      }
    }
  }

  if (!clientIds.length && clientSlugs.length) {
    const filter = `slug=in.(${clientSlugs.map((slug) => encodeURIComponent(slug)).join(",")})`;
    const { rows: clienteRows, ok: clienteOk, mismatch: clienteMismatch } = await fetchCompanyRows({
      token,
      table: "cliente",
      filter,
    });
    if (!clienteOk && clienteMismatch) {
      const { rows: clientsRows, ok: clientsOk } = await fetchCompanyRows({
        token,
        table: "clients",
        filter,
      });
      if (clientsOk) {
        for (const row of clientsRows) {
          const id = getStringField(row, "id");
          if (id) companies[id] = row;
        }
      }
    } else if (clienteOk) {
      for (const row of clienteRows) {
        const id = getStringField(row, "id");
        if (id) companies[id] = row;
      }
    }
  }

  return linkRows.map((link) => {
    const id = typeof link.client_id === "string" ? link.client_id : "";
    const companyRow = companies[id] ?? {};
    const slug = typeof link.client_slug === "string" ? link.client_slug : null;
    return {
      id: id || (typeof companyRow.id === "string" ? (companyRow.id as string) : ""),
      slug: typeof companyRow.slug === "string" ? (companyRow.slug as string) : slug,
      name: normalizeCompanyName(companyRow),
      active: typeof companyRow.active === "boolean" ? (companyRow.active as boolean) : null,
      role: typeof link.role === "string" ? (link.role as string) : null,
    };
  });
}

const serve = (globalThis as any).Deno?.serve as ((handler: (req: Request) => Response | Promise<Response>) => void) | undefined;
if (!serve) {
  throw new Error("Deno.serve is not available in this runtime");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "Metodo nao permitido" }, 405);
  }

  const token = getBearerToken(req);
  if (!token) return jsonResponse({ error: "Nao autorizado" }, 401);

  const authUser = await fetchAuthUser(token);
  if (!authUser) return jsonResponse({ error: "Nao autorizado" }, 401);

  const userRow = await fetchUserRow(token, authUser.id);
  const appUserId = userRow?.id ?? null;

  const companiesFromCompanyUsers = await fetchCompaniesFromCompanyUsers(token, authUser.id, appUserId);
  const companies =
    companiesFromCompanyUsers === null
      ? await fetchCompaniesFromUserClients(token, authUser.id, appUserId)
      : companiesFromCompanyUsers;

  return jsonResponse(
    {
      user: {
        id: authUser.id,
        email: authUser.email ?? null,
        app_user_id: appUserId,
        name: userRow?.name ?? null,
        role: userRow?.role ?? null,
        client_id: userRow?.client_id ?? null,
        is_global_admin: userRow?.is_global_admin ?? null,
        active: userRow?.active ?? null,
      },
      companies,
    },
    200,
  );
});
