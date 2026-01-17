import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export type TenantContext = {
  companyId: string | null;
  clientSlug: string | null;
  isGlobalAdmin: boolean;
  role: string | null;
};

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async resolve(userId: string): Promise<TenantContext> {
    const client = this.supabase.supabase;
    const isGlobalAdminRow = await client
      .from("global_admins")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: userRow, error: userError } = await client
      .from("users")
      .select("client_id,role,is_global_admin")
      .eq("auth_user_id", userId)
      .eq("active", true)
      .maybeSingle();

    if (userError) {
      this.logger.debug("Unable to read users row for tenant resolution", userError);
    }

    const { data: profileRow, error: profileError } = await client
      .from("profiles")
      .select("is_global_admin,role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      this.logger.debug("Unable to read profiles row for tenant resolution", profileError);
    }

    const rawRole =
      typeof userRow?.role === "string"
        ? userRow.role
        : typeof profileRow?.role === "string"
          ? profileRow.role
          : null;

    const role = rawRole ? rawRole.toLowerCase() : null;

    let companyId = typeof userRow?.client_id === "string" ? userRow.client_id : null;
    if (!companyId) {
      const { data: linkRows } = await client
        .from("user_clients")
        .select("client_id")
        .eq("auth_user_id", userId)
        .eq("active", true);
      if (Array.isArray(linkRows)) {
        for (const row of linkRows) {
          const candidate = typeof row?.client_id === "string" ? row.client_id : null;
          if (candidate) {
            companyId = candidate;
            break;
          }
        }
      }
    }

    let clientSlug: string | null = null;
    if (companyId) {
      const { data: clientRow, error: clientError } = await client
        .from("cliente")
        .select("slug")
        .eq("id", companyId)
        .maybeSingle();
      if (!clientError && clientRow?.slug) {
        clientSlug = clientRow.slug;
      }
    }

    const isGlobalAdmin =
      Boolean(isGlobalAdminRow?.data?.user_id) ||
      userRow?.is_global_admin === true ||
      profileRow?.is_global_admin === true ||
      role === "global_admin" ||
      role === "admin";

    return {
      companyId,
      clientSlug,
      isGlobalAdmin,
      role,
    };
  }
}
