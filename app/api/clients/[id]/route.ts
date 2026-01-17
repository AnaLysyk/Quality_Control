import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { addAuditLogSafe } from "@/data/auditLogRepository";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type ClienteRow = {
  id: string;
  company_name?: string | null;
  name?: string | null;
  slug?: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  docs_link?: string | null;
  notes?: string | null;
  qase_project_code?: string | null;
  qase_project_codes?: string[] | null;
  active?: boolean | null;
  created_at?: string | null;
  created_by?: string | null;
  description?: string | null;
  integration_mode?: string | null;
  qase_token?: string | null;
  jira_base_url?: string | null;
  jira_email?: string | null;
  jira_api_token?: string | null;
};

const MOCK_CLIENTS_FILE = path.join(process.cwd(), "data", "mock-clients.json");
const IS_TEST_ENV = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

let mockMemoryStore: ClienteRow[] | null = null;

async function readMockClients(): Promise<ClienteRow[]> {
  if (IS_TEST_ENV && mockMemoryStore) return mockMemoryStore;

  try {
    const raw = await fs.readFile(MOCK_CLIENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (IS_TEST_ENV) mockMemoryStore = parsed as ClienteRow[];
      return parsed as ClienteRow[];
    }
  } catch {
    // ignore
  }

  if (IS_TEST_ENV) mockMemoryStore = [];
  return [];
}

async function writeMockClients(clients: ClienteRow[]) {
  if (IS_TEST_ENV) {
    mockMemoryStore = clients;
    return;
  }
  await fs.mkdir(path.dirname(MOCK_CLIENTS_FILE), { recursive: true });
  await fs.writeFile(MOCK_CLIENTS_FILE, JSON.stringify(clients, null, 2) + "\n", "utf8");
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }

  // Browser fetches typically rely on cookies (credentials: include).
  // In unit tests, handlers may receive a plain `Request` without `req.cookies`.
  const cookieStore = (req as unknown as { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies;
  if (cookieStore?.get) {
    return cookieStore.get("sb-access-token")?.value || cookieStore.get("auth_token")?.value || null;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)(sb-access-token|auth_token)=([^;]+)/);
  return match?.[2] ? decodeURIComponent(match[2]) : null;
}

type AuthUser = { id: string; email: string | null; is_global_admin?: boolean };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeProjectCodes(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalize = (code: string) => code.trim().toUpperCase();

  if (Array.isArray(value)) {
    const arr = value
      .filter((item): item is string => typeof item === "string")
      .map(normalize)
      .filter(Boolean);
    return arr.length ? Array.from(new Set(arr)) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const arr = trimmed
      .split(/[\s,;|]+/g)
      .map(normalize)
      .filter(Boolean);
    return arr.length ? Array.from(new Set(arr)) : null;
  }

  return undefined;
}

function isUnknownColumnError(error: unknown) {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string") return false;
  return message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist");
}

function isMissingRelationError(error: unknown) {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string") return false;
  return message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist");
}

async function selectClientById(supabase: ReturnType<typeof getSupabaseServer>, id: string) {
  const primary = await supabase.from("cliente").select("*").eq("id", id).maybeSingle();
  if (!primary.error && primary.data) return primary;
  if (primary.error && !isMissingRelationError(primary.error)) return primary;
  const fallback = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return fallback.data ? fallback : primary;
}

