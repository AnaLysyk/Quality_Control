import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

function roleImpliesGlobalAdmin(role: unknown): boolean {
  if (typeof role !== "string") return false;
  const value = role.trim().toLowerCase();
  return value === "global_admin" || value === "admin" || value === "system_admin";
}

function flagIsTrue(value: unknown): boolean {
  return value === true;
}

async function isInGlobalAdminsTable(supabaseAdmin: SupabaseClient, authUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("global_admins")
      .select("user_id")
      .eq("user_id", authUserId)
      .limit(1)
      .maybeSingle();

    if (error) return false;
    return Boolean((data as { user_id?: string } | null)?.user_id);
  } catch {
    return false;
  }
}

export async function isAuthUserGlobalAdmin(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
  context?: {
    userRow?: Record<string, unknown> | null;
    profileRow?: Record<string, unknown> | null;
    metadataRole?: unknown;
  },
): Promise<boolean> {
  const globalAdmins = await isInGlobalAdminsTable(supabaseAdmin, authUserId);
  if (globalAdmins) return true;

  const userRow = context?.userRow ?? null;
  const profileRow = context?.profileRow ?? null;
  const metadataRole = context?.metadataRole;

  return (
    flagIsTrue(userRow?.is_global_admin) ||
    flagIsTrue(profileRow?.is_global_admin) ||
    roleImpliesGlobalAdmin(userRow?.role) ||
    roleImpliesGlobalAdmin(profileRow?.role) ||
    roleImpliesGlobalAdmin(metadataRole)
  );
}
