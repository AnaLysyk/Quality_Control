import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export type QaseIntegrationSettings = {
  token: string | null;
  projectCode: string | null;
  projectCodes: string[];
};

@Injectable()
export class CompanyIntegrationService {
  private readonly logger = new Logger(CompanyIntegrationService.name);
  private readonly MAX_PROJECTS = 16;

  constructor(private readonly supabase: SupabaseService) {}

  async getSettings(companyId: string): Promise<QaseIntegrationSettings | null> {
    try {
      const { data, error } = await this.supabase.supabase
        .from("company_integrations")
        .select(
          "qase_token,access_token,token,api_token,qase_project_code,project_code,project_codes"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        this.logger.debug("Unable to fetch company integrations", error);
        return null;
      }
      if (!data) return null;

      const token = this.pickToken(data);
      const projectCode = this.normalizeProjectCode(data.qase_project_code ?? data.project_code);
      const projectCodes = this.normalizeProjectCodes([
        data.qase_project_code,
        data.project_code,
        data.project_codes,
      ]);

      return {
        token,
        projectCode,
        projectCodes,
      };
    } catch (error) {
      this.logger.error("Failed to load company integrations", error);
      return null;
    }
  }

  private pickToken(row: Record<string, unknown>): string | null {
    const candidates = [
      row.qase_token,
      row.token,
      row.access_token,
      row.api_token,
    ];
    for (const value of candidates) {
      const normalized = this.normalizeString(value);
      if (normalized) return normalized;
    }
    return null;
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeProjectCode(value: unknown): string | null {
    const normalized = this.normalizeString(value);
    if (!normalized) return null;
    return normalized.toUpperCase();
  }

  private normalizeProjectCodes(values: unknown[]): string[] {
    const set = new Set<string>();
    for (const value of values) {
      if (Array.isArray(value)) {
        value.forEach((item) => this.addProjectCode(set, item));
        continue;
      }
      if (typeof value === "string" && value.includes(",")) {
        value.split(/[,;|]+/).forEach((item) => this.addProjectCode(set, item));
        continue;
      }
      this.addProjectCode(set, value);
    }
    return Array.from(set).slice(0, this.MAX_PROJECTS);
  }

  private addProjectCode(set: Set<string>, value: unknown) {
    const code = this.normalizeProjectCode(value);
    if (code) {
      set.add(code);
    }
  }
}
