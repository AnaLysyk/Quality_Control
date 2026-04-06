export type EditableProfileRole =
  | "admin"
  | "dev"
  | "company"
  | "user"
  | "leader_tc"
  | "technical_support";

export type StoredEditableUserRole =
  | "company_admin"
  | "user"
  | "leader_tc"
  | "technical_support"
  | "it_dev";

export function resolveEditableProfileRole(value?: string | null): EditableProfileRole | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "admin" || normalized === "global_admin") return "admin";
  if (normalized === "dev" || normalized === "it_dev" || normalized === "itdev" || normalized === "developer") {
    return "dev";
  }
  if (
    normalized === "company" ||
    normalized === "company_admin" ||
    normalized === "client_admin" ||
    normalized === "client_owner" ||
    normalized === "client_manager"
  ) {
    return "company";
  }
  if (normalized === "leader_tc" || normalized === "tc_leader" || normalized === "lider_tc") {
    return "leader_tc";
  }
  if (
    normalized === "technical_support" ||
    normalized === "technical support" ||
    normalized === "support" ||
    normalized === "tech_support" ||
    normalized === "support_tech"
  ) {
    return "technical_support";
  }
  if (normalized === "user" || normalized === "viewer" || normalized === "client_user" || normalized === "client_viewer") {
    return "user";
  }

  return null;
}

export function normalizeEditableProfileRole(value?: string | null): EditableProfileRole {
  return resolveEditableProfileRole(value) ?? "user";
}

export function isGlobalPrivilegeProfileRole(role: EditableProfileRole) {
  return role === "admin" || role === "dev";
}

export function toStoredEditableUserRole(role: EditableProfileRole): StoredEditableUserRole {
  if (role === "dev") return "it_dev";
  if (role === "company") return "company_admin";
  if (role === "leader_tc") return "leader_tc";
  if (role === "technical_support") return "technical_support";
  return "user";
}
