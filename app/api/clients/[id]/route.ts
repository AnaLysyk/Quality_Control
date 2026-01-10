import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as _supabaseServer, getSupabaseServer } from "@/lib/supabaseServer";
import { slugifyRelease } from "@/lib/slugifyRelease";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

type AuthUser = { id: string; email: string | null; is_global_admin?: boolean };

async function getAuthUser(req: Request): Promise<AuthUser | null> {
  if (SUPABASE_MOCK) {
    return {
      id: "mock-uid",
      email: "ana.testing.company@gmail.com",
      is_global_admin: true,
    };
  }

  const token = getBearerToken(req);
  if (!token) return null;
  let supabaseServer: any = null;
  try {
    // prefer mocked module when tests replace it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@/lib/supabaseServer");
    supabaseServer = mod.supabaseServer ?? (mod.getSupabaseServer ? mod.getSupabaseServer() : null);
  } catch {
    supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  }
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

async function isGlobalAdmin(userId: string, isMockUser: boolean) {
  if (SUPABASE_MOCK && isMockUser) return true;
  const supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await isGlobalAdmin(user.id, !!user.is_global_admin);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

  // Mock: retorna um unico cliente se o ID for conhecido
  if (SUPABASE_MOCK) {
    if (id !== "mock-client") {
      return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });
    }
    const now = new Date().toISOString();
    const mock = {
      id: "mock-client",
      name: "Griaule",
      slug: "griaule",
      description: "Cliente mock Griaule",
      website: "https://www.griaule.com",
      phone: "+55 11 99999-0000",
      logo_url: "/images/griaule.png",
      active: true,
      created_at: now,
    };
    return NextResponse.json(mock, { status: 200 });
  }

  let supabaseServer: any = null;
  try {
    // prefer mocked module when tests replace it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@/lib/supabaseServer");
    supabaseServer = mod.supabaseServer ?? (mod.getSupabaseServer ? mod.getSupabaseServer() : null);
  } catch {
    supabaseServer = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  }

  // Try both table names
  let result: { data: any; error: any } | null = null;
  try {
    result = await supabaseServer.from("clients").select("*").eq("id", id).maybeSingle();
  } catch (e) {
    // fallthrough
  }
  if (!result || !result.data) {
    result = await supabaseServer.from("cliente").select("*").eq("id", id).maybeSingle();
  }
  const { data, error } = result ?? { data: null, error: null };
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
    docs_link: (data as any).docs_link ?? null,
    notes: (data as any).notes ?? null,
  };

  return NextResponse.json(client, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await isGlobalAdmin(user.id, !!user.is_global_admin);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

  // Mock PATCH
  if (SUPABASE_MOCK) {
    if (id !== "mock-client") return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });
    const payload = await req.json().catch(() => ({}));
    const merged = {
      id: "mock-client",
      name: payload?.name ?? "Griaule",
      slug: "griaule",
      description: payload?.description ?? "Cliente mock Griaule",
      website: payload?.website ?? "https://www.griaule.com",
      phone: payload?.phone ?? "+55 11 99999-0000",
      logo_url: payload?.logo_url ?? "/images/griaule.png",
      tax_id: payload?.tax_id ?? "00.000.000/0000-00",
      address: payload?.address ?? "Rua Exemplo, 123",
      active: payload?.active ?? true,
      docs_link: payload?.docs_link ?? null,
      notes: payload?.notes ?? null,
    };
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
  if (payload.description !== undefined && updates.address === undefined) {
    updates.address = payload.description;
  }
  if (typeof payload.active === "boolean") updates.active = payload.active;

  let supabaseServer2: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@/lib/supabaseServer");
    supabaseServer2 = mod.supabaseServer ?? (mod.getSupabaseServer ? mod.getSupabaseServer() : null);
  } catch {
    supabaseServer2 = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  }

  // Try update on both table names
  let updateResult: { data: any; error: any } | null = null;
  try {
    updateResult = await supabaseServer2.from("clients").update(updates).eq("id", id).select().maybeSingle();
  } catch {
    // fallthrough
  }
  if (!updateResult || !updateResult.data) {
    updateResult = await supabaseServer2.from("cliente").update(updates).eq("id", id).select().maybeSingle();
  }

  const { data, error } = updateResult ?? { data: null, error: null };

  if (error) {
    console.error("Erro ao atualizar cliente:", error);
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Cliente nao encontrado" }, { status: 404 });

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
      docs_link: (data as any).docs_link ?? null,
      notes: (data as any).notes ?? null,
    },
    { status: 200 },
  );
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(req as any, ctx as any);
}
