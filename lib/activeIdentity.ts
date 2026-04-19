import type { AuthUser } from "@/contracts/auth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveEntityImage } from "@/lib/resolveEntityImage";

type ActiveCompanyLike = {
  name?: string | null;
  logoUrl?: string | null;
} | null;

export type IdentityRoleKind = "global" | "leader_tc" | "empresa" | "usuario";

export type ActiveIdentity = {
  kind: "user" | "company";
  roleKind: IdentityRoleKind;
  displayName: string;
  avatarUrl: string | null;
  showCompanyTag: boolean;
  companyTagLabel: string | null;
  accountName: string;
  companyName: string | null;
  username: string | null;
  email: string | null;
};

function readTrimmedString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function readLegacyCompanyRecord(user: AuthUser | null | undefined) {
  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : null;
  const company = record?.company;
  if (!company || typeof company !== "object") return null;
  return company as Record<string, unknown>;
}

function normalizeIdentitySeed(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchesIdentitySeed(reference: string | null, ...candidates: Array<string | null>) {
  const normalizedReference = normalizeIdentitySeed(reference);
  if (!normalizedReference) return false;
  return candidates.some((candidate) => normalizeIdentitySeed(candidate) === normalizedReference);
}

export function getAuthUserContextRole(user: AuthUser | null | undefined) {
  const permissionRole = readTrimmedString(user?.permissionRole);
  const role = readTrimmedString(user?.role);
  const companyRole = readTrimmedString(user?.companyRole);

  if (
    normalizeIdentityRole(permissionRole) === "global" ||
    normalizeIdentityRole(role) === "global" ||
    normalizeIdentityRole(companyRole) === "global"
  ) {
    return permissionRole ?? role ?? companyRole ?? "";
  }

  if (
    normalizeIdentityRole(permissionRole) === "leader_tc" ||
    normalizeIdentityRole(role) === "leader_tc" ||
    normalizeIdentityRole(companyRole) === "leader_tc"
  ) {
    return permissionRole ?? role ?? companyRole ?? "";
  }

  if (isInstitutionalCompanyAccount(user)) {
    if (normalizeIdentityRole(companyRole) === "empresa") return companyRole ?? "";
    if (normalizeIdentityRole(permissionRole) === "empresa") return permissionRole ?? "";
    if (normalizeIdentityRole(role) === "empresa") return role ?? "";
    return "empresa";
  }

  if (
    normalizeIdentityRole(companyRole) === "empresa" ||
    normalizeIdentityRole(permissionRole) === "empresa" ||
    normalizeIdentityRole(role) === "empresa"
  ) {
    return "company_user";
  }

  return permissionRole ?? role ?? companyRole ?? "";
}

export function normalizeIdentityRole(value?: string | null): IdentityRoleKind {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "it_dev" ||
    normalized === "dev" ||
    normalized === "developer" ||
    normalized === "technical_support" ||
    normalized === "support" ||
    normalized === "tech_support" ||
    normalized === "support_tech"
  ) {
    return "global";
  }
  if (normalized === "leader_tc" || normalized === "admin" || normalized === "global_admin") return "leader_tc";
  if (normalized === "empresa" || normalized === "company" || normalized === "company_admin" || normalized === "client_admin") return "empresa";
  return "usuario";
}

export function isInstitutionalCompanyAccount(
  user: AuthUser | null | undefined,
  activeCompany?: ActiveCompanyLike,
) {
  if (!user || typeof user !== "object") return false;

  const record = user as Record<string, unknown>;
  const legacyCompany = readLegacyCompanyRecord(user);
  const companySlug = readTrimmedString(
    user.clientSlug,
    user.defaultClientSlug,
    typeof record.client_slug === "string" ? record.client_slug : null,
    typeof record.default_company_slug === "string" ? record.default_company_slug : null,
    typeof legacyCompany?.slug === "string" ? legacyCompany.slug : null,
  );
  const companyName = readTrimmedString(
    activeCompany?.name,
    typeof legacyCompany?.name === "string" ? legacyCompany.name : null,
    typeof legacyCompany?.company_name === "string" ? legacyCompany.company_name : null,
  );
  const accountName = readTrimmedString(user.fullName, user.name);
  const login = readTrimmedString(user.username, user.user);
  const email = readTrimmedString(user.email);
  const origin = readTrimmedString(
    typeof record.user_origin === "string" ? record.user_origin : null,
    typeof record.userOrigin === "string" ? record.userOrigin : null,
  );
  const scope = readTrimmedString(
    typeof record.user_scope === "string" ? record.user_scope : null,
    typeof record.userScope === "string" ? record.userScope : null,
  );

  const matchesCompanySlug = matchesIdentitySeed(companySlug, login, email, accountName);
  const matchesCompanyName = matchesIdentitySeed(companyName, accountName, login);
  const hasCompanyScopedSignal =
    scope === "company_only" ||
    origin === "client_company" ||
    Boolean(companySlug) ||
    Boolean(companyName) ||
    normalizeIdentityRole(user.companyRole) === "empresa" ||
    normalizeIdentityRole(user.role) === "empresa" ||
    normalizeIdentityRole(user.permissionRole) === "empresa";

  return hasCompanyScopedSignal && (matchesCompanySlug || matchesCompanyName);
}

