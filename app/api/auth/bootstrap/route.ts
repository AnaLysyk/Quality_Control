import { slugifyRelease } from "@/lib/slugifyRelease";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { IS_PROD, SUPABASE_MOCK, SUPABASE_MOCK_RAW } from "@/lib/supabaseMock";

type SupabaseServerClient = ReturnType<typeof import("@/lib/supabaseServer").getSupabaseServer>;

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    const [key, ...rest] = part.split("=");
    if (key === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function isMissingColumn(error: unknown, column: string): boolean {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  const col = column.toLowerCase();
  if (message.includes(`column \"${col}\"`) && message.includes("does not exist")) return true;
  if (message.includes(`column ${col} does not exist`)) return true;
  if (message.includes(`column users.${col} does not exist`)) return true;
  if (message.includes(`'${col}' column`) && message.includes("schema cache")) return true;
  return false;
}

function isMissingTable(error: unknown, table: string): boolean {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  const tableName = table.toLowerCase();
  if (
    (message.includes(`relation \"${tableName}\"`) ||
      message.includes(`relation \"public.${tableName}\"`)) &&
    message.includes("does not exist")
  ) {
    return true;
  }
  if (message.includes("schema cache") && message.includes(`'public.${tableName}'`)) {
    return true;
  }
  if (message.includes("schema cache") && message.includes(`'${tableName}'`)) {
    return true;
  }
  return false;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) return authHeader.slice(7);

  const cookieHeader = req.headers.get("cookie") ?? "";
  const names = new Set<string>(["auth_token", "sb-access-token", "access_token"]);
  const customName = (process.env.AUTH_COOKIE_NAME ?? "").trim();
  if (customName) names.add(customName);

  for (const name of names) {
    const value = readCookieValue(cookieHeader, name);
    if (value) return value;
  }
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
  if (SUPABASE_MOCK_RAW && IS_PROD) {
    console.warn("/api/auth/bootstrap: SUPABASE_MOCK ignored in production/Vercel");
  }

  if (SUPABASE_MOCK) {
    const token = extractToken(req);
    if (!token) {
      return apiFail(req, "Nao autenticado", { status: 401, code: "NO_TOKEN", extra: { error: "Nao autorizado" } });
    }

    // Keep mock mode consistent across auth endpoints.
    // In non-test environments, we still return a successful payload so the UI can proceed.
    const payload = {
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
    };

    return apiOk(req, payload, "OK", { extra: payload });
  }

  const token = extractToken(req);
  if (!token) {
    return apiFail(req, "Nao autenticado", { status: 401, code: "NO_TOKEN", extra: { error: "Nao autorizado" } });
  }

  let supabaseAdmin: SupabaseServerClient;
  try {
    // require para permitir mocking no Jest quando necessário.
    const mod = require("@/lib/supabaseServer");
    supabaseAdmin = mod.getSupabaseServer();
  } catch (err) {
    return apiFail(req, "Erro ao inicializar Supabase", {
      status: 500,
      code: "SUPABASE_INIT",
      details: err instanceof Error ? err.message : err,
      extra: { error: err instanceof Error ? err.message : "Erro ao inicializar Supabase" },
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return apiFail(req, "Nao autenticado", {
      status: 401,
      code: "INVALID_TOKEN",
      details: authError?.message ?? null,
      extra: { error: "Nao autorizado" },
    });
  }

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
  let profilesAvailable = true;
  const { data: profileByAuth, error: profileByAuthError } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  if (profileByAuthError) {
    if (isMissingTable(profileByAuthError, "profiles")) {
      profilesAvailable = false;
    } else if (!isMissingColumn(profileByAuthError, "auth_user_id")) {
      return apiFail(req, "Erro ao buscar perfil", {
        status: 500,
        code: "PROFILE_LOOKUP_FAILED",
        details: getSupabaseErrorMessage(profileByAuthError),
        extra: { error: "Erro ao buscar perfil" },
      });
    }
  }
  existingProfile = (profileByAuth ?? null) as Record<string, unknown> | null;
  if (profilesAvailable && !existingProfile) {
    const { data: profileById, error: profileByIdError } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();
    if (profileByIdError && !isMissingTable(profileByIdError, "profiles")) {
      return apiFail(req, "Erro ao buscar perfil", {
        status: 500,
        code: "PROFILE_LOOKUP_FAILED",
        details: getSupabaseErrorMessage(profileByIdError),
        extra: { error: "Erro ao buscar perfil" },
      });
    }
    existingProfile = (profileById ?? null) as Record<string, unknown> | null;
  }

  if (profilesAvailable && !existingProfile) {
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
  } else if (profilesAvailable && existingProfile) {
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
  const baseUserSelect = "id, email, role, client_id, is_global_admin, auth_user_id";
  let existingUserResult = await supabaseAdmin
    .from("users")
    .select(`${baseUserSelect}, name, active`)
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();

  if (existingUserResult.error && (isMissingColumn(existingUserResult.error, "name") || isMissingColumn(existingUserResult.error, "active"))) {
    existingUserResult = await supabaseAdmin
      .from("users")
      .select(`${baseUserSelect}, nome, ativo`)
      .eq("auth_user_id", authUser.id)
      .limit(1)
      .maybeSingle();
  }

  const existingUser = existingUserResult.data as Record<string, unknown> | null;
  const existingUserError = existingUserResult.error;
  if (existingUserError) {
    const missingAuthColumn = isMissingColumn(existingUserError, "auth_user_id");
    return apiFail(req, "Erro ao buscar usuario", {
      status: 500,
      code: "USER_LOOKUP_FAILED",
      details: getSupabaseErrorMessage(existingUserError),
      extra: {
        error: missingAuthColumn
          ? "Schema invalido: falta coluna auth_user_id em public.users"
          : "Erro ao buscar usuario",
      },
    });
  }

  if (!existingUser) {
    return apiFail(
      req,
      "Usuario nao provisionado. Peca ao admin para criar o usuario e vincula-lo a uma empresa.",
      {
        status: 403,
        code: "USER_NOT_PROVISIONED",
        extra: {
          error: "Usuário não provisionado. Peça ao admin para criar o usuário e vinculá-lo a uma empresa.",
        },
      },
    );
  } else {
    const updates: Record<string, unknown> = {};
    const existingName =
      typeof (existingUser as { name?: unknown }).name === "string"
        ? String((existingUser as { name?: unknown }).name).trim()
        : typeof (existingUser as { nome?: unknown }).nome === "string"
          ? String((existingUser as { nome?: unknown }).nome).trim()
          : "";
    const existingEmail = typeof (existingUser as { email?: unknown }).email === "string" ? String((existingUser as { email?: unknown }).email).trim() : "";
    const isActive =
      (existingUser as { active?: unknown }).active === true ||
      (existingUser as { ativo?: unknown }).ativo === true;
    const nameKey = "name" in existingUser ? "name" : "nome";
    const activeKey = "active" in existingUser ? "active" : "ativo";

    if (!existingName && displayName) updates[nameKey] = displayName;
    if (!existingEmail && authUser.email) updates.email = authUser.email;
    if (!isActive) updates[activeKey] = true;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("auth_user_id", authUser.id);

      if (updateError) {
        console.warn("/api/auth/bootstrap: user update failed", getSupabaseErrorMessage(updateError));
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
  const { data: userRow, error: userRowError } = await supabaseAdmin
    .from("users")
    .select("role, client_id, is_global_admin")
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  if (userRowError) {
    return apiFail(req, "Erro ao buscar usuario", {
      status: 500,
      code: "USER_LOOKUP_FAILED",
      details: getSupabaseErrorMessage(userRowError),
      extra: { error: "Erro ao buscar usuario" },
    });
  }

  const userRecord = (userRow ?? null) as Record<string, unknown> | null;

  let profileRow: Record<string, unknown> | null = null;
  if (profilesAvailable) {
    const { data: profileRowByAuth, error: profileRowByAuthError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_global_admin, full_name")
      .eq("auth_user_id", authUser.id)
      .limit(1)
      .maybeSingle();
    if (profileRowByAuthError) {
      if (!isMissingColumn(profileRowByAuthError, "auth_user_id") && !isMissingTable(profileRowByAuthError, "profiles")) {
        return apiFail(req, "Erro ao buscar perfil", {
          status: 500,
          code: "PROFILE_LOOKUP_FAILED",
          details: getSupabaseErrorMessage(profileRowByAuthError),
          extra: { error: "Erro ao buscar perfil" },
        });
      }
    } else {
      profileRow = (profileRowByAuth ?? null) as Record<string, unknown> | null;
    }

    if (!profileRow) {
      const { data: profileRowById, error: profileRowByIdError } = await supabaseAdmin
        .from("profiles")
        .select("role, is_global_admin, full_name")
        .eq("id", authUser.id)
        .limit(1)
        .maybeSingle();
      if (profileRowByIdError && !isMissingTable(profileRowByIdError, "profiles")) {
        return apiFail(req, "Erro ao buscar perfil", {
          status: 500,
          code: "PROFILE_LOOKUP_FAILED",
          details: getSupabaseErrorMessage(profileRowByIdError),
          extra: { error: "Erro ao buscar perfil" },
        });
      }
      profileRow = (profileRowById ?? null) as Record<string, unknown> | null;
    }
  }

  const clientId = typeof userRecord?.client_id === "string" ? userRecord.client_id : null;

  let globalAdminLink: { user_id?: unknown } | null = null;
  const { data: globalAdminData, error: globalAdminError } = await supabaseAdmin
    .from("global_admins")
    .select("user_id")
    .eq("user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  if (globalAdminError && !isMissingTable(globalAdminError, "global_admins")) {
    return apiFail(req, "Erro ao validar admin global", {
      status: 500,
      code: "GLOBAL_ADMIN_LOOKUP_FAILED",
      details: getSupabaseErrorMessage(globalAdminError),
      extra: { error: "Erro ao validar admin global" },
    });
  }
  globalAdminLink = (globalAdminData ?? null) as { user_id?: unknown } | null;

  const isGlobalAdmin =
    Boolean((globalAdminLink as { user_id?: unknown } | null)?.user_id) ||
    userRecord?.is_global_admin === true ||
    profileRow?.is_global_admin === true;
  if (!isGlobalAdmin && !clientId) {
    return apiFail(req, "Sem empresa vinculada", {
      status: 403,
      code: "NO_COMPANY_LINK",
      extra: { error: "Sem empresa vinculada. Peça ao admin para vincular seu usuário a uma empresa." },
    });
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

  const out = {
    ok: true,
    user: {
      authUserId: authUser.id,
      email: authUser.email,
      role: isAdmin ? "admin" : userRole,
      clientId,
      clientSlug,
      isAdmin,
    },
  };
  return apiOk(req, out, "OK", { extra: out });
}
