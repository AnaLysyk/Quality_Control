/**
 * Profile Engine — helpers de permissão
 * Verifica se campo/ação é permitido
 */

import type {
  ProfileFieldPermission,
  ProfileMode,
  ProfilePermissions,
  ProfileRuntimeContext,
} from "./types";

/**
 * Define quais campos são editáveis por modo
 */
export const COMPANY_PROFILE_FIELDS: ProfileFieldPermission[] = [
  {
    field: "name",
    label: "Nome da empresa",
    visibleIn: ["self", "view", "edit", "admin-edit", "create"],
    editableIn: ["edit", "admin-edit", "create"],
    required: true,
  },
  {
    field: "tax_id",
    label: "CNPJ",
    visibleIn: ["self", "view", "edit", "admin-edit", "create"],
    editableIn: ["admin-edit", "create"],
    required: false,
  },
  {
    field: "address",
    label: "Endereço",
    visibleIn: ["self", "view", "edit", "admin-edit"],
    editableIn: ["edit", "admin-edit"],
    required: false,
  },
  {
    field: "phone",
    label: "Telefone",
    visibleIn: ["self", "view", "edit", "admin-edit"],
    editableIn: ["edit", "admin-edit"],
    required: false,
  },
  {
    field: "website",
    label: "Website",
    visibleIn: ["self", "view", "edit", "admin-edit"],
    editableIn: ["edit", "admin-edit"],
    required: false,
  },
  {
    field: "status",
    label: "Status",
    visibleIn: ["view", "admin-edit"],
    editableIn: ["admin-edit"],
    required: false,
    requiresPermission: "canManagePermissions",
  },
];

export const USER_PROFILE_FIELDS: ProfileFieldPermission[] = [
  {
    field: "name",
    label: "Nome",
    visibleIn: ["self", "view", "edit", "admin-edit", "create"],
    editableIn: ["self", "edit", "admin-edit", "create"],
    required: true,
  },
  {
    field: "email",
    label: "E-mail",
    visibleIn: ["self", "view", "edit", "admin-edit", "create"],
    editableIn: ["admin-edit", "create"],
    required: true,
  },
  {
    field: "phone",
    label: "Telefone",
    visibleIn: ["self", "view", "edit", "admin-edit"],
    editableIn: ["self", "edit", "admin-edit"],
    required: false,
  },
  {
    field: "avatar",
    label: "Avatar",
    visibleIn: ["self", "view", "edit", "admin-edit"],
    editableIn: ["self", "edit", "admin-edit"],
    required: false,
  },
  {
    field: "role",
    label: "Perfil",
    visibleIn: ["view", "admin-edit"],
    editableIn: ["admin-edit"],
    required: false,
    requiresPermission: "canManagePermissions",
  },
  {
    field: "status",
    label: "Status",
    visibleIn: ["view", "admin-edit"],
    editableIn: ["admin-edit"],
    required: false,
    requiresPermission: "canManagePermissions",
  },
];

/**
 * Verifica se campo é visível
 */
export function isFieldVisible(
  field: string,
  mode: ProfileMode,
  fields: ProfileFieldPermission[],
): boolean {
  const fieldDef = fields.find((f) => f.field === field);
  if (!fieldDef) return false;
  return fieldDef.visibleIn.includes(mode);
}

/**
 * Verifica se campo é editável
 */
export function isFieldEditable(
  field: string,
  mode: ProfileMode,
  fields: ProfileFieldPermission[],
  permissions?: ProfilePermissions,
): boolean {
  const fieldDef = fields.find((f) => f.field === field);
  if (!fieldDef) return false;
  if (!fieldDef.editableIn.includes(mode)) return false;

  // Se requer permissão específica
  if (fieldDef.requiresPermission && permissions) {
    const key = fieldDef.requiresPermission as keyof ProfilePermissions;
    if (typeof permissions[key] === "boolean" && !permissions[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Verifica se ação é permitida
 */
export function canPerformAction(
  action:
    | "view"
    | "edit"
    | "delete"
    | "deactivate"
    | "archive"
    | "manage_users"
    | "manage_permissions"
    | "manage_links"
    | "manage_integrations"
    | "view_audit"
    | "impersonate"
    | "block"
    | "reset_password"
    | "resend_invite",
  context: ProfileRuntimeContext,
): boolean {
  const { permissions } = context;

  switch (action) {
    case "view":
      return permissions.canView;
    case "edit":
      return permissions.canEdit;
    case "delete":
      return permissions.canDelete;
    case "deactivate":
      return permissions.canDeactivate;
    case "archive":
      return permissions.canArchive;
    case "manage_users":
      return permissions.canManageUsers;
    case "manage_permissions":
      return permissions.canManagePermissions;
    case "manage_links":
      return permissions.canManageCompanyLinks;
    case "manage_integrations":
      return permissions.canManageIntegrations;
    case "view_audit":
      return permissions.canViewAudit;
    case "impersonate":
      return permissions.canImpersonatePreview;
    case "block":
      return permissions.canBlockUnblock;
    case "reset_password":
      return permissions.canResetPassword;
    case "resend_invite":
      return permissions.canResendInvite;
    default:
      return false;
  }
}

/**
 * Verifica se há qualquer permissão de edição
 */
export function hasAnyEditPermission(context: ProfileRuntimeContext): boolean {
  return (
    context.permissions.canEdit ||
    context.permissions.canManagePermissions ||
    context.permissions.canManageCompanyLinks ||
    context.permissions.canManageApplications ||
    context.permissions.canManageIntegrations
  );
}

/**
 * Verifica se modo permite edição
 */
export function isModeEditable(mode: ProfileMode): boolean {
  return mode === "edit" || mode === "admin-edit" || mode === "create";
}
