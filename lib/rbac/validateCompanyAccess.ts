import type { AuthUser } from "@/lib/jwtAuth";

export type CompanyAccessErrorCode = "MISSING_COMPANY_ID" | "FORBIDDEN_COMPANY_ACCESS";

export class CompanyAccessError extends Error {
  constructor(public code: CompanyAccessErrorCode) {
    super(code);
    this.name = "CompanyAccessError";
  }
}

export function isCompanyAccessError(error: unknown): error is CompanyAccessError {
  return error instanceof CompanyAccessError;
}

export function assertCompanyAccess(user: AuthUser | null, companyId?: string | null) {
  if (!user || !companyId) throw new CompanyAccessError("MISSING_COMPANY_ID");

  const role = (user.role ?? "").toLowerCase();

  // Admins and devs have global access
  if (["admin", "global_admin", "it_dev", "developer", "dev"].includes(role)) return;

  // Companies only access themselves
  if (role === "company" && user.companyId === companyId) return;

  // Users access companies they are linked to
  if (role === "user") {
    if (user.companyId === companyId) return;
    if (Array.isArray(user.companySlugs) && user.companySlugs.includes(companyId)) return;
  }

  throw new CompanyAccessError("FORBIDDEN_COMPANY_ACCESS");
}

export function requireCompanyIdPresent(companyId?: string | null) {
  if (!companyId) throw new CompanyAccessError("MISSING_COMPANY_ID");
}
