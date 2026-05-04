import type { SystemRole } from "@/lib/auth/roles";

export type UserRole = SystemRole;
export type CompanyRole = SystemRole;
export type GlobalRole = "global_admin";
export type Capability =
  | "company:read"
  | "company:write"
  | "user:read"
  | "user:write"
  | "metrics:read"
  | "metrics:write"
  | "release:read"
  | "release:write"
  | "run:read"
  | "run:write"
  | "defect:read"
  | "defect:write"
  | "*";

export type Permission =
  | "read_dashboard"
  | "manage_users"
  | "manage_companies"
  | "manage_releases"
  | "manage_tests"
  | "view_admin"
  | "manage_settings";
