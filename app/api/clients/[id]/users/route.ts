import { NextResponse } from "next/server";

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

type AccessContext = {
  authUserId: string;
  email: string;
  isGlobalAdmin: boolean;
  clientId: string | null;
  userRole: string | null;
};

async function requireAccess(req: Request): Promise<AccessContext | null> {
  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const slugCookie = (readCookieValue(cookieHeader, "mock_client_slug") ?? "").trim();
    const isAdmin = roleCookie === "admin";
    return {
      authUserId: isAdmin ? "mock-admin" : "mock-user",
      email: isAdmin ? "admin@example.com" : "user@example.com",
      isGlobalAdmin: isAdmin,
      clientId: isAdmin ? null : slugCookie || null,
      userRole: isAdmin ? "global_admin" : "client_user",
    };
  }

  const token = extractToken(req);
  if (!token) return null;

  // Use require so Jest's module mocking is honored.
  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const authUserId = authData.user.id;
  const email = authData.user.email ?? "";

  const { data: userRow } = await supabase
    .from("users")
    .select("id,role,client_id,is_global_admin,active")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();

  const { data: globalAdminLink } = await supabase
    .from("global_admins")
    .select("user_id")
    .eq("user_id", authUserId)
    .limit(1)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", authUserId)
    .maybeSingle();

  const role = typeof (userRow as { role?: unknown } | null)?.role === "string" ? ((userRow as any).role as string) : null;
  const clientId = typeof (userRow as { client_id?: unknown } | null)?.client_id === "string" ? ((userRow as any).client_id as string) : null;

  const isGlobalAdmin =
    Boolean((globalAdminLink as { user_id?: unknown } | null)?.user_id) ||
    (userRow as { is_global_admin?: unknown } | null)?.is_global_admin === true ||
    role === "global_admin" ||
    role === "admin" ||
    profileRow?.is_global_admin === true ||
    profileRow?.role === "global_admin" ||
    (() => {
      const metadata = asRecord(authData.user.app_metadata);
      return metadata?.role === "admin";
    })();

  return { authUserId, email, isGlobalAdmin, clientId, userRole: role };
}

function normalizeClientRole(input: unknown): "client_admin" | "client_user" | null {
  if (input === "ADMIN") return "client_admin";
  if (input === "USER") return "client_user";
  return null;
}

function roleToUi(role: unknown): "ADMIN" | "USER" {
  if (typeof role !== "string") return "USER";
  const r = role.toLowerCase();
  if (r === "global_admin" || r === "admin" || r === "client_admin" || r === "client_owner" || r === "client_manager") {
    return "ADMIN";
  }
  return "USER";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess(request);
  if (!access) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const clientId = id;
  if (!clientId) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: client } = await supabase.from("cliente").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  // empresa user can list only its own company; admin can list any.
  if (!access.isGlobalAdmin && access.clientId !== clientId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (all && !access.isGlobalAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const query = supabase
    .from("users")
    .select("id,name,email,role,active,client_id")
    .eq("client_id", clientId)
    .order("active", { ascending: false })
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  const { data, error } = all ? await query : await query.eq("active", true);
  if (error) {
    console.error("GET /api/clients/[id]/users error", error);
    return NextResponse.json({ message: "Erro ao carregar equipe" }, { status: 500 });
  }

  const items = (Array.isArray(data) ? data : []).map((row) => ({
    id: (row as any).id,
    name: (row as any).name ?? "",
    email: (row as any).email ?? "",
    role: roleToUi((row as any).role),
    active: (row as any).active === true,
  }));

  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess(request);
  if (!access) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!access.isGlobalAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const clientId = id;
  if (!clientId) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: client } = await supabase.from("cliente").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeClientRole(body?.role);
  if (!rawEmail || !role) return NextResponse.json({ message: "email e role são obrigatórios" }, { status: 400 });

  const { data: target } = await supabase
    .from("users")
    .select("id,email,client_id,active,role,is_global_admin")
    .ilike("email", rawEmail)
    .maybeSingle();

  if (!target) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });

  if ((target as any).is_global_admin === true || (target as any).role === "global_admin") {
    return NextResponse.json({ message: "Não é permitido vincular/alterar global admin nesta tela" }, { status: 400 });
  }

  if ((target as any).client_id === clientId && (target as any).active === true) {
    return NextResponse.json({ message: "Usuário já vinculado a este cliente" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ client_id: clientId, role, active: true })
    .eq("id", (target as any).id)
    .select("id,name,email,role,active")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("POST /api/clients/[id]/users error", updateError);
    return NextResponse.json({ message: "Erro ao vincular usuário" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: (updated as any).id,
      name: (updated as any).name ?? "",
      email: (updated as any).email ?? "",
      role: roleToUi((updated as any).role),
      active: (updated as any).active === true,
    },
    { status: 200 }
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess(request);
  if (!access) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!access.isGlobalAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const clientId = id;
  if (!clientId) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const supabaseModule = require("@/lib/supabaseServer");
  const supabase = supabaseModule.getSupabaseServer();

  const { data: client } = await supabase.from("cliente").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : undefined;
  const role = body?.role !== undefined ? normalizeClientRole(body.role) : null;
  const active = body?.active as boolean | undefined;

  if (!userId) return NextResponse.json({ message: "userId é obrigatório" }, { status: 400 });
  if (body?.role !== undefined && !role) return NextResponse.json({ message: "role inválido" }, { status: 400 });
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ message: "active inválido" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) })
    .eq("id", userId)
    .eq("client_id", clientId)
    .select("id,name,email,role,active")
    .maybeSingle();

  if (updateError || !updated) return NextResponse.json({ message: "Vínculo não encontrado" }, { status: 404 });

  return NextResponse.json({
    id: (updated as any).id,
    name: (updated as any).name ?? "",
    email: (updated as any).email ?? "",
    role: roleToUi((updated as any).role),
    active: (updated as any).active === true,
  });
}
