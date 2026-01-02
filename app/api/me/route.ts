import { supabaseAdmin } from "@/lib/supabase/server";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

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
    return new Response(
      JSON.stringify({
        user: {
          id: "mock-uid",
          email: "ana.testing.company@gmail.com",
          name: "Ana Admin",
          role: "admin",
          clientId: null,
          clientSlug: null,
          isGlobalAdmin: true,
          is_global_admin: true,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = extractToken(req);
  if (!token) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authUser = authData.user;
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, client_id, is_global_admin, auth_user_id")
    .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
    .limit(1)
    .maybeSingle();

  let clientSlug: string | null = null;
  if (userRow?.client_id) {
    const { data: clientRow } = await supabaseAdmin
      .from("cliente")
      .select("slug")
      .eq("id", userRow.client_id)
      .limit(1)
      .maybeSingle();
    clientSlug = clientRow?.slug ?? null;
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

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
