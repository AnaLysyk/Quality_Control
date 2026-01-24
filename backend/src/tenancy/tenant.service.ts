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
    type UserRow = {
      id?: string | null;
      is_global_admin?: boolean | null;
    };
    type CompanyUserRow = {
      company_id?: string | null;
      role?: string | null;
      ativo?: boolean | null;
      created_at?: string | null;
    };

    const { data: userRow, error: userError } = await client
      .from("users")
      .select("id,is_global_admin")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      this.logger.debug("Unable to read users row for tenant resolution", userError);
    }

    let linkRows: CompanyUserRow[] = [];
    const { data: linksByUser, error: linksError } = await client
      .from("company_users")
      .select("company_id,role,ativo,created_at")
      .eq("user_id", userId)
      .eq("ativo", true);

    if (linksError) {
      this.logger.debug("Unable to read company_users for tenant resolution", linksError);
    }

    if (Array.isArray(linksByUser)) {
      linkRows = linksByUser as CompanyUserRow[];
    }

    const primaryLink = linkRows.length ? linkRows[0] : null;

    const rawRole = typeof primaryLink?.role === "string" ? primaryLink.role : null;

    let role = rawRole ? rawRole.toLowerCase() : null;

    const companyId = typeof primaryLink?.company_id === "string" ? primaryLink.company_id : null;
    const clientSlug = null;

    const isGlobalAdmin = userRow?.is_global_admin === true || role === "global_admin" || role === "admin";

    if (isGlobalAdmin && !role) {
      role = "global_admin";
    }

    return {
      companyId,
      clientSlug,
      isGlobalAdmin,
      role,
    };
  }
}
