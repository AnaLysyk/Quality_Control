// Use dynamic import for the supabase server helper so tests that mock
// the module get the mocked exports at runtime.
import { slugifyRelease } from "@/lib/slugifyRelease";
import { AuthMeResponseSchema } from "@/contracts/auth";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

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

export async function GET(req: Request) {
  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const slugCookie = (readCookieValue(cookieHeader, "mock_client_slug") ?? "").trim();

    const isAdmin = roleCookie === "admin";
    const resolvedRole = isAdmin ? "admin" : roleCookie === "client" ? "client_admin" : "client_user";
    const clientSlug = isAdmin ? null : slugCookie || null;

    const payload = AuthMeResponseSchema.parse({
      user: {
        id: isAdmin ? "mock-admin" : "mock-user",
        email: isAdmin ? "admin@example.com" : "user@example.com",
        name: isAdmin ? "Admin Mock" : "User Mock",
        role: resolvedRole,
        client: clientSlug ? { slug: clientSlug } : null,
        clientId: clientSlug ? "mock-client" : null,
        clientSlug,
        isGlobalAdmin: isAdmin,
        is_global_admin: isAdmin,
      },
    });

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = extractToken(req);
  if (!token) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use require here so Jest's module mocking is honored reliably.
   
  const supabaseAdminModule = require("@/lib/supabaseServer");
  const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authUser = authData.user;

  // Try to read an application-level user row, but if it doesn't exist,
  // fall back to the public profile information (tests mock the
  // `profiles` table). This makes the route resilient and aligns with
  // test expectations.
  const userSelect = "id, name, email, role, client_id, is_global_admin, auth_user_id";
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select(userSelect)
    .eq("auth_user_id", authUser.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  // Load profile data (may be mocked in tests).
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("full_name, avatar_url, is_global_admin")
    .eq("id", authUser.id)
    .limit(1)
    .maybeSingle();

  if (!userRow && !profileRow) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let clientSlug: string | null = null;
  if (userRow?.client_id) {
    const { data: clientRow } = await supabaseAdmin
      .from("cliente")
      .select("slug, company_name, name")
      .eq("id", userRow.client_id)
      .limit(1)
      .maybeSingle();
    clientSlug = clientRow?.slug ?? null;
    if (!clientSlug && clientRow) {
      const fallback = slugifyRelease(clientRow.company_name ?? clientRow.name ?? "");
      clientSlug = fallback || null;
    }
  }

  const user = {
    id: userRow?.id ?? authUser.id,
    email: userRow?.email ?? authUser.email,
    name: userRow?.name ?? profileRow?.full_name ?? authUser.user_metadata?.full_name ?? "",
    avatarUrl: profileRow?.avatar_url ?? null,
    role: userRow?.role ?? (profileRow?.is_global_admin ? "global_admin" : "client_user"),
    client: clientSlug ? { slug: clientSlug } : null,
    clientId: userRow?.client_id ?? null,
    clientSlug,
    isGlobalAdmin: !!(userRow?.is_global_admin || profileRow?.is_global_admin),
  };

  const payload = AuthMeResponseSchema.parse({ user });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
