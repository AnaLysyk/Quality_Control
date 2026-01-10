import { NextRequest, NextResponse } from "next/server";
import { updateRequestStatus } from "@/data/requestsStore";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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
  // Prefer session-based admin detection (tests mock `getSessionUser`).
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser && (sessionUser.role === "admin" || sessionUser.role === "global_admin")) {
      return { id: sessionUser.id ?? "session-admin", email: sessionUser.email ?? "", name: sessionUser.name ?? "Admin" };
    }
  } catch {
    // ignore and fall back to Supabase auth
  }

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

  const isAdmin = userRow?.is_global_admin === true || userRow?.role === "global_admin" || userRow?.role === "admin";
  if (!isAdmin) return null;

  return {
    id: userRow?.id ?? authData.user.id,
    email: userRow?.email ?? authData.user.email ?? "",
    name: userRow?.name ?? authData.user.user_metadata?.full_name ?? "Admin",
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body?.status as "APPROVED" | "REJECTED" | undefined;
  const reviewNote = body?.reviewNote as string | undefined;

  if (!status || (status !== "APPROVED" && status !== "REJECTED")) {
    return NextResponse.json({ message: "Status invalido" }, { status: 400 });
  }

  const reviewer = {
    id: admin.id,
    name: admin.name || "Admin",
    email: admin.email || "",
    role: "admin" as const,
    companyId: "cmp_admin",
    companyName: "Admin",
    preferences: { theme: "light" as const, language: "pt" as const },
  };

  const updated = updateRequestStatus(id, status, reviewer, reviewNote);
  if (!updated) {
    return NextResponse.json({ message: "Solicitacao nao encontrada" }, { status: 404 });
  }

  if (status === "APPROVED") {
    if (updated.type === "EMAIL_CHANGE" && typeof updated.payload?.newEmail === "string") {
      const { updateUserEmail } = await import("@/data/usersStore");
      updateUserEmail(updated.userId, updated.payload.newEmail as string);
    }
    if (updated.type === "COMPANY_CHANGE" && typeof updated.payload?.newCompanyName === "string") {
      const { updateUserCompany } = await import("@/data/usersStore");
      updateUserCompany(updated.userId, updated.payload.newCompanyName as string);
    }
  }

  return NextResponse.json(updated);
}
