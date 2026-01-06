import { getSupabaseAdmin } from "@/lib/supabase/server";
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
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authUser = authData.user;
  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const userSelect = "id, name, email, role, client_id, is_global_admin, auth_user_id";

  let userRow: any = null;
  const { data: userByAuth } = await supabaseAdmin
    .from("users")
    .select(userSelect)
    .eq("auth_user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  userRow = userByAuth ?? null;

  if (!userRow && normalizedEmail) {
    const { data: userByEmail } = await supabaseAdmin
      .from("users")
      .select(userSelect)
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();
    userRow = userByEmail ?? null;
  }

  if (userRow && normalizedEmail) {
    const rowEmail = (userRow.email ?? "").trim().toLowerCase();
    if (rowEmail && rowEmail === normalizedEmail && userRow.auth_user_id !== authUser.id) {
      const { data: updated } = await supabaseAdmin
        .from("users")
        .update({ auth_user_id: authUser.id })
        .eq("id", userRow.id)
        .select(userSelect)
        .limit(1)
        .maybeSingle();
      if (updated) userRow = updated;
    }
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

  const user = userRow
    ? {
        id: userRow.id,
        email: userRow.email ?? authUser.email,
        name: userRow.name ?? authUser.user_metadata?.full_name ?? "",
        role: userRow.role ?? (userRow.is_global_admin ? "global_admin" : "client_user"),
        client: clientSlug ? { slug: clientSlug } : null,


        clientId: userRow.client_id ?? null,
        clientSlug,
        isGlobalAdmin: !!userRow.is_global_admin,
      }
    : {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.full_name ?? "",
        role: "client_user",
        clientId: null,
        clientSlug: null,
        isGlobalAdmin: false,
      };

  const payload = AuthMeResponseSchema.parse({ user });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