export function isCompanyProfileContext(user: AuthUser | null | undefined) {
  if (isInstitutionalCompanyAccount(user)) return true;
  if (!user || typeof user !== "object") return false;

  const record = user as Record<string, unknown>;
  const origin = readTrimmedString(
    typeof record.user_origin === "string" ? record.user_origin : null,
    typeof record.userOrigin === "string" ? record.userOrigin : null,
  );
  const scope = readTrimmedString(
    typeof record.user_scope === "string" ? record.user_scope : null,
    typeof record.userScope === "string" ? record.userScope : null,
  );
  const permissionRole = normalizeLegacyRole(user.permissionRole);
  const role = normalizeLegacyRole(user.role);
  const companyRole = normalizeLegacyRole(user.companyRole);

  return (
    origin === "client_company" ||
    scope === "company_only" ||
    permissionRole === SYSTEM_ROLES.EMPRESA ||
    role === SYSTEM_ROLES.EMPRESA ||
    companyRole === SYSTEM_ROLES.EMPRESA ||
    permissionRole === SYSTEM_ROLES.COMPANY_USER ||
    role === SYSTEM_ROLES.COMPANY_USER ||
    companyRole === SYSTEM_ROLES.COMPANY_USER
  );
}

export function resolveActiveIdentity({
  user,
  activeCompany,
}: {
  user: AuthUser | null | undefined;
  activeCompany?: ActiveCompanyLike;
}): ActiveIdentity {
  const roleKind = normalizeIdentityRole(getAuthUserContextRole(user));
  const legacyCompany = readLegacyCompanyRecord(user);
  const accountName = readTrimmedString(user?.fullName, user?.name, user?.email, "Usuario") ?? "Usuario";
  const username = readTrimmedString(user?.username, user?.user);
  const email = readTrimmedString(user?.email);
  const companyName = readTrimmedString(
    activeCompany?.name,
    legacyCompany?.name,
    legacyCompany?.company_name,
  );

  if (roleKind === "empresa") {
    const companyLogo = readTrimmedString(activeCompany?.logoUrl, legacyCompany?.logoUrl, legacyCompany?.logo_url) ?? null;
    return {
      kind: "company",
      roleKind,
      displayName: companyName ?? accountName,
      avatarUrl: resolveEntityImage({ isCompanyContext: true, companyLogoUrl: companyLogo, userAvatarUrl: null }),
      showCompanyTag: false,
      companyTagLabel: null,
      accountName,
      companyName,
      username,
      email,
    };
  }

  const showCompanyTag = roleKind === "usuario" && Boolean(companyName);

  const userAvatar = readTrimmedString(user?.avatarUrl, (user as Record<string, unknown> | null)?.avatar_url) ?? null;
  const companyLogo = readTrimmedString(activeCompany?.logoUrl, legacyCompany?.logoUrl, legacyCompany?.logo_url) ?? null;

  return {
    kind: "user",
    roleKind,
    displayName: accountName,
    avatarUrl: resolveEntityImage({ isCompanyContext: showCompanyTag && !userAvatar, companyLogoUrl: companyLogo, userAvatarUrl: userAvatar }),
    showCompanyTag,
    companyTagLabel: showCompanyTag ? companyName : null,
    accountName,
    companyName,
    username,
    email,
  };
}
