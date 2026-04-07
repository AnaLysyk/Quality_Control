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

function normalizeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isLeaderRole(value?: string | null) {
  const normalized = normalizeValue(value);
  return (
    normalized === "admin" ||
    normalized === "global_admin" ||
    normalized === "leader_tc" ||
    normalized === "lider_tc" ||
    normalized === "tc_leader"
  );
}

function isSupportRole(value?: string | null) {
  const normalized = normalizeValue(value);
  return (
    normalized === "dev" ||
    normalized === "it_dev" ||
    normalized === "developer" ||
    normalized === "technical_support" ||
    normalized === "support" ||
    normalized === "tech_support" ||
    normalized === "support_tech"
  );
}

function isCompanyAdminRole(value?: string | null) {
  const normalized = normalizeValue(value);
  return (
    normalized === "company" ||
    normalized === "company_admin" ||
    normalized === "client_admin" ||
    normalized === "client_owner" ||
    normalized === "client_manager"
  );
}

export function normalizeFixedProfileKind(value?: string | null): FixedProfileKind | null {
  const normalized = normalizeValue(value);
  if (normalized === "empresa") return "empresa";
  if (normalized === "company_user") return "company_user";
  if (normalized === "testing_company_user") return "testing_company_user";
  if (normalized === "leader_tc") return "leader_tc";
  if (normalized === "technical_support") return "technical_support";
  return null;
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
    isLeaderRole(input?.permissionRole) ||
    isLeaderRole(input?.role) ||
    isLeaderRole(input?.companyRole)
  ) {
    return "leader_tc";
  }

  if (
    isSupportRole(input?.permissionRole) ||
    isSupportRole(input?.role) ||
    isSupportRole(input?.companyRole)
  ) {
    return "technical_support";
  }

  if (
    input?.isInstitutionalCompany === true ||
    isCompanyAdminRole(input?.permissionRole) ||
    isCompanyAdminRole(input?.role) ||
    isCompanyAdminRole(input?.companyRole)
  ) {
    return "empresa";
  }

  if (normalizeValue(input?.userOrigin) === "client_company") {
    return "company_user";
  }

  const hasCompanyContext =
    Boolean(normalizeValue(input?.companyRole)) ||
    Boolean(normalizeValue(input?.clientSlug)) ||
    Number(input?.companyCount ?? 0) > 0;

  return hasCompanyContext ? "company_user" : "testing_company_user";
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
