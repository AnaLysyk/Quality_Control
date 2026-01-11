import { NextRequest, NextResponse } from "next/server";
import { listAllRequests } from "@/data/requestsStore";
import { getSessionUser } from "@/lib/session";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function requireAdmin(req: NextRequest) {
  if (SUPABASE_MOCK) {
    return { id: "mock-admin", email: "admin@example.com", name: "Admin" };
  }

  const token = extractToken(req);
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData?.user) return null;

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, is_global_admin")
    .eq("auth_user_id", authData.user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const isAdmin =
    userRow?.is_global_admin === true ||
    userRow?.role === "global_admin" ||
    userRow?.role === "admin";

  if (!isAdmin) return null;

  return {
    id: userRow?.id ?? authData.user.id,
    email: userRow?.email ?? authData.user.email ?? "",
    name: userRow?.name ?? authData.user.user_metadata?.full_name ?? "Admin",
  };
}

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || (sessionUser as any).role !== "admin") {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as any;
  const type = searchParams.get("type") as any;
  const companyId = searchParams.get("companyId") || undefined;
  const sort = (searchParams.get("sort") as any) || "createdAt_desc";

  const items = listAllRequests({ status, type, companyId, sort });

  return NextResponse.json({ items, total: items.length });
}
