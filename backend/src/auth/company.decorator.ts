import { SetMetadata } from "@nestjs/common";

export const COMPANY_SCOPE_KEY = "company_scope";

export type CompanyScopeOptions = {
  param?: string;
  query?: string;
  allowGlobalAdmin?: boolean;
};

export const RequireCompany = (options: CompanyScopeOptions = {}) => SetMetadata(COMPANY_SCOPE_KEY, options);
