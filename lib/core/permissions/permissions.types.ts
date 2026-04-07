export type UserRole = "user" | "admin" | "super-admin";
export type CompanyRole = "company_admin" | "it_dev" | "user" | "viewer";
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
