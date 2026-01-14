import { NextResponse } from "next/server";
import { ErrorResponseSchema } from "@/contracts/errors";
import { slugifyRelease } from "@/lib/slugifyRelease";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const IS_TEST_ENV = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

type SupabaseServerClient = ReturnType<typeof import("@/lib/supabaseServer").getSupabaseServer>;

function jsonError(message: string, status: number) {
  return NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) return authHeader.slice(7);

  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

type MinimalAuthUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown> | null;
};

function resolveDisplayName(authUser: MinimalAuthUser): string {
  const fullName =
    typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name.trim() : "";
  if (fullName) return fullName;

  const name = typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name.trim() : "";
  if (name) return name;

  return (authUser.email ?? "").trim();
}

export async function POST(req: Request) {
  if (SUPABASE_MOCK) {
    // Keep mock mode consistent across auth endpoints.
    // In non-test environments, we still return a successful payload so the UI can proceed.
    return NextResponse.json(
      {
        ok: true,
        mocked: true,
        user: {
          authUserId: "mock-uid",
          email: null,
          role: "admin",
          clientId: null,
          clientSlug: null,
          isAdmin: true,
        },
      },
      { status: 200 }
    );
  }

  const token = extractToken(req);
  if (!token) return jsonError("Nao autorizado", 401);

  let supabaseAdmin: SupabaseServerClient;
  try {
    // require para permitir mocking no Jest quando necessário.
    const mod = require("@/lib/supabaseServer");
    supabaseAdmin = mod.getSupabaseServer();
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erro ao inicializar Supabase", 500);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) return jsonError("Nao autorizado", 401);

  const authUser: MinimalAuthUser = {
    id: authData.user.id,
    email: authData.user.email ?? null,
    user_metadata: (authData.user.user_metadata ?? null) as Record<string, unknown> | null,
  };

  const displayName = resolveDisplayName(authUser);

  // 1) Ensure public.profiles exists (keyed by auth_user_id in the real schema).
  // Do NOT overwrite existing role.
  const profileSelect = "id, full_name, role, auth_user_id, is_global_admin";

  // Prefer auth_user_id lookup (matches RLS helpers); fall back to id lookup for legacy schemas.
  let existingProfile: Record<string, unknown> | null = null;
  const { data: profileByAuth } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  existingProfile = (profileByAuth ?? null) as Record<string, unknown> | null;
  if (!existingProfile) {
    const { data: profileById } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();
    existingProfile = (profileById ?? null) as Record<string, unknown> | null;
  }

  if (!existingProfile) {
    // Default role is intentionally non-admin.
    const attempt = await supabaseAdmin.from("profiles").insert({
      auth_user_id: authUser.id,
      full_name: displayName || null,
      role: "client_user",
    });

    // Some schemas may not have role/full_name columns or may already have the row (race).
    if (attempt.error) {
      const code = (attempt.error as { code?: string } | null)?.code ?? "";
      const msg = String((attempt.error as { message?: unknown } | null)?.message ?? "");
      const isDuplicate = code === "23505" || msg.toLowerCase().includes("duplicate");
      if (!isDuplicate) {
        await supabaseAdmin.from("profiles").insert({
          auth_user_id: authUser.id,
        });
      }
    }
  } else {
    const fullName = typeof existingProfile.full_name === "string" ? existingProfile.full_name.trim() : "";
    if (!fullName && displayName) {
      const updateAttempt = await supabaseAdmin
        .from("profiles")
        .update({ full_name: displayName })
        .eq("auth_user_id", authUser.id);

      if (updateAttempt.error) {
        // Fallback for legacy schemas keyed by id.
        await supabaseAdmin
          .from("profiles")
          .update({ full_name: displayName })
          .eq("id", authUser.id);
      }
    }
  }

  // 2) RULE-MÃE: do NOT auto-create application users.
  // Users must be created + linked to a company by a Global Admin.
  // We only normalize/repair existing rows.
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, client_id, is_global_admin, auth_user_id, active")
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();

  if (!existingUser) {
    return jsonError(
      "Usuário não provisionado. Peça ao admin para criar o usuário e vinculá-lo a uma empresa.",
      403
    );
  } else {
    const updates: Record<string, unknown> = {};
    const existingName = typeof existingUser.name === "string" ? existingUser.name.trim() : "";
    const existingEmail = typeof existingUser.email === "string" ? existingUser.email.trim() : "";

    if (!existingName && displayName) updates.name = displayName;
    if (!existingEmail && authUser.email) updates.email = authUser.email;
    if (existingUser.active !== true) updates.active = true;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("auth_user_id", authUser.id);

      if (updateError) {
        // Retry without updated_at/active if the schema doesn't have those columns.
        const minimal: Record<string, unknown> = {};
        if (typeof updates.name === "string") minimal.name = updates.name;
        if (typeof updates.email === "string") minimal.email = updates.email;
        if (Object.keys(minimal).length > 0) {
          await supabaseAdmin.from("users").update(minimal).eq("auth_user_id", authUser.id);
        }
      }
    }
  }

  // 3) Return resolved access context for the frontend redirect.
  // Re-read the current rows (they may have been inserted above).
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role, client_id, is_global_admin")
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();

  const userRecord = (userRow ?? null) as Record<string, unknown> | null;

  let profileRow: Record<string, unknown> | null = null;
  const { data: profileRowByAuth } = await supabaseAdmin
    .from("profiles")
    .select("role, is_global_admin, full_name")
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  profileRow = (profileRowByAuth ?? null) as Record<string, unknown> | null;
  if (!profileRow) {
    const { data: profileRowById } = await supabaseAdmin
      .from("profiles")
      .select("role, is_global_admin, full_name")
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();
    profileRow = (profileRowById ?? null) as Record<string, unknown> | null;
  }

  const clientId = typeof userRecord?.client_id === "string" ? userRecord.client_id : null;

  const { data: globalAdminLink } = await supabaseAdmin
    .from("global_admins")
    .select("user_id")
    .eq("user_id", authUser.id)
    .limit(1)
    .maybeSingle();

  const isGlobalAdmin =
    Boolean((globalAdminLink as { user_id?: unknown } | null)?.user_id) ||
    userRecord?.is_global_admin === true ||
    profileRow?.is_global_admin === true;
  if (!isGlobalAdmin && !clientId) {
    return jsonError(
      "Sem empresa vinculada. Peça ao admin para vincular seu usuário a uma empresa.",
      403
    );
  }

  let clientSlug: string | null = null;
  if (clientId) {
    const { data: clientRow } = await supabaseAdmin
      .from("cliente")
      .select("slug, company_name, name")
      .eq("id", clientId)
      .limit(1)
      .maybeSingle();
    clientSlug = clientRow?.slug ?? null;
    if (!clientSlug && clientRow) {
      const fallback = slugifyRelease(clientRow.company_name ?? clientRow.name ?? "");
      clientSlug = fallback || null;
    }
  }

  const userRole =
    (typeof userRecord?.role === "string" && userRecord.role) ||
    (typeof profileRow?.role === "string" && profileRow.role) ||
    "client_user";

  const isAdmin =
    userRole === "admin" ||
    userRole === "global_admin" ||
    Boolean(userRecord?.is_global_admin) ||
    Boolean(profileRow?.is_global_admin);

  return NextResponse.json(
    {
      ok: true,
      user: {
        authUserId: authUser.id,
        email: authUser.email,
        role: isAdmin ? "admin" : userRole,
        clientId,
        clientSlug,
        isAdmin,
      },
    },
    { status: 200 }
  );
}
