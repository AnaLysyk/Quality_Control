import "server-only";

import {
  listLocalCompanies,
  listLocalMemberships,
  listLocalUsers,
  normalizeLocalRole,
  type LocalAuthCompany,
  type LocalAuthMembership,
  type LocalAuthUser,
} from "@/lib/auth/localStore";
import {
  normalizeUserOrigin,
  normalizeUserScope,
  resolveAllowMultiCompanyLink,
  resolveUserOriginLabel,
} from "@/lib/companyUserScope";
import { syncLegacyCompanyUsersToLocalStore } from "@/lib/legacyCompanyUsersSync";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

export type AdminUserCompanyItem = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
};

export type AdminUserProfileKind = SystemRole;

export type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  user?: string;
  avatar_key?: string | null;
  role?: string;
  permission_role?: string;
  client_id?: string | null;
  company_name?: string | null;
  company_names?: string[];
  company_ids?: string[];
  company_count?: number;
  companyNames?: string[];
  companyIds?: string[];
  companyCount?: number;
  companies?: AdminUserCompanyItem[];
  active?: boolean;
  status?: string;
  job_title?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  created_by_company_id?: string | null;
  home_company_id?: string | null;
  user_origin?: "testing_company" | "client_company";
  user_scope?: "shared" | "company_only";
  allow_multi_company_link?: boolean;
  origin_label?: string;
  profile_kind?: AdminUserProfileKind;
};

const ROLE_WEIGHT: Record<string, number> = {
  viewer: 0,
  testing_company_user: 0,
  user: 1,
  company_user: 1,
  company_admin: 2,
  empresa: 2,
  it_dev: 3,
  technical_support: 3,
  leader_tc: 4,
};

function readTrimmedString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return null;
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

function matchesIdentitySeed(reference?: string | null, ...candidates: Array<string | null | undefined>) {
  const normalizedReference = normalizeIdentitySeed(reference);
  if (!normalizedReference) return false;
  return candidates.some((candidate) => normalizeIdentitySeed(candidate) === normalizedReference);
}

function normalizeCompanyName(company: LocalAuthCompany | null | undefined, companyId: string) {
  const candidate =
    (typeof company?.name === "string" && company.name.trim()) ||
    (typeof company?.company_name === "string" && company.company_name.trim()) ||
    "";
  return candidate || `Empresa ${companyId}`;
}

function compareCompanyLinks(a: AdminUserCompanyItem, b: AdminUserCompanyItem) {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}

function summarizeCompanyNames(companyNames: string[]) {
  if (!companyNames.length) return null;
  if (companyNames.length === 1) return companyNames[0];
  return `${companyNames[0]} +${companyNames.length - 1}`;
}

export function resolveStrongestCompanyRole(links: Array<Pick<LocalAuthMembership, "role">>) {
  let strongest = "company_user";
  let strongestWeight = ROLE_WEIGHT[strongest] ?? 0;

  for (const link of links) {
    const role = normalizeLocalRole(link.role ?? null);
    const weight = ROLE_WEIGHT[role] ?? ROLE_WEIGHT.company_user;
    if (weight > strongestWeight) {
      strongest = role;
      strongestWeight = weight;
    }
  }

  return strongest;
}

