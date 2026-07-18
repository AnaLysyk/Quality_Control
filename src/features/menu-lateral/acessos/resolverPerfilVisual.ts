import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";

export type PerfilVisualInput = {
  companyRole?: string | null;
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
  permissionRole?: string | null;
  role?: string | null;
  userOrigin?: string | null;
  user_origin?: string | null;
};

export type PerfilVisual = {
  grupo: "testing-company" | "empresa" | "desconhecido";
  isEmpresa: boolean;
  isInterno: boolean;
  label: string;
  perfil: SystemRole | null;
};

const PERFIL_LABELS: Record<SystemRole, string> = {
  [SYSTEM_ROLES.LEADER_TC]: "Lider TC",
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: "Administrador",
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: "Usuario TC",
  [SYSTEM_ROLES.EMPRESA]: "Empresa",
  [SYSTEM_ROLES.COMPANY_USER]: "Usuario da empresa",
};

const INTERNAL_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
]);

const COMPANY_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
]);

function resolveNormalizedRole(input?: PerfilVisualInput | null) {
  return (
    normalizeLegacyRole(input?.permissionRole) ??
    normalizeLegacyRole(input?.role) ??
    normalizeLegacyRole(input?.companyRole)
  );
}

export function resolverPerfilVisual(input?: PerfilVisualInput | null): PerfilVisual {
  const normalizedRole = resolveNormalizedRole(input);
  const isGlobalAdmin =
    input?.isGlobalAdmin === true ||
    input?.is_global_admin === true ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC;

  const perfil = isGlobalAdmin ? SYSTEM_ROLES.LEADER_TC : normalizedRole;
  const isInterno = perfil ? INTERNAL_ROLES.has(perfil) : false;
  const isEmpresa = perfil ? COMPANY_ROLES.has(perfil) : false;

  return {
    grupo: isInterno ? "testing-company" : isEmpresa ? "empresa" : "desconhecido",
    isEmpresa,
    isInterno,
    label: perfil ? PERFIL_LABELS[perfil] : "Perfil nao identificado",
    perfil,
  };
}

export const resolvePerfilVisual = resolverPerfilVisual;

