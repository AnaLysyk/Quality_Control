import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { ClientCreateRequestSchema, ClientListResponseSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { apiFail, apiOk } from "@/lib/apiResponse";

export const runtime = "nodejs";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

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
};

const MOCK_CLIENTS_FILE = path.join(process.cwd(), "data", "mock-clients.json");
const IS_TEST_ENV = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

const mockNow = () => new Date().toISOString();

const mockSeed: ClienteRow[] = [
  {
    id: "griaule",
    company_name: "Griaule",
    slug: "griaule",
    tax_id: "00.000.000/0000-00",
    address: "Rua Exemplo, 123",
    phone: "+55 11 99999-0000",
    website: "https://www.griaule.com",
    logo_url: "/images/griaule.png",
    docs_link: "https://docs.exemplo.com",
    notes: "Cliente mock para desenvolvimento",
    qase_project_code: "SFQ",
    qase_project_codes: ["SFQ"],
    active: true,
    created_at: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "testing-company",
    company_name: "Testing Company",
    slug: "testing-company",
    tax_id: "11.111.111/0001-11",
    address: "Rua Alpha, 456",
    phone: "+55 11 98888-1111",
    website: "https://www.testing-company.com",
    logo_url: "/images/testing-company.png",
    docs_link: "https://docs.testing-company.com",
    notes: "Cliente mock para comparacao",
    qase_project_code: "TST",
    qase_project_codes: ["TST"],
    active: true,
    created_at: "2026-01-13T00:00:00.000Z",
  },
];

let mockMemoryStore: ClienteRow[] = [...mockSeed];

