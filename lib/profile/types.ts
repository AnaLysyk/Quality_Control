/**
 * Profile Engine â€” tipos centrais
 * Define contexto, permissÃµes e estrutura da tela unificada de empresa/usuÃ¡rio
 */

export type EntityType = "company" | "user";
export type ProfileMode = "self" | "view" | "edit" | "create" | "admin-edit";
export type UserRole =
  | "admin"
  | "leader_tc"
  | "technical_support"
  | "testing_company_user"
  | "company_user";
export type RoleInCompany = "viewer" | "executor" | "manager" | "admin";
export type EntityStatus =
  | "active"
  | "inactive"
  | "blocked"
  | "archived"
  | "suspended"
  | "pending";

/**
 * DecisÃµes que a engine precisa tomar sobre a interface
 */
export type ProfilePermissions = {
  canView: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canManagePermissions: boolean;
  canManageCompanyLinks: boolean;
  canManageApplications: boolean;
  canManageIntegrations: boolean;
  canManageUsers: boolean;
  canViewAudit: boolean;
  canImpersonatePreview: boolean;
  canBlockUnblock: boolean;
  canResetPassword: boolean;
  canResendInvite: boolean;
  canEditByField: Record<string, boolean>;
};

/**
 * Scope: o que o viewer consegue ver
 */
export type ProfileScope = {
  allowedCompanyIds: string[];
  allowedApplicationIds: string[];
  allowedModuleIds: string[];
  isSelfProfile: boolean;
  isSameCompany: boolean;
};

/**
 * Context que a tela inteira usa para se montar
 */
export type ProfileRuntimeContext = {
  // Identidade
  entityType: EntityType;
  entityId: string;
  mode: ProfileMode;

  // Quem estÃ¡ olhando
  viewer: {
    id: string;
    role: UserRole;
    companyIds: string[];
    companyId?: string | null;
  };

  // Dados do alvo
  target?: {
    id: string;
    type: EntityType;
    role?: UserRole | RoleInCompany;
    companyIds?: string[];
    status?: EntityStatus;
  };

  // DecisÃµes
  permissions: ProfilePermissions;
  scope: ProfileScope;

  // Metadados
  visibleTabs: ProfileTab[];
  primaryAction?: "edit" | "view" | "delete" | "create";
  showDangerZone: boolean;
  isDraft: boolean;
  canCompare: boolean;
};

export type ProfileTab =
  | "overview"
  | "profile"
  | "access"
  | "companies"
  | "users"
  | "applications"
  | "integrations"
  | "permissions"
  | "preferences"
  | "security"
  | "audit";

/**
 * Field-level permission
 */
export type ProfileFieldPermission = {
  field: string;
  label: string;
  visibleIn: ProfileMode[];
  editableIn: ProfileMode[];
  required: boolean;
  requiresPermission?: keyof ProfilePermissions;
};

/**
 * User-Company link (muitos-para-muitos explÃ­cito)
 */
export type UserCompanyLink = {
  id: string;
  userId: string;
  companyId: string;
  roleInCompany: RoleInCompany;
  status: EntityStatus;
  permissions: string[];
  allowedApplicationIds: string[];
  allowedModuleIds: string[];
  linkedAt: string;
  linkedBy: string;
  updatedAt: string;
  updatedBy: string;
};

/**
 * AÃ§Ã£o auditÃ¡vel
 */
export type ProfileAuditEntry = {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: string;
  field?: string;
  before?: unknown;
  after?: unknown;
  actor: {
    id: string;
    name: string;
    role: UserRole;
  };
  origin: string;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
};

/**
 * Impacto de alteraÃ§Ã£o
 */
export type ChangeImpact = {
  title: string;
  description: string;
  affectedSystems: string[];
  severity: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
};

