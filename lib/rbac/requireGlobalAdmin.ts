import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getSupabaseServer } from "@/lib/supabaseServer";
import { isAuthUserGlobalAdmin } from "@/lib/rbac/globalAdmin";

type AdminSession = {
  id: string;
  email: string;
  token: string;
};

async function shouldUseInternalMock(): Promise<boolean> {
  const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
  if (!SUPABASE_MOCK) return false;

  // Some tests provide their own jest mock for `@/lib/supabaseServer`.
  // In that case, avoid short-circuiting to internal mock users.
  try {
    const mod = await import("@/lib/supabaseServer");
    return !("supabaseServer" in mod);
  } catch {
    return true;
  }
}

export async function extractAccessToken(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }

  const store = await cookies();
  return store.get("sb-access-token")?.value || store.get("auth_token")?.value || null;
}

export async function requireGlobalAdmin(
  req: NextRequest,
  opts?: {
    token?: string | null;
    supabaseAdmin?: SupabaseClient;
    supabaseAuth?: SupabaseClient;
    mockAdmin?: AdminSession;
  },
): Promise<AdminSession | null> {
  const useMock = await shouldUseInternalMock();
  if (useMock) {
    return (
      opts?.mockAdmin ?? {
        id: "mock-admin",
        email: "admin@example.com",
        token: "mock-token",
      }
    );
  }

  const token = opts?.token ?? (await extractAccessToken(req));
  if (!token) return null;

  let supabaseAdmin: SupabaseClient | null = opts?.supabaseAdmin ?? null;
  try {
    supabaseAdmin = supabaseAdmin ?? getSupabaseServer();
  } catch {
    supabaseAdmin = null;
  }

  const supabaseAuth: SupabaseClient | null = opts?.supabaseAuth ?? supabaseAdmin;
  if (!supabaseAuth || !supabaseAdmin) return null;

  const { data: authData, error } = await supabaseAuth.auth.getUser(token);
  if (error || !authData?.user) return null;

  const metadata = authData.user.app_metadata;
  const metadataRole =
    metadata && typeof metadata === "object" && "role" in metadata ? (metadata as Record<string, unknown>).role : null;

  let userRow: Record<string, unknown> | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("is_global_admin,role")
      .eq("auth_user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();
    userRow = (data as Record<string, unknown> | null) ?? null;
  } catch {
    userRow = null;
  }

  let profileRow: Record<string, unknown> | null = null;
  try {
    const primary = await supabaseAdmin
      .from("profiles")
      .select("is_global_admin,role")
      .eq("id", authData.user.id)
      .maybeSingle();
    profileRow = (primary.data as Record<string, unknown> | null) ?? null;

    if (!profileRow) {
      const fallback = await supabaseAdmin
        .from("profiles")
        .select("is_global_admin,role")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      profileRow = (fallback.data as Record<string, unknown> | null) ?? null;
    }
  } catch {
    profileRow = null;
  }

  const isAdmin = await isAuthUserGlobalAdmin(supabaseAdmin, authData.user.id, {
    metadataRole,
    userRow,
    profileRow,
  });

  if (!isAdmin) return null;

  return {
    id: authData.user.id,
    email: authData.user.email ?? "",
    token,
  };
}

export type { AdminSession };