async function readMockClients(): Promise<ClienteRow[]> {
  if (IS_TEST_ENV) return mockMemoryStore;

  try {
    const raw = await fs.readFile(MOCK_CLIENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ClienteRow[];
  } catch {
    // ignore
  }

  try {
    await fs.mkdir(path.dirname(MOCK_CLIENTS_FILE), { recursive: true });
    await fs.writeFile(MOCK_CLIENTS_FILE, JSON.stringify(mockSeed, null, 2) + "\n", "utf8");
  } catch {
    // ignore
  }

  return [...mockSeed];
}

async function writeMockClients(clients: ClienteRow[]) {
  if (IS_TEST_ENV) {
    mockMemoryStore = clients;
    return;
  }
  await fs.mkdir(path.dirname(MOCK_CLIENTS_FILE), { recursive: true });
  await fs.writeFile(MOCK_CLIENTS_FILE, JSON.stringify(clients, null, 2) + "\n", "utf8");
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(desired: string, rows: ClienteRow[]) {
  const base = toSlug(desired) || "cliente";
  const used = new Set(rows.map((r) => (r.slug ?? "").toLowerCase()).filter(Boolean));
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

const MAX_SHORT = 255;
const MAX_NOTES = 1000;

const sanitize = (value: unknown, max = MAX_SHORT) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

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
  const lower = message.toLowerCase();
  return lower.includes("column") && lower.includes("does not exist");
}

async function requireAdmin(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req, {
    mockAdmin: {
      id: "mock-uid",
      email: "ana.testing.company@gmail.com",
      token: "mock-token",
    },
  });

  return { admin, status };
}

// `requireUser` logic is no longer used in this route; authentication
// checks rely on `requireAdmin`. If future handlers need a generic user
// extractor, prefer `requireUserRecord` from `@/lib/jwtAuth`.

function mapRow(row: ClienteRow) {
  const companyName = row.company_name ?? row.name ?? "";
  return {
    id: row.id,
    name: companyName,
    company_name: companyName,
    slug: row.slug ?? null,
    tax_id: row.tax_id ?? null,
    address: row.address ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    logo_url: row.logo_url ?? null,
    docs_link: row.docs_link ?? null,
    notes: row.notes ?? null,
    qase_project_code: row.qase_project_code ?? null,
    qase_project_codes: row.qase_project_codes ?? null,
    // Never leak secret tokens in API responses.
    qase_token: null,
    jira_api_token: null,
    active: row.active ?? false,
    created_at: row.created_at ?? null,
    created_by: row.created_by ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { admin, status } = await requireAdmin(req);
    if (!admin) return jsonError(status === 401 ? "Nao autenticado" : "Sem permissao", status);

    if (SUPABASE_MOCK) {
      const rows = await readMockClients();
      const payload = ClientListResponseSchema.parse({ items: rows.map(mapRow) });
      return NextResponse.json(payload, { status: 200 });
    }

    const supabase = getSupabaseServer();
    const primary = await supabase
      .from("cliente")
      .select(
        `
        id,
        company_name,
        slug,
        tax_id,
        address,
        phone,
        website,
        logo_url,
        docs_link,
        notes,
        qase_project_code,
        qase_project_codes,
        active,
        created_at,
        created_by
      `,
      )
      .order("created_at", { ascending: true });

    if (primary.error && isUnknownColumnError(primary.error)) {
      const legacy = await supabase
        .from("cliente")
        .select(
          `
          id,
          company_name,
          slug,
          tax_id,
          address,
          phone,
          website,
          logo_url,
          docs_link,
          notes,
          qase_project_code,
          active,
          created_at,
          created_by
        `,
        )
        .order("created_at", { ascending: true });

      if (legacy.error) {
        console.error("Erro ao buscar clientes:", legacy.error);
        return jsonError("Erro ao buscar clientes", 500);
      }

      const payload = ClientListResponseSchema.parse({ items: (legacy.data ?? []).map(mapRow) });
      return NextResponse.json(payload, { status: 200 });
    }

    if (primary.error) {
      console.error("Erro ao buscar clientes:", primary.error);
      return jsonError("Erro ao buscar clientes", 500);
    }

    const payload = ClientListResponseSchema.parse({ items: (primary.data ?? []).map(mapRow) });
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado no GET /api/clients:", err);
    return jsonError("Erro interno", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { admin: auth, status } = await requireAdmin(req);
    if (!auth) {
      const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
      return apiFail(req, msg, {
        status,
        code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        extra: ErrorResponseSchema.parse({ error: msg }),
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = ClientCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const msg = "Payload invalido";
      return apiFail(req, msg, {
        status: 400,
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
        extra: ErrorResponseSchema.parse({ error: msg }),
      });
    }

    const input = parsed.data;
    const qaseProjectCodes = normalizeProjectCodes((input as any).qase_project_codes);

    if (SUPABASE_MOCK) {
      const companyName = sanitize(input.company_name || input.name);
      if (!companyName) {
        const msg = "Campo 'name' ou 'company_name' e obrigatorio";
        return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: ErrorResponseSchema.parse({ error: msg }) });
      }

      const existing = await readMockClients();
      const row: ClienteRow = {
        id: randomUUID(),
        company_name: companyName,
        name: companyName,
        slug: uniqueSlug(sanitize(input.slug) ?? companyName, existing),
        tax_id: sanitize(input.tax_id),
        address: sanitize(input.address) ?? sanitize(input.description) ?? null,
        phone: sanitize(input.phone),
        website: sanitize(input.website),
        logo_url: sanitize(input.logo_url),
        docs_link: sanitize(input.docs_link || input.docs_url),
        notes: sanitize(input.notes, MAX_NOTES),
        qase_project_code: sanitize(input.qase_project_code)?.toUpperCase() ?? null,
        qase_project_codes: qaseProjectCodes ?? null,
        active: typeof input.active === "boolean" ? input.active : true,
        created_at: mockNow(),
        created_by: auth.id,
      };

      await writeMockClients([row, ...existing]);

      const payload = ClientSchema.parse(mapRow(row));

      await addAuditLogSafe({
        actorUserId: auth.id,
        actorEmail: auth.email,
        action: "client.created",
        entityType: "client",
        entityId: payload.id,
        entityLabel: payload.name,
        metadata: { slug: payload.slug, active: payload.active },
      });
      return apiOk(req, payload, "Cliente criado", { status: 201, extra: payload });
    }

    const companyName = sanitize(input.company_name || input.name);
    const taxId = sanitize(input.tax_id);
    const address = sanitize(input.address);
    const phone = sanitize(input.phone);
    const website = sanitize(input.website);
    const logoUrl = sanitize(input.logo_url);
    const docsLink = sanitize(input.docs_link || input.docs_url);
    const notes = sanitize(input.notes, MAX_NOTES);
    const description = sanitize(input.description);
    const active = typeof input.active === "boolean" ? input.active : true;

    if (!companyName) {
      const msg = "Campo 'name' ou 'company_name' e obrigatorio";
      return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: ErrorResponseSchema.parse({ error: msg }) });
    }

    const newRow: Record<string, unknown> = {
      company_name: companyName,
      tax_id: taxId,
      address: address ?? description ?? null,
      phone,
      website,
      logo_url: logoUrl,
      docs_link: docsLink,
      notes,
      qase_project_code: sanitize(input.qase_project_code)?.toUpperCase() ?? null,
      qase_project_codes: qaseProjectCodes ?? null,
      active,
      created_by: auth.id,
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from("cliente").insert(newRow).select().maybeSingle();

    if (error) {
      console.error("Erro ao criar cliente:", error);
      const msg = "Erro ao criar cliente";
      return apiFail(req, msg, { status: 500, code: "DB_ERROR", details: error, extra: ErrorResponseSchema.parse({ error: msg }) });
    }

    const payload = ClientSchema.parse(mapRow(data as ClienteRow));

    await addAuditLogSafe({
      actorUserId: auth.id,
      actorEmail: auth.email,
      action: "client.created",
      entityType: "client",
      entityId: payload.id,
      entityLabel: payload.name,
      metadata: { slug: payload.slug, active: payload.active },
    });

    return apiOk(req, payload, "Cliente criado", { status: 201, extra: payload });
  } catch (err) {
    console.error("Erro inesperado no POST /api/clients:", err);
    const msg = "Erro interno";
    return apiFail(req, msg, { status: 500, code: "INTERNAL", details: err, extra: ErrorResponseSchema.parse({ error: msg }) });
  }
}
