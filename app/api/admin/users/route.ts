import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type RoleOption = "client_owner" | "client_manager" | "client_member" | "global_admin";

const sanitize = (value: unknown, max = 255) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }
  const store = cookies();
  return store.get("sb-access-token")?.value || store.get("auth_token")?.value || null;
}

function createSupabaseUser(token?: string | null) {
  const headers = token && token.length > 0 ? { Authorization: `Bearer ${token}` } : undefined;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: headers ? { headers } : undefined,
  });
}

function createSupabaseService() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: NextRequest) {
  if (SUPABASE_MOCK) {
    return { id: "mock-admin", email: "admin@example.com", token: "mock-token" };
  }

  const token = extractToken(req);
  if (!token) return null;

  const supabase = createSupabaseUser(token);
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

function randomPassword() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleCreate(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const name = sanitize((body as any).name);
    const email = sanitize((body as any).email);
    const clientId = sanitize((body as any).client_id);
    const roleInput = sanitize((body as any).role) as RoleOption | null;
    const jobTitle = sanitize((body as any).job_title);
    const linkedin = sanitize((body as any).linkedin_url, 500);
    const password = sanitize((body as any).password, 128);

    if (!name || !email || !clientId) {
      return NextResponse.json({ error: "Nome, email e empresa sao obrigatorios" }, { status: 400 });
    }

    const normalizedRole: RoleOption =
      roleInput && ["client_owner", "client_manager", "client_member", "global_admin"].includes(roleInput)
        ? roleInput
        : "client_member";
    const tempPassword = password || randomPassword();
    const passwordHash = createHash("sha256").update(tempPassword).digest("hex");

    const record = {
      id: randomUUID(),
      name,
      email,
      role: normalizedRole,
      client_id: clientId,
      active: true,
      password_hash: passwordHash,
      job_title: jobTitle,
      linkedin_url: linkedin,
      auth_user_id: null,
      is_global_admin: normalizedRole === "global_admin",
    };

    const supabaseService = createSupabaseService();
    const { error: insertError } = await supabaseService.from("users").insert(record);

    if (insertError) {
      const duplicate = insertError.message?.toLowerCase().includes("duplicate") || insertError.code === "23505";
      return NextResponse.json(
        { error: duplicate ? "Usuario ja existe" : "Falha ao criar usuario" },
        { status: duplicate ? 409 : 500 },
      );
    }

    return NextResponse.json(
      {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role,
        client_id: record.client_id,
        tempPassword: password ? undefined : tempPassword,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

async function handleUpdate(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });

    if (SUPABASE_MOCK) {
      const body = await req.json().catch(() => null);
      if (!body?.id) {
        return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
      }
      return NextResponse.json(
        {
          ...body,
          tempPassword: undefined,
        },
        { status: 200 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const id = sanitize((body as any).id);
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

    const name = sanitize((body as any).name);
    const email = sanitize((body as any).email);
    const clientId = sanitize((body as any).client_id);
    const roleInput = sanitize((body as any).role) as RoleOption | null;
    const jobTitle = sanitize((body as any).job_title);
    const linkedin = sanitize((body as any).linkedin_url, 500);
    const password = sanitize((body as any).password, 128);
    const active = typeof (body as any).active === "boolean" ? (body as any).active : undefined;

    const normalizedRole: RoleOption | undefined =
      roleInput && ["client_owner", "client_manager", "client_member", "global_admin"].includes(roleInput)
        ? roleInput
        : undefined;

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (clientId) updates.client_id = clientId;
    if (normalizedRole) updates.role = normalizedRole;
    if (typeof active === "boolean") updates.active = active;
    if (jobTitle !== null) updates.job_title = jobTitle;
    if (linkedin !== null) updates.linkedin_url = linkedin;
    if (password) {
      const passwordHash = createHash("sha256").update(password).digest("hex");
      updates.password_hash = passwordHash;
    }

    const supabaseService = createSupabaseService();
    const { data, error } = await supabaseService
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Falha ao atualizar usuario" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users PATCH:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");

    if (SUPABASE_MOCK) {
      const items = [
        {
          id: "mock-user-1",
          name: "Ana Mock",
          email: "ana.mock@example.com",
          role: "client_member",
          client_id: clientId ?? "mock-client",
          job_title: "QA",
          linkedin_url: "https://www.linkedin.com/in/mock",
          active: true,
        },
      ];
      return NextResponse.json({ items }, { status: 200 });
    }

    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });

    // Se faltar configuracao de service role, retorna lista vazia para nao quebrar UI
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const supabaseService = createSupabaseService();
    const query = supabaseService
      .from("users")
      .select("id,name,email,role,client_id,job_title,linkedin_url,active")
      .order("name", { ascending: true });

    if (clientId) query.eq("client_id", clientId);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao listar usuarios:", error);
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users GET:", err);
    // fallback defensivo para nao quebrar UI
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (SUPABASE_MOCK) {
    try {
      const body = await req.json().catch(() => ({} as Record<string, any>));
      const { name, email, role = "client_member", client_id, job_title, linkedin_url, password } = body ?? {};
      if (!name || !email || !client_id) {
        return NextResponse.json({ error: "Nome, email e empresa sao obrigatorios" }, { status: 400 });
      }
      const tempPassword = password || randomPassword();
      return NextResponse.json(
        {
          id: "mock-local-user-id",
          name,
          email,
          role,
          client_id,
          job_title: job_title ?? null,
          linkedin_url: linkedin_url ?? null,
          tempPassword,
          message: "Usuario criado (mock).",
        },
        { status: 201 },
      );
    } catch (err) {
      console.error("Erro mock /api/admin/users:", err);
      return NextResponse.json({ error: "Erro interno (mock)" }, { status: 500 });
    }
  }

  return handleCreate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}
