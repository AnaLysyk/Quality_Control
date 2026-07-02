import type { AuthUser } from "@/contracts/auth";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

type AutomationUserLike = Partial<
  Pick<
    AuthUser,
    | "clientSlug"
    | "clientSlugs"
    | "companyRole"
    | "defaultClientSlug"
    | "email"
    | "fullName"
    | "id"
    | "isGlobalAdmin"
    | "is_global_admin"
    | "name"
    | "permissionRole"
    | "role"
    | "user"
    | "username"
  >
> & {
  companySlug?: string | null;
  companySlugs?: string[] | undefined;
};

export type AutomationAccess = {
  canConfigure: boolean;
  canManageFlows: boolean;
  canOpen: boolean;
  canViewTechnicalLogs: boolean;
  hasGlobalCompanyVisibility: boolean;
  helperText: string;
  profileLabel: string;
  scopeLabel: string;
  visibilityLabel: string;
};

function hasAuthIdentity(user: AutomationUserLike | null | undefined): user is AuthUser {
  return Boolean(user && typeof (user as { id?: unknown }).id === "string");
}

export function resolveAutomationAllowedCompanySlugs(user: AutomationUserLike | null | undefined) {
  const merged = [
    ...(Array.isArray(user?.companySlugs) ? user.companySlugs : []),
    ...(Array.isArray(user?.clientSlugs) ? user.clientSlugs : []),
    ...(user?.companySlug ? [user.companySlug] : []),
    ...(user?.clientSlug ? [user.clientSlug] : []),
  ];

  return merged.filter((value, index, self): value is string => typeof value === "string" && value.length > 0 && self.indexOf(value) === index);
}

export function resolveAutomationAccess(
  user: AutomationUserLike | null | undefined,
  companyCount = resolveAutomationAllowedCompanySlugs(user).length,
): AutomationAccess {
  const roles = [user?.permissionRole, user?.role, user?.companyRole]
    .map((value) => normalizeLegacyRole(value))
    .filter((value): value is NonNullable<ReturnType<typeof normalizeLegacyRole>> => Boolean(value));
  const isLeader =
    user?.isGlobalAdmin === true ||
    user?.is_global_admin === true ||
    roles.includes(SYSTEM_ROLES.LEADER_TC);
  const isSupport = roles.includes(SYSTEM_ROLES.TECHNICAL_SUPPORT);
  const isTcUser = roles.includes(SYSTEM_ROLES.TESTING_COMPANY_USER);
  const isCompanyRole = roles.includes(SYSTEM_ROLES.EMPRESA);
  const isCompanyUserRole = roles.includes(SYSTEM_ROLES.COMPANY_USER);
  const isInstitutionalCompany =
    hasAuthIdentity(user) && isInstitutionalCompanyAccount(user);
  const isCompanyAccount = isInstitutionalCompany || isCompanyRole || isCompanyUserRole;
  const linkedCompaniesLabel =
    companyCount > 0
      ? `${companyCount} empresa${companyCount === 1 ? "" : "s"} vinculada${companyCount === 1 ? "" : "s"}`
      : "Somente empresas vinculadas";
  const ownCompanyLabel =
    companyCount > 0
      ? `${companyCount} empresa${companyCount === 1 ? "" : "s"} da conta`
      : "PrÃ³pria empresa";

  if (isLeader) {
    return {
      canOpen: true,
      canConfigure: true,
      canManageFlows: true,
      canViewTechnicalLogs: true,
      hasGlobalCompanyVisibility: true,
      profileLabel: "LÃ­der TC",
      scopeLabel: "Todas as empresas",
      visibilityLabel: "GestÃ£o completa",
      helperText: "Pode configurar ambientes, fluxos, segredos operacionais e histÃ³rico tÃ©cnico.",
    };
  }

  if (isSupport) {
    return {
      canOpen: true,
      canConfigure: true,
      canManageFlows: true,
      canViewTechnicalLogs: true,
      hasGlobalCompanyVisibility: true,
      profileLabel: "Suporte tÃ©cnico",
      scopeLabel: "Todas as empresas",
      visibilityLabel: "OperaÃ§Ã£o completa",
      helperText: "Pode operar e ajustar fluxos guiados, com leitura global de empresas e ambientes.",
    };
  }

  if (isTcUser) {
    return {
      canOpen: true,
      canConfigure: false,
      canManageFlows: false,
      canViewTechnicalLogs: false,
      hasGlobalCompanyVisibility: false,
      profileLabel: "UsuÃ¡rio TC",
      scopeLabel: linkedCompaniesLabel,
      visibilityLabel: "Somente leitura operacional",
      helperText: "MantÃ©m a mesma identidade visual do mÃ³dulo interno, executa automaÃ§Ãµes das empresas vinculadas e nÃ£o altera fluxos, ambientes nem segredos.",
    };
  }

  if (isCompanyAccount) {
    return {
      canOpen: true,
      canConfigure: false,
      canManageFlows: true,
      canViewTechnicalLogs: false,
      hasGlobalCompanyVisibility: false,
      profileLabel: isCompanyUserRole && !isCompanyRole ? "UsuÃ¡rio da empresa" : "Empresa",
      scopeLabel: ownCompanyLabel,
      visibilityLabel: "OperaÃ§Ã£o da empresa",
      helperText:
        "Visualiza, edita, inativa e executa apenas as automaÃ§Ãµes da prÃ³pria empresa. UsuÃ¡rio da empresa herda a mesma visÃ£o da empresa de origem.",
    };
  }

  return {
    canOpen: false,
    canConfigure: false,
    canManageFlows: false,
    canViewTechnicalLogs: false,
    hasGlobalCompanyVisibility: false,
    profileLabel: "Conta",
    scopeLabel: "Sem acesso ao mÃ³dulo",
    visibilityLabel: "Restrito",
    helperText: "Esse workspace Ã© interno e foi pensado para operaÃ§Ã£o tÃ©cnica da Testing Company.",
  };
}

