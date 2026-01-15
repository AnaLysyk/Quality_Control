// Use dynamic import for the supabase server helper so tests that mock
// the module get the mocked exports at runtime.
import { slugifyRelease } from "@/lib/slugifyRelease";
import { AuthMeResponseSchema } from "@/contracts/auth";
import { isAuthUserGlobalAdmin } from "@/lib/rbac/globalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";
import fs from "fs/promises";
import path from "path";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

const MOCK_PROFILE_STORE_PATH = path.join(process.cwd(), "data", "mock-user-profile.json");

type MockUserProfile = {
  name?: string;
  phone?: string;
};

async function ensureMockProfileStore() {
  await fs.mkdir(path.dirname(MOCK_PROFILE_STORE_PATH), { recursive: true });
  try {
    await fs.access(MOCK_PROFILE_STORE_PATH);
  } catch {
    await fs.writeFile(MOCK_PROFILE_STORE_PATH, JSON.stringify({}), "utf8");
  }
}

async function readMockProfileStore(): Promise<Record<string, MockUserProfile>> {
  await ensureMockProfileStore();
  try {
    const raw = await fs.readFile(MOCK_PROFILE_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MockUserProfile>) : {};
  } catch {
    return {};
  }
}

async function writeMockProfileStore(store: Record<string, MockUserProfile>) {
  await ensureMockProfileStore();
  await fs.writeFile(MOCK_PROFILE_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeProfileInput(body: unknown): { name?: string; phone?: string } {
  const record = (body ?? null) as Record<string, unknown> | null;

  const rawName = typeof record?.name === "string" ? record.name.trim() : "";
  const rawPhone = typeof record?.phone === "string" ? record.phone.trim() : "";

  const name = rawName ? rawName.slice(0, 120) : undefined;
  const phone = rawPhone ? rawPhone.slice(0, 40) : undefined;

  return { name, phone };
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
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function GET(req: Request) {
  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const slugCookie = (readCookieValue(cookieHeader, "mock_client_slug") ?? "").trim();

    const isAdmin = roleCookie === "admin";
    const resolvedRole = isAdmin ? "admin" : roleCookie === "client" ? "client_admin" : "client_user";
    const clientSlug = isAdmin ? null : slugCookie || null;

    const userId = isAdmin ? "mock-admin" : "mock-user";
    const store = await readMockProfileStore();
    const profile = store[userId] ?? {};
    const fallbackName = isAdmin ? "Admin Mock" : "User Mock";

    const payload = AuthMeResponseSchema.parse({
      user: {
        id: userId,
        email: isAdmin ? "admin@example.com" : "user@example.com",
        name: profile.name ?? fallbackName,
        phone: profile.phone ?? null,
        role: resolvedRole,
        client: clientSlug ? { slug: clientSlug } : null,
        clientId: clientSlug ? "mock-client" : null,
        clientSlug,
        isGlobalAdmin: isAdmin,
        is_global_admin: isAdmin,
      },
    });

    return apiOk(req, payload, "OK", { extra: payload });
  }

  const token = extractToken(req);
  if (!token) {
    const payload = AuthMeResponseSchema.parse({
      user: null,
      error: { code: "NO_TOKEN" },
    });
    return apiFail(req, "Nao autenticado", { status: 401, code: "NO_TOKEN", extra: payload });
  }

  // Use require here so Jest's module mocking is honored reliably.
   
  const supabaseAdminModule = require("@/lib/supabaseServer");
  const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    const payload = AuthMeResponseSchema.parse({
      user: null,
      error: { code: "INVALID_TOKEN" },
    });
    return apiFail(req, "Nao autenticado", { status: 401, code: "INVALID_TOKEN", extra: payload });
  }

  const authUser = authData.user;

  // Try to read an application-level user row, but if it doesn't exist,
  // fall back to the public profile information (tests mock the
  // `profiles` table). This makes the route resilient and aligns with
  // test expectations.
  const userSelectWithPhone = "id, name, email, role, phone, client_id, is_global_admin, auth_user_id";
  const userSelectLegacy = "id, name, email, role, client_id, is_global_admin, auth_user_id";

  const userQuery = supabaseAdmin
    .from("users")
    .select(userSelectWithPhone)
    .eq("auth_user_id", authUser.id)
    .eq("active", true)
    .limit(1);

  let userRow: unknown = null;
  const { data: userRowWithPhone, error: userRowWithPhoneError } = await userQuery.maybeSingle();
  if (!userRowWithPhoneError) {
    userRow = userRowWithPhone;
  } else {
    // Some environments may not have `users.phone` yet. Fall back to the legacy select.
    const { data: legacyRow } = await supabaseAdmin
      .from("users")
      .select(userSelectLegacy)
      .eq("auth_user_id", authUser.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    userRow = legacyRow ?? null;
  }

  // Load profile data (may be mocked in tests).
  // Prefer auth_user_id lookup (matches RLS helpers); fall back to id for legacy schemas.
  let profileRow: Record<string, unknown> | null = null;
  const { data: profileByAuth } = await supabaseAdmin
    .from("profiles")
    .select("full_name, avatar_url, is_global_admin, phone, role")
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  profileRow = (profileByAuth ?? null) as Record<string, unknown> | null;
  if (!profileRow) {
    const { data: profileById } = await supabaseAdmin
      .from("profiles")
      .select("full_name, avatar_url, is_global_admin, phone, role")
      .eq("id", authUser.id)
      .limit(1)
      .maybeSingle();
    profileRow = (profileById ?? null) as Record<string, unknown> | null;
  }

  if (!userRow && !profileRow) {
    const payload = AuthMeResponseSchema.parse({
      user: null,
      error: { code: "NEEDS_BOOTSTRAP" },
    });
    return apiFail(req, "Precisa inicializar", { status: 401, code: "NEEDS_BOOTSTRAP", extra: payload });
  }

  const userRecord = (userRow ?? null) as Record<string, unknown> | null;

  const isGlobalAdmin = await isAuthUserGlobalAdmin(supabaseAdmin, authUser.id, {
    userRow: userRecord,
    profileRow,
  });

  const slugCandidates = new Map<string, number>();
  const registerSlug = (slug: string | null, priority: number) => {
    if (!slug) return;
    const current = slugCandidates.get(slug);
    if (current === undefined || priority < current) slugCandidates.set(slug, priority);
  };

  const registerPotentialSlug = (value: unknown, priority: number) => {
    const normalized = normalizeSlug(value);
    if (normalized) registerSlug(normalized, priority);
  };

  const registerNameDerivedSlug = (value: unknown, priority: number) => {
    if (typeof value !== "string") return;
    const fallback = slugifyRelease(value);
    if (fallback) registerSlug(fallback, priority);
  };

  registerPotentialSlug(userRecord?.client_slug, 10);
  registerNameDerivedSlug(userRecord?.cliente, 40);

  const clientIds = new Set<string>();
  const registerClientId = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) clientIds.add(trimmed);
  };

  registerClientId(userRecord?.client_id);

  let clientSlug: string | null = null;
  const clientId = typeof userRecord?.client_id === "string" ? userRecord.client_id : null;
  if (clientId) {
    registerClientId(clientId);
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
    registerPotentialSlug(clientSlug, 5);
  }

  const user = {
    id: (typeof userRecord?.id === "string" && userRecord.id) ? userRecord.id : authUser.id,
    email:
      (typeof userRecord?.email === "string" && userRecord.email) ? userRecord.email : authUser.email,
    name:
      (typeof userRecord?.name === "string" && userRecord.name)
        ? userRecord.name
        : profileRow?.full_name ?? authUser.user_metadata?.full_name ?? "",
    avatarUrl: profileRow?.avatar_url ?? null,
    phone: (() => {
      if (typeof userRecord?.phone === "string" && userRecord.phone.trim()) return userRecord.phone;
      const profileRecord = (profileRow ?? null) as Record<string, unknown> | null;
      return typeof profileRecord?.phone === "string" && profileRecord.phone.trim() ? profileRecord.phone : null;
    })(),
    role:
      (typeof userRecord?.role === "string" && userRecord.role)
        ? userRecord.role
        : (typeof profileRow?.role === "string" && profileRow.role)
          ? profileRow.role
          : (isGlobalAdmin ? "global_admin" : "client_user"),
      client: null as { slug: string } | null,
    clientId: typeof userRecord?.client_id === "string" ? userRecord.client_id : null,
      clientSlug: null as string | null,
      clientSlugs: [] as string[],
      defaultClientSlug: null as string | null,
    isGlobalAdmin,
    is_global_admin: isGlobalAdmin,
  };

    if (userRecord?.id) {
      const { data: linkRows, error: linkError } = await supabaseAdmin
        .from("user_clients")
        .select("client_id, client_slug, active")
        .eq("user_id", userRecord.id)
        .eq("active", true);

      if (!linkError && Array.isArray(linkRows)) {
        for (const linkAny of linkRows) {
          const link = linkAny as Record<string, unknown>;
          registerPotentialSlug(link.client_slug, 6);
          registerClientId(link.client_id);
        }
      }
    }

    if (!clientIds.size) {
      const { data: linkRowsByAuth, error: linkErrorByAuth } = await supabaseAdmin
        .from("user_clients")
        .select("client_id, client_slug, active")
        .eq("auth_user_id", authUser.id)
        .eq("active", true);

      if (!linkErrorByAuth && Array.isArray(linkRowsByAuth)) {
        for (const linkAny of linkRowsByAuth) {
          const link = linkAny as Record<string, unknown>;
          registerPotentialSlug(link.client_slug, 7);
          registerClientId(link.client_id);
        }
      }
    }

    if (clientIds.size) {
      const ids = Array.from(clientIds);
      const { data: clienteRows, error: clienteError } = await supabaseAdmin
        .from("cliente")
        .select("id, slug, company_name, name")
        .in("id", ids);

      if (!clienteError && Array.isArray(clienteRows)) {
        for (const rowAny of clienteRows) {
          const row = rowAny as Record<string, unknown>;
          registerPotentialSlug(row.slug, 3);
          registerNameDerivedSlug(row.company_name, 23);
          registerNameDerivedSlug(row.name, 24);
        }
      }

      if (!slugCandidates.size) {
        const { data: clientsRows, error: clientsError } = await supabaseAdmin
          .from("clients")
          .select("id, slug, company_name, name")
          .in("id", ids);

        if (!clientsError && Array.isArray(clientsRows)) {
          for (const rowAny of clientsRows) {
            const row = rowAny as Record<string, unknown>;
            registerPotentialSlug(row.slug, 8);
            registerNameDerivedSlug(row.company_name, 28);
            registerNameDerivedSlug(row.name, 29);
          }
        }
      }
    }

    const clientSlugs = Array.from(slugCandidates.entries())
      .sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([slug]) => slug);

    const resolvedClientSlug = (() => {
      if (clientSlug && clientSlugs.includes(clientSlug)) return clientSlug;
      if (clientSlugs.length) return clientSlugs[0];
      return clientSlug;
    })();

    user.client = resolvedClientSlug ? { slug: resolvedClientSlug } : null;
    user.clientSlug = resolvedClientSlug ?? null;
    user.defaultClientSlug = resolvedClientSlug ?? null;
    user.clientSlugs = clientSlugs;

    // REGRA-MÃE: ninguém acessa sem empresa.
    // If the user is not a global admin and we cannot resolve any company linkage,
    // block access (even if a profile exists).
    if (!user.isGlobalAdmin && !user.clientSlug) {
      const payload = AuthMeResponseSchema.parse({
        user: null,
        error: {
          code: "NO_COMPANY_LINK",
          message: "Sem empresa vinculada. Peça ao admin para vincular seu usuário a uma empresa.",
        },
      });

      return apiFail(req, "Sem empresa vinculada", { status: 403, code: "NO_COMPANY_LINK", extra: payload });
    }

  const payload = AuthMeResponseSchema.parse({ user });
  return apiOk(req, payload, "OK", { extra: payload });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const { name, phone } = normalizeProfileInput(body);

  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const isAdmin = roleCookie === "admin";
    const userId = isAdmin ? "mock-admin" : "mock-user";

    const store = await readMockProfileStore();
    store[userId] = {
      ...(store[userId] ?? {}),
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
    };
    await writeMockProfileStore(store);

    // Return the updated user payload.
    return GET(req);
  }

  const token = extractToken(req);
  if (!token) {
    return apiFail(req, "Nao autenticado", { status: 401, code: "NO_TOKEN", extra: { error: "Nao autorizado" } });
  }

  // Use require here so Jest's module mocking is honored reliably.
  const supabaseAdminModule = require("@/lib/supabaseServer");
  const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return apiFail(req, "Nao autenticado", {
      status: 401,
      code: "INVALID_TOKEN",
      extra: { error: "Nao autorizado" },
      details: authError?.message ?? null,
    });
  }

  const authUser = authData.user;

  // Update app-level user row when present.
  if (name || phone) {
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    // Ignore update errors so the route works even if some columns don't exist in a given environment.
    await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("auth_user_id", authUser.id)
      .eq("active", true);
  }

  // Keep public profile in sync (prefer auth_user_id; fall back to id).
  if (name || phone) {
    const updates: Record<string, unknown> = {};
    if (name) updates.full_name = name;
    if (phone) updates.phone = phone;
    updates.updated_at = new Date().toISOString();

    const byAuth = await supabaseAdmin.from("profiles").update(updates).eq("auth_user_id", authUser.id);
    if (byAuth.error) {
      // Fallback to legacy schema keyed by id.
      const byId = await supabaseAdmin.from("profiles").update(updates).eq("id", authUser.id);
      if (byId.error) {
        // As a last resort, try insert (id likely has default).
        await supabaseAdmin.from("profiles").insert({ auth_user_id: authUser.id, ...updates });
      }
    }
  }

  return GET(req);
}