async function getAuthUser(req: Request): Promise<AuthUser | null> {
  if (SUPABASE_MOCK) {
    return {
      id: "mock-uid",
      email: "ana.testing.company@gmail.com",
      is_global_admin: true,
    };
  }

  const token = extractToken(req as NextRequest);
  if (!token) return null;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

async function isGlobalAdmin(userId: string, isMockUser: boolean) {
  if (SUPABASE_MOCK && isMockUser) return true;
  const supabaseServer = getSupabaseServer();

  const { data: globalAdminLink } = await supabaseServer
    .from("global_admins")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (globalAdminLink?.user_id) return true;

  const { data: userRow } = await supabaseServer
    .from("users")
    .select("is_global_admin,role")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const normalizedRole = typeof userRow?.role === "string" ? userRow.role.toLowerCase() : null;
  if (userRow?.is_global_admin === true || normalizedRole === "global_admin" || normalizedRole === "admin") {
    return true;
  }

  const { data } = await supabaseServer
    .from("profiles")
    .select("is_global_admin")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  return !!data?.is_global_admin;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = await isGlobalAdmin(user.id, !!user.is_global_admin);
  if (!admin) return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

  // Mock: usa o mesmo store de data/mock-clients.json
  if (SUPABASE_MOCK) {
    const rows = await readMockClients();
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });

    const companyName = row.company_name ?? row.name ?? "";

    const mock = {
      id: row.id,
      name: companyName,
      slug: row.slug ?? slugifyRelease(companyName),
      description: row.description ?? row.address ?? null,
      website: row.website ?? null,
      phone: row.phone ?? null,
      logo_url: row.logo_url ?? null,
      active: row.active ?? true,
      created_at: row.created_at ?? null,
      created_by: row.created_by ?? null,
      tax_id: row.tax_id ?? null,
      address: row.address ?? null,
      qase_project_code: row.qase_project_code ?? null,
      qase_project_codes: row.qase_project_codes ?? null,
      docs_link: row.docs_link ?? null,
      notes: row.notes ?? null,
    };

    return NextResponse.json(mock, { status: 200 });
  }

  const supabaseServer = getSupabaseServer();
  const { data, error } = await selectClientById(supabaseServer, id);
  if (error) {
    console.error("Erro ao buscar cliente:", error);
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });

  const client = {
    id: data.id,
    name: data.company_name ?? data.name ?? "",
    slug: slugifyRelease(data.company_name ?? data.name ?? ""),
    description: data.description ?? data.address ?? null,
    website: data.website ?? null,
    phone: data.phone ?? null,
    logo_url: data.logo_url ?? null,
    active: data.active ?? true,
    created_at: data.created_at,
    created_by: data.created_by ?? null,
    tax_id: data.tax_id ?? null,
    address: data.address ?? null,
    qase_project_code: (() => {
      const rec = asRecord(data);
      return typeof rec?.qase_project_code === "string" ? rec.qase_project_code : null;
    })(),
    qase_project_codes: (() => {
      const rec = asRecord(data);
      const value = rec?.qase_project_codes;
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
      if (typeof value === "string") return normalizeProjectCodes(value) ?? null;
      return null;
    })(),
    integration_mode: (() => {
      const rec = asRecord(data);
      const mode = rec?.integration_mode;
      return mode === "qase" || mode === "manual" ? mode : null;
    })(),
    docs_link: (() => {
      const rec = asRecord(data);
      return typeof rec?.docs_link === "string" ? rec.docs_link : null;
    })(),
    notes: (() => {
      const rec = asRecord(data);
      return typeof rec?.notes === "string" ? rec.notes : null;
    })(),
  };

  return NextResponse.json(client, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = await isGlobalAdmin(user.id, !!user.is_global_admin);
  if (!admin) return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

  // Mock PATCH
  if (SUPABASE_MOCK) {
    const payload = (await req.json().catch(() => null)) as unknown;
    const record = asRecord(payload) ?? {};

    const rows = await readMockClients();
    const idx = rows.findIndex((r) => String(r.id) === String(id));
    if (idx < 0) return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });

    const existing = rows[idx] ?? ({ id } as ClienteRow);
    const nextCompanyName = typeof record.company_name === "string" ? record.company_name : typeof record.name === "string" ? record.name : existing.company_name ?? existing.name;

    const nextQaseProjectCode = normalizeNullableString(record.qase_project_code);
    const nextQaseProjectCodes = normalizeProjectCodes(record.qase_project_codes);

    const updated: ClienteRow = {
      ...existing,
      company_name: typeof nextCompanyName === "string" ? nextCompanyName : existing.company_name ?? existing.name ?? null,
      name: typeof nextCompanyName === "string" ? nextCompanyName : existing.name ?? existing.company_name ?? null,
      tax_id: typeof record.tax_id === "string" ? record.tax_id : existing.tax_id ?? null,
      address: typeof record.address === "string" ? record.address : typeof record.description === "string" ? record.description : existing.address ?? null,
      phone: typeof record.phone === "string" ? record.phone : existing.phone ?? null,
      website: typeof record.website === "string" ? record.website : existing.website ?? null,
      logo_url: typeof record.logo_url === "string" ? record.logo_url : existing.logo_url ?? null,
      docs_link: typeof record.docs_link === "string" ? record.docs_link : existing.docs_link ?? null,
      notes: typeof record.notes === "string" ? record.notes : existing.notes ?? null,
      active: typeof record.active === "boolean" ? record.active : existing.active ?? true,
      qase_project_code: nextQaseProjectCode !== undefined ? nextQaseProjectCode : existing.qase_project_code ?? null,
      qase_project_codes: nextQaseProjectCodes !== undefined ? nextQaseProjectCodes : existing.qase_project_codes ?? null,
    };

    const nextRows = [...rows];
    nextRows[idx] = updated;
    await writeMockClients(nextRows);

    const merged = {
      id: updated.id,
      name: updated.company_name ?? updated.name ?? "",
      slug: updated.slug ?? slugifyRelease(updated.company_name ?? updated.name ?? ""),
      description: updated.description ?? updated.address ?? null,
      website: updated.website ?? null,
      phone: updated.phone ?? null,
      logo_url: updated.logo_url ?? null,
      tax_id: updated.tax_id ?? null,
      address: updated.address ?? null,
      active: updated.active ?? true,
      docs_link: updated.docs_link ?? null,
      notes: updated.notes ?? null,
      qase_project_code: updated.qase_project_code ?? null,
      qase_project_codes: updated.qase_project_codes ?? null,
    };
    await addAuditLogSafe({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "client.updated",
      entityType: "client",
      entityId: merged.id,
      entityLabel: merged.name,
      metadata: { updates: Object.keys(record) },
    });
    return NextResponse.json(merged, { status: 200 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (payload.name) updates.company_name = payload.name;
  if (payload.company_name) updates.company_name = payload.company_name;
  if (payload.tax_id !== undefined) updates.tax_id = payload.tax_id;
  if (payload.address !== undefined) updates.address = payload.address;
  if (payload.phone !== undefined) updates.phone = payload.phone;
  if (payload.website !== undefined) updates.website = payload.website;
  if (payload.logo_url !== undefined) updates.logo_url = payload.logo_url;
  if (payload.docs_link !== undefined) updates.docs_link = payload.docs_link;
  if (payload.notes !== undefined) updates.notes = payload.notes;
  {
    const nextQaseProjectCode = normalizeNullableString(payload.qase_project_code);
    if (nextQaseProjectCode !== undefined) updates.qase_project_code = nextQaseProjectCode;
  }
  {
    const nextQaseProjectCodes = normalizeProjectCodes(payload.qase_project_codes);
    if (nextQaseProjectCodes !== undefined) updates.qase_project_codes = nextQaseProjectCodes;
  }
  if (payload.integration_mode === "qase" || payload.integration_mode === "manual") {
    updates.integration_mode = payload.integration_mode;
  }
  if (payload.description !== undefined && updates.address === undefined) {
    updates.address = payload.description;
  }
  if (typeof payload.active === "boolean") updates.active = payload.active;
  {
    const nextQaseToken = normalizeNullableString(payload.qase_token);
    if (nextQaseToken !== undefined) updates.qase_token = nextQaseToken;
  }
  {
    const nextJiraBaseUrl = normalizeNullableString(payload.jira_base_url);
    if (nextJiraBaseUrl !== undefined) updates.jira_base_url = nextJiraBaseUrl;
    const nextJiraEmail = normalizeNullableString(payload.jira_email);
    if (nextJiraEmail !== undefined) updates.jira_email = nextJiraEmail;
    const nextJiraApiToken = normalizeNullableString(payload.jira_api_token);
    if (nextJiraApiToken !== undefined) updates.jira_api_token = nextJiraApiToken;
  }
  const supabaseServer = getSupabaseServer();
  let result = await supabaseServer.from("cliente").update(updates).eq("id", id).select().maybeSingle();
  if ((result.error && isMissingRelationError(result.error)) || (!result.error && !result.data)) {
    const fallback = await supabaseServer.from("clients").update(updates).eq("id", id).select().maybeSingle();
    if (fallback.data || isMissingRelationError(result.error)) {
      result = fallback;
    }
  }
  if (result.error && isUnknownColumnError(result.error)) {
    const retryUpdates: Record<string, unknown> = { ...updates };
    delete retryUpdates.qase_project_code;
    delete retryUpdates.qase_project_codes;
    delete retryUpdates.qase_token;
    delete retryUpdates.integration_mode;
    delete retryUpdates.jira_base_url;
    delete retryUpdates.jira_email;
    delete retryUpdates.jira_api_token;
    let retry = await supabaseServer.from("cliente").update(retryUpdates).eq("id", id).select().maybeSingle();
    if ((retry.error && isMissingRelationError(retry.error)) || (!retry.error && !retry.data)) {
      const fallback = await supabaseServer.from("clients").update(retryUpdates).eq("id", id).select().maybeSingle();
      if (fallback.data || isMissingRelationError(retry.error)) {
        retry = fallback;
      }
    }
    result = retry;
  }

  const { data, error } = result;

  if (error) {
    console.error("Erro ao atualizar cliente:", error);
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });

  await addAuditLogSafe({
    actorUserId: user.id,
    actorEmail: user.email,
    action: "client.updated",
    entityType: "client",
    entityId: String(data.id),
    entityLabel: String(data.company_name ?? data.name ?? data.id),
    metadata: { updates: Object.keys(updates) },
  });

  return NextResponse.json(
    {
      id: data.id,
      name: data.company_name ?? data.name ?? "",
      slug: slugifyRelease(data.company_name ?? data.name ?? ""),
      description: data.description ?? data.address ?? null,
      website: data.website ?? null,
      phone: data.phone ?? null,
      logo_url: data.logo_url ?? null,
      tax_id: data.tax_id ?? null,
      address: data.address ?? null,
      active: data.active ?? true,
      created_at: data.created_at,
      created_by: data.created_by ?? null,
      qase_project_code: (() => {
        const rec = asRecord(data);
        return typeof rec?.qase_project_code === "string" ? rec.qase_project_code : null;
      })(),
      qase_project_codes: (() => {
        const rec = asRecord(data);
        const value = rec?.qase_project_codes;
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
        if (typeof value === "string") return normalizeProjectCodes(value) ?? null;
        return null;
      })(),
      integration_mode: (() => {
        const rec = asRecord(data);
        const mode = rec?.integration_mode;
        return mode === "qase" || mode === "manual" ? mode : null;
      })(),
      docs_link: (() => {
        const rec = asRecord(data);
        return typeof rec?.docs_link === "string" ? rec.docs_link : null;
      })(),
      notes: (() => {
        const rec = asRecord(data);
        return typeof rec?.notes === "string" ? rec.notes : null;
      })(),
      jira_base_url: (() => {
        const rec = asRecord(data);
        return typeof rec?.jira_base_url === "string" ? rec.jira_base_url : null;
      })(),
      jira_email: (() => {
        const rec = asRecord(data);
        return typeof rec?.jira_email === "string" ? rec.jira_email : null;
      })(),
    },
    { status: 200 },
  );
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = await isGlobalAdmin(user.id, !!user.is_global_admin);
  if (!admin) return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

  if (SUPABASE_MOCK) {
    if (id !== "mock-client") return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const supabaseServer = getSupabaseServer();
  const deletePrimary = await supabaseServer.from("cliente").delete().eq("id", id);
  if (deletePrimary.error && !isMissingRelationError(deletePrimary.error)) {
    console.error("Erro ao deletar cliente:", deletePrimary.error);
    return NextResponse.json({ error: "Erro ao deletar cliente" }, { status: 500 });
  }
  if (deletePrimary.error && isMissingRelationError(deletePrimary.error)) {
    const fallback = await supabaseServer.from("clients").delete().eq("id", id);
    if (fallback.error && !isMissingRelationError(fallback.error)) {
      console.error("Erro fallback ao deletar cliente:", fallback.error);
      return NextResponse.json({ error: "Erro ao deletar cliente" }, { status: 500 });
    }
  }

  await addAuditLogSafe({
    actorUserId: user.id,
    actorEmail: user.email,
    action: "client.deleted",
    entityType: "client",
    entityId: id,
    entityLabel: id,
    metadata: { reason: "removido pelo admin" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
