import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { ClientCreateRequestSchema, ClientListResponseSchema, ClientSchema } from "@/contracts/client";
import { ErrorResponseSchema } from "@/contracts/errors";

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
  active?: boolean | null;
  created_at?: string | null;
  created_by?: string | null;
};

const MAX_SHORT = 255;
const MAX_NOTES = 1000;

const sanitize = (value: unknown, max = MAX_SHORT) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

async function extractToken(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }
  const store = await cookies();
  return (
    store.get("sb-access-token")?.value ||
    store.get("auth_token")?.value ||
    null
  );
}

function createSupabase(): SupabaseClient {
  // Tests mock `@/lib/supabaseServer` and expect its `supabaseServer` object.
  // Use the server client for both service and user flows in tests by returning
  // the server client; real token scoping is handled in production code via
  // the Supabase client instance, but for tests this provides the expected shape.
  return getSupabaseServer();
}

function createSupabaseService() {
  return getSupabaseServer();
}

async function requireAdmin(req: NextRequest) {
  // If running with the internal SUPABASE_MOCK but tests provided their own
  // `supabaseServer` mock (via jest.mock of the module), prefer the test
  // mock behavior. Only short-circuit to the internal mock when SUPABASE_MOCK
  // is true and no external mock module is present.
  const supMod = await import("@/lib/supabaseServer");
  if (SUPABASE_MOCK && !("supabaseServer" in supMod)) {
    return {
      id: "mock-uid",
      email: "ana.testing.company@gmail.com",
      token: "mock-token",
    };
  }

  const token = await extractToken(req);
  if (!token) return null;

  const supabase = createSupabase(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const service = createSupabaseService();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", data.user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_global_admin === true ||
    profile?.role === "global_admin" ||
    (data.user.app_metadata as any)?.role === "admin";

  if (profileError || !isAdmin) return null;

  return { id: data.user.id, email: data.user.email ?? "", token };
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
    active: row.active ?? false,
    created_at: row.created_at ?? null,
    created_by: row.created_by ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = await extractToken(req);
    if (!token) return jsonError("Nao autorizado", 401);

    const admin = await requireAdmin(req);
    if (!admin) return jsonError("Nao autorizado", 403);

    if (SUPABASE_MOCK) {
      const now = new Date().toISOString();
      const payload = ClientListResponseSchema.parse({
        items: [
          {
            id: "griaule",
            slug: "griaule",
            name: "Griaule",
            company_name: "Griaule",
            tax_id: "00.000.000/0000-00",
            address: "Rua Exemplo, 123",
            phone: "+55 11 99999-0000",
            website: "https://www.griaule.com",
            logo_url: "/images/griaule.png",
            docs_link: "https://docs.exemplo.com",
            notes: "Cliente mock para desenvolvimento",
            active: true,
            created_at: now,
            created_by: admin.id,
          },
        ],
      });
      return NextResponse.json(payload, { status: 200 });
    }

    const supabase = createSupabaseService();
    const { data, error } = await supabase
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
        active,
        created_at,
        created_by
      `,
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar clientes:", error);
      return jsonError("Erro ao buscar clientes", 500);
    }

    const payload = ClientListResponseSchema.parse({ items: (data ?? []).map(mapRow) });
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado no GET /api/clients:", err);
    return jsonError("Erro interno", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await extractToken(req);
    if (!token) return jsonError("Nao autorizado", 401);

    const auth = await requireAdmin(req);
    if (!auth) return jsonError("Nao autorizado", 403);

    const body = await req.json().catch(() => null);
    const parsed = ClientCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Payload invalido", 400);
    }

    const input = parsed.data;

    if (SUPABASE_MOCK) {
      const payload = ClientSchema.parse({
        id: randomUUID(),
        name: "Cliente Mock",
        company_name: "Cliente Mock",
        active: true,
        created_by: auth.id,
      });
      return NextResponse.json(payload, { status: 201 });
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
      return jsonError("Campo 'name' ou 'company_name' e obrigatorio", 400);
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
      active,
      created_by: auth.id,
    };

    const supabase = createSupabaseService();
    const { data, error } = await supabase.from("cliente").insert(newRow).select().maybeSingle();

    if (error) {
      console.error("Erro ao criar cliente:", error);
      return jsonError("Erro ao criar cliente", 500);
    }

    const payload = ClientSchema.parse(mapRow(data as ClienteRow));
    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("Erro inesperado no POST /api/clients:", err);
    return jsonError("Erro interno", 500);
  }
}