export function resolvePermissionRoleForUser(
  user:
    | Pick<
        LocalAuthUser,
        "globalRole" | "is_global_admin" | "role" | "user_origin" | "user_scope" | "allow_multi_company_link"
      >
    | null
    | undefined,
  links: Array<Pick<LocalAuthMembership, "role">>,
) {
  const strongestFromLinks = resolveStrongestCompanyRole(links);
  const userRole = normalizeLocalRole(user?.role ?? null);
  const origin = normalizeUserOrigin(user?.user_origin);
  const scope = normalizeUserScope(user?.user_scope);
  const allowMultiCompanyLink = resolveAllowMultiCompanyLink(
    user?.allow_multi_company_link,
    user?.user_scope,
  );
  const strongest =
    (ROLE_WEIGHT[userRole] ?? ROLE_WEIGHT.company_user) > (ROLE_WEIGHT[strongestFromLinks] ?? ROLE_WEIGHT.company_user)
      ? userRole
      : strongestFromLinks;
  if (strongest === "leader_tc") return SYSTEM_ROLES.LEADER_TC;
  if (strongest === "technical_support" || strongest === "it_dev") return SYSTEM_ROLES.TECHNICAL_SUPPORT;
  if (user?.globalRole === "global_admin" || user?.is_global_admin === true) return SYSTEM_ROLES.LEADER_TC;
  if (strongest === "company_admin" || strongest === "empresa") return SYSTEM_ROLES.EMPRESA;
  if (origin === "client_company" || scope === "company_only" || allowMultiCompanyLink === false) {
    return SYSTEM_ROLES.COMPANY_USER;
  }
  return SYSTEM_ROLES.TESTING_COMPANY_USER;
}

function isInstitutionalCompanyProfile(
  user: LocalAuthUser,
  primaryCompany: AdminUserCompanyItem | null,
) {
  const companySlug = readTrimmedString(
    primaryCompany?.slug,
    user.default_company_slug,
  );
  const companyName = readTrimmedString(primaryCompany?.name);
  const accountName = readTrimmedString(user.full_name, user.name);
  const login = readTrimmedString(user.user, user.email);
  const email = readTrimmedString(user.email);
  const origin = normalizeUserOrigin(user.user_origin);
  const scope = normalizeUserScope(user.user_scope);
  const companyRole = normalizeLocalRole(user.role ?? null);

  const hasCompanyScopedSignal =
    scope === "company_only" ||
    origin === "client_company" ||
    Boolean(companySlug) ||
    Boolean(companyName) ||
    companyRole === "company_admin" ||
    companyRole === "empresa";

  if (!hasCompanyScopedSignal) return false;

  const matchesCompanySlug = matchesIdentitySeed(companySlug, login, email, accountName);
  const matchesCompanyName = matchesIdentitySeed(companyName, accountName, login);

  return matchesCompanySlug || matchesCompanyName;
}

