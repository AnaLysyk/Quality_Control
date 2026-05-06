import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

export type FixedProfileKind =
  | "empresa"
  | "company_user"
  | "testing_company_user"
  | "leader_tc"
  | "technical_support";

type FixedProfileMeta = {
  label: string;
  shortLabel: string;
  hint: string;
  toneClass: string;
};

const FIXED_PROFILE_META: Record<FixedProfileKind, FixedProfileMeta> = {
  empresa: {
    label: "Admin da empresa",
    shortLabel: "Empresa",
    hint: "Conta institucional e administrativa da empresa.",
    toneClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
  company_user: {
    label: "Usuario da empresa",
    shortLabel: "Usuario da empresa",
    hint: "Usuario vinculado ao contexto da empresa.",
    toneClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
  testing_company_user: {
    label: "Usuario TC",
    shortLabel: "Usuario TC",
    hint: "Usuario interno da Testing Company.",
    toneClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  leader_tc: {
    label: "Lider TC",
    shortLabel: "Lider TC",
    hint: "Perfil institucional da Testing Company.",
    toneClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  technical_support: {
    label: "Suporte Tecnico",
    shortLabel: "Suporte Tecnico",
    hint: "Atuacao tecnica e operacional da Testing Company.",
    toneClass: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
};

export function normalizeFixedProfileKind(value?: string | null): FixedProfileKind | null {
  return normalizeLegacyRole(value) as FixedProfileKind | null;
}

export function resolveFixedProfileKind(input?: {
  profileKind?: string | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  userOrigin?: string | null;
  companyCount?: number | null;
  clientSlug?: string | null;
  isInstitutionalCompany?: boolean;
}): FixedProfileKind {
  const explicitProfileKind = normalizeFixedProfileKind(input?.profileKind);
  if (explicitProfileKind) return explicitProfileKind;

  if (
    normalizeFixedProfileKind(input?.permissionRole) === SYSTEM_ROLES.LEADER_TC ||
    normalizeFixedProfileKind(input?.role) === SYSTEM_ROLES.LEADER_TC ||
    normalizeFixedProfileKind(input?.companyRole) === SYSTEM_ROLES.LEADER_TC
  ) {
    return SYSTEM_ROLES.LEADER_TC;
  }

  if (
    normalizeFixedProfileKind(input?.permissionRole) === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizeFixedProfileKind(input?.role) === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizeFixedProfileKind(input?.companyRole) === SYSTEM_ROLES.TECHNICAL_SUPPORT
  ) {
    return SYSTEM_ROLES.TECHNICAL_SUPPORT;
  }

  if (
    input?.isInstitutionalCompany === true ||
    normalizeFixedProfileKind(input?.permissionRole) === SYSTEM_ROLES.EMPRESA ||
    normalizeFixedProfileKind(input?.role) === SYSTEM_ROLES.EMPRESA ||
    normalizeFixedProfileKind(input?.companyRole) === SYSTEM_ROLES.EMPRESA
  ) {
    return SYSTEM_ROLES.EMPRESA;
  }

  if ((input?.userOrigin ?? "").trim().toLowerCase() === "client_company") {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  const hasCompanyContext =
    Boolean((input?.companyRole ?? "").trim()) ||
    Boolean((input?.clientSlug ?? "").trim()) ||
    Number(input?.companyCount ?? 0) > 0;

  return hasCompanyContext ? SYSTEM_ROLES.COMPANY_USER : SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function getFixedProfileLabel(kind: FixedProfileKind, options?: { short?: boolean }) {
  const meta = FIXED_PROFILE_META[kind];
  return options?.short ? meta.shortLabel : meta.label;
}

export function getFixedProfileHint(kind: FixedProfileKind) {
  return FIXED_PROFILE_META[kind].hint;
}

export function getFixedProfileTone(kind: FixedProfileKind, options?: { selected?: boolean }) {
  if (options?.selected) return "border border-white/20 bg-white/10 text-white";
  return FIXED_PROFILE_META[kind].toneClass;
}

export function getFixedProfilePresentation(input?: {
  profileKind?: string | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  userOrigin?: string | null;
  companyCount?: number | null;
  clientSlug?: string | null;
  isInstitutionalCompany?: boolean;
}) {
  const kind = resolveFixedProfileKind(input);
  return {
    kind,
    label: getFixedProfileLabel(kind),
    shortLabel: getFixedProfileLabel(kind, { short: true }),
    hint: getFixedProfileHint(kind),
    toneClass: getFixedProfileTone(kind),
  };
}
