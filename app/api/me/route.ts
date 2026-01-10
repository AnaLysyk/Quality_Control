import { supabaseServer as _supabaseServer, getSupabaseServer } from "@/lib/supabaseServer";
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

  // Prefer session-based auth when tests mock `@/lib/supabaseServer` or when
  // the environment provides a supabase admin client. Try to use the mocked
  // module if present so tests controlling `supabaseServer.auth.getUser` work.
  let supabaseAdmin: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@/lib/supabaseServer");
    supabaseAdmin = mod.supabaseServer ?? (mod.getSupabaseServer ? mod.getSupabaseServer() : null);
  } catch {
    supabaseAdmin = (typeof getSupabaseServer === "function" ? getSupabaseServer() : _supabaseServer) as any;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token).catch((e: any) => ({ data: null, error: e }));
  if (authError || !authData?.user) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authUser = authData.user;

  // First try to read profile record (tests mock `profiles` table)
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("full_name, avatar_url, is_global_admin, role, client_id")
    .eq("id", authUser.id)
    .limit(1)
    .maybeSingle();

  if (!profileRow) {
    const payload = AuthMeResponseSchema.parse({ user: null });
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let clientSlug: string | null = null;
  if (profileRow?.client_id) {
    const { data: clientRow } = await supabaseAdmin
      .from("cliente")
      .select("slug, company_name, name")
      .eq("id", profileRow.client_id)
      .limit(1)
      .maybeSingle();
    clientSlug = clientRow?.slug ?? null;
    if (!clientSlug && clientRow) {
      const fallback = slugifyRelease(clientRow.company_name ?? clientRow.name ?? "");
      clientSlug = fallback || null;
    }
  }

  const user = {
    id: profileRow.id ?? authUser.id,
    email: profileRow.email ?? authUser.email,
    name: profileRow.full_name ?? authUser.user_metadata?.full_name ?? "",
    role: profileRow.role ?? (profileRow.is_global_admin ? "global_admin" : "client_user"),
    client: clientSlug ? { slug: clientSlug } : null,
    clientId: profileRow.client_id ?? null,
    clientSlug,
    isGlobalAdmin: !!profileRow.is_global_admin,
    avatarUrl: profileRow.avatar_url ?? null,
  } as any;

  const payload = AuthMeResponseSchema.parse({ user });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