export function resolveAdminUserProfileKind(
  user: LocalAuthUser,
  links: Array<Pick<LocalAuthMembership, "role">>,
  primaryCompany: AdminUserCompanyItem | null,
): AdminUserProfileKind {
  const normalizedUserRole = normalizeLocalRole(user.role ?? null);
  const normalizedLinkRoles = links.map((link) => normalizeLocalRole(link.role ?? null));
  const origin = normalizeUserOrigin(user.user_origin);
  const scope = normalizeUserScope(user.user_scope);
  const allowMultiCompanyLink = resolveAllowMultiCompanyLink(
    user.allow_multi_company_link,
    user.user_scope,
  );

  if (
    user.globalRole === "global_admin" ||
    user.is_global_admin === true ||
    normalizedUserRole === "leader_tc" ||
    normalizedLinkRoles.includes("leader_tc")
  ) {
    return SYSTEM_ROLES.LEADER_TC;
  }

  if (
    normalizedUserRole === "it_dev" ||
    normalizedUserRole === "technical_support" ||
    normalizedLinkRoles.includes("it_dev") ||
    normalizedLinkRoles.includes("technical_support")
  ) {
    return SYSTEM_ROLES.TECHNICAL_SUPPORT;
  }

  if (isInstitutionalCompanyProfile(user, primaryCompany)) {
    return SYSTEM_ROLES.EMPRESA;
  }

  if (origin === "client_company" || scope === "company_only" || allowMultiCompanyLink === false) {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  return SYSTEM_ROLES.TESTING_COMPANY_USER;
}

export function buildAdminUserItem(
  user: LocalAuthUser,
  links: LocalAuthMembership[],
  companyById: Map<string, LocalAuthCompany>,
): AdminUserItem {
  const uniqueLinks = new Map<string, LocalAuthMembership>();
  for (const link of links) {
    const role = normalizeLocalRole(link.role ?? null);
    const current = uniqueLinks.get(link.companyId);
    if (!current) {
      uniqueLinks.set(link.companyId, { ...link, role });
      continue;
    }
    const currentWeight = ROLE_WEIGHT[normalizeLocalRole(current.role ?? null)] ?? ROLE_WEIGHT.user;
    const nextWeight = ROLE_WEIGHT[role] ?? ROLE_WEIGHT.user;
    if (nextWeight >= currentWeight) {
      uniqueLinks.set(link.companyId, { ...link, role });
    }
  }

  const companies: AdminUserCompanyItem[] = Array.from(uniqueLinks.values())
    .map((link) => {
      const company = companyById.get(link.companyId);
      return {
        id: link.companyId,
        name: normalizeCompanyName(company, link.companyId),
        slug: typeof company?.slug === "string" ? company.slug : null,
        role: normalizeLocalRole(link.role ?? null),
      };
    })
    .sort(compareCompanyLinks);

  const companyNames = companies.map((company) => company.name);
  const companyIds = companies.map((company) => company.id);

  const defaultCompanySlug =
    typeof user.default_company_slug === "string" && user.default_company_slug.trim()
      ? user.default_company_slug.trim().toLowerCase()
      : null;

  const primaryCompany =
    (defaultCompanySlug ? companies.find((company) => (company.slug ?? "").toLowerCase() === defaultCompanySlug) : null) ??
    companies[0] ??
    null;

  const permissionRole = resolvePermissionRoleForUser(user, Array.from(uniqueLinks.values()));
  const profileKind = resolveAdminUserProfileKind(user, Array.from(uniqueLinks.values()), primaryCompany);
  const mappedRole = normalizeLegacyRole(permissionRole) ?? profileKind;

  return {
    id: user.id,
    name: user.full_name?.trim() || (user.name ?? ""),
    email: user.email,
    user: user.user ?? user.email ?? "",
    avatar_key: user.avatar_key ?? null,
    role: mappedRole,
    permission_role: permissionRole,
    client_id: primaryCompany?.id ?? null,
    company_name: summarizeCompanyNames(companyNames),
    company_names: companyNames,
    company_ids: companyIds,
    company_count: companies.length,
    companyNames,
    companyIds,
    companyCount: companies.length,
    companies,
    active: user.active !== false,
    status: user.active === false ? "inactive" : user.status ?? "active",
    job_title: user.job_title ?? null,
    linkedin_url: user.linkedin_url ?? null,
    avatar_url: user.avatar_url ?? null,
    created_by_company_id: user.created_by_company_id ?? null,
    home_company_id: user.home_company_id ?? null,
    user_origin: normalizeUserOrigin(user.user_origin),
    user_scope: normalizeUserScope(user.user_scope),
    allow_multi_company_link: resolveAllowMultiCompanyLink(
      user.allow_multi_company_link,
      user.user_scope,
    ),
    origin_label: resolveUserOriginLabel(user.user_origin),
    profile_kind: profileKind,
  };
}

export async function listAdminUserItems(options?: { companyId?: string | null }) {
  await syncLegacyCompanyUsersToLocalStore();

  const [users, companies, memberships] = await Promise.all([
    listLocalUsers(),
    listLocalCompanies(),
    listLocalMemberships(),
  ]);

  const companyById = new Map(companies.map((company) => [company.id, company]));
  const membershipsByUser = new Map<string, LocalAuthMembership[]>();

  for (const membership of memberships) {
    const list = membershipsByUser.get(membership.userId) ?? [];
    list.push(membership);
    membershipsByUser.set(membership.userId, list);
  }

  const companyId = options?.companyId ?? null;
  const items = users
    .filter((user) => {
      if (!companyId) return true;
      const links = membershipsByUser.get(user.id) ?? [];
      return links.some((link) => link.companyId === companyId);
    })
    .map((user) => buildAdminUserItem(user, membershipsByUser.get(user.id) ?? [], companyById))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));

  return items;
}

export async function getAdminUserItem(userId: string) {
  const items = await listAdminUserItems();
  return items.find((item) => item.id === userId) ?? null;
}
