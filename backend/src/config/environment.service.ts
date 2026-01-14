import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class EnvironmentService {
  private readonly env = process.env;
  private readonly logger = new Logger(EnvironmentService.name);

  private pickEnv(keys: string | string[]): string | null {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const value = this.env[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private getOptional(keys: string | string[], fallback: string | null = null): string | null {
    const value = this.pickEnv(keys);
    return value ?? (fallback !== null ? fallback : null);
  }

  private getRequired(keys: string | string[], message: string): string {
    const value = this.pickEnv(keys);
    if (!value) {
      this.logger.error(message);
      throw new Error(message);
    }
    return value;
  }

  getJwtSecretOptional(): string | null {
    return this.getOptional("JWT_SECRET");
  }

  getSupabaseUrl(): string {
    return this.getRequired(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"], "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  getSupabaseAnonKey(): string {
    return this.getRequired(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"], "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  }

  getSupabaseServiceRoleKey(): string | null {
    return this.getOptional("SUPABASE_SERVICE_ROLE_KEY");
  }

  getCorsOrigins(): true | string[] {
    const raw = this.getOptional("CORS_ORIGIN");
    if (!raw) return true;
    const list = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return list.length > 0 ? list : true;
  }

  getPort(): number {
    const raw = this.getOptional("PORT", "8080");
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    this.logger.warn(`Invalid PORT value '${raw}', falling back to 8080`);
    return 8080;
  }

  isProduction(): boolean {
    const env = this.getOptional("NODE_ENV", "development") ?? "development";
    return env.toLowerCase() === "production";
  }

  getAuthCookieName(): string {
    return this.getOptional("AUTH_COOKIE_NAME", "auth_token") ?? "auth_token";
  }

  getQaseApiToken(): string | null {
    return this.getOptional(["QASE_API_TOKEN", "QASE_TOKEN"]);
  }

  getQaseDefaultProject(): string | null {
    return this.getOptional(["QASE_DEFAULT_PROJECT", "QASE_PROJECT"]);
  }

  getQaseProjectsList(): string[] {
    const raw = this.getOptional(["QASE_PROJECTS", "NEXT_PUBLIC_QASE_PROJECTS"]);
    if (!raw) return [];
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
}
