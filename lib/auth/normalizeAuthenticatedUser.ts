import type { AuthCompany, AuthUser } from "@/contracts/auth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

type UnknownRecord = Record<string, unknown>;

export type AuthenticatedUserLike = Partial<AuthUser> &
  UnknownRecord & {
    companySlug?: string | null;
    companySlugs?: string[] | null;
    default_company_slug?: string | null;
    roleNames?: unknown;
    companies?: unknown;
    clients?: unknown;
    company?: unknown;
    client?: unknown;
    tenant?: unknown;
    organization?: unknown;
    organizations?: unknown;
    permissionKeys?: unknown;
    user_origin?: string | null;
    is_global_admin?: boolean | null;
  };

export type NormalizedAuthenticatedCompany = {
  id?: string;
  slug: string;
  name?: string;
};

export type NormalizedAuthenticatedUser = {
  companySlugs: string[];
  companies: NormalizedAuthenticatedCompany[];
  roles: string[];
  permissions: string[];
  primaryCompanySlug: string | null;
  defaultCompanySlug: string | null;
  companyCount: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSlug(value: unknown): string | null {
  const trimmed = readString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const candidate = typeof value === "string" ? value.trim() : "";
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

function normalizeCompanyRecord(value: unknown): NormalizedAuthenticatedCompany | null {
  if (!isRecord(value)) return null;

  const slug = normalizeSlug(
    value.slug ?? value.clientSlug ?? value.companySlug ?? value.client_slug ?? value.company_slug,
  );
  if (!slug) return null;

  const normalized: NormalizedAuthenticatedCompany = { slug };
  const id = readString(value.id ?? value.clientId ?? value.companyId ?? value.client_id ?? value.company_id);
  const name = readString(value.name ?? value.company_name ?? value.companyName ?? value.label ?? value.title);

  if (id) normalized.id = id;
  if (name) normalized.name = name;
  return normalized;
}

function collectCompanyCandidates(value: unknown): NormalizedAuthenticatedCompany[] {
  const seen = new Set<string>();
  const out: NormalizedAuthenticatedCompany[] = [];

  const add = (company: NormalizedAuthenticatedCompany | null) => {
    if (!company) return;
    const slug = normalizeSlug(company.slug);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push({
      ...(company.id ? { id: company.id } : {}),
      slug,
      ...(company.name ? { name: company.name } : {}),
    });
  };

  const visit = (candidate: unknown) => {
    if (candidate == null) return;
    if (typeof candidate === "string") {
      add({ slug: candidate });
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (!isRecord(candidate)) return;

    add(normalizeCompanyRecord(candidate));

    for (const key of ["company", "client", "tenant", "organization"]) {
      if (key in candidate) visit(candidate[key]);
    }
  };

  visit(value);
  return out;
}

function collectRoleCandidates(value: unknown): string[] {
  const out: string[] = [];

  const push = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const normalized = normalizeLegacyRole(candidate) ?? candidate.trim().toLowerCase();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        push(item);
        continue;
      }
      if (isRecord(item)) {
        push(item.role ?? item.key ?? item.name ?? item.slug ?? item.value);
      }
    }
    return out;
  }

  push(value);
  return out;
}

function collectPermissionCandidates(value: unknown): string[] {
  const out: string[] = [];

  const push = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const trimmed = candidate.trim().toLowerCase();
    if (!trimmed) return;
    if (!out.includes(trimmed)) out.push(trimmed);
  };

  const visit = (candidate: unknown) => {
    if (candidate == null) return;
    if (typeof candidate === "string") {
      push(candidate);
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (!isRecord(candidate)) return;

    for (const [key, value] of Object.entries(candidate)) {
      push(key);
      visit(value);
    }
  };

  visit(value);
  return out;
}

function mergeCompanyCollections(...collections: NormalizedAuthenticatedCompany[][]) {
  const seen = new Set<string>();
  const out: NormalizedAuthenticatedCompany[] = [];
  for (const collection of collections) {
    for (const company of collection) {
      const slug = normalizeSlug(company.slug);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        ...(company.id ? { id: company.id } : {}),
        slug,
        ...(company.name ? { name: company.name } : {}),
      });
    }
  }
  return out;
}

export function normalizeAuthenticatedUser(
  user: AuthenticatedUserLike | null | undefined,
  companies: AuthCompany[] = [],
): NormalizedAuthenticatedUser {
  const raw: UnknownRecord = isRecord(user) ? user : {};

  const companiesFromResponse = companies.map((company) =>
    normalizeCompanyRecord({
      id: company.id,
      name: company.name,
      slug: company.slug,
    }),
  );

  const companiesFromUser = mergeCompanyCollections(
    collectCompanyCandidates(raw.companySlug),
    collectCompanyCandidates(raw.clientSlug),
    collectCompanyCandidates(raw.defaultClientSlug),
    collectCompanyCandidates(raw.default_company_slug),
    collectCompanyCandidates(raw.companySlugs),
    collectCompanyCandidates(raw.clientSlugs),
    collectCompanyCandidates(raw.companies),
    collectCompanyCandidates(raw.clients),
    collectCompanyCandidates(raw.company),
    collectCompanyCandidates(raw.client),
    collectCompanyCandidates(raw.tenant),
    collectCompanyCandidates(raw.organization),
    collectCompanyCandidates(raw.organizations),
  );

  const normalizedCompanies = mergeCompanyCollections(companiesFromResponse.filter((value): value is NormalizedAuthenticatedCompany => Boolean(value)), companiesFromUser);

  const directCompanySlugs = uniqueStrings(
    [
      normalizeSlug(raw.clientSlug),
      normalizeSlug(raw.companySlug),
      normalizeSlug(raw.defaultClientSlug),
      normalizeSlug(raw.default_company_slug),
    ].filter((value): value is string => Boolean(value)),
  );
  const companySlugs = uniqueStrings([
    ...directCompanySlugs,
    ...collectCompanyCandidates(raw.clientSlugs).map((company) => company.slug),
    ...collectCompanyCandidates(raw.companySlugs).map((company) => company.slug),
    ...normalizedCompanies.map((company) => company.slug),
  ]);

  const roles = uniqueStrings([
    ...collectRoleCandidates(raw.roles),
    ...collectRoleCandidates(raw.roleNames),
    ...collectRoleCandidates(raw.role),
    ...collectRoleCandidates(raw.permissionRole),
    ...collectRoleCandidates(raw.companyRole),
  ]);

  const permissions = uniqueStrings([
    ...collectPermissionCandidates(raw.capabilities),
    ...collectPermissionCandidates(raw.permissions),
    ...collectPermissionCandidates(raw.permissionKeys),
  ]);

  const defaultCompanySlug = normalizeSlug(raw.defaultClientSlug) ?? normalizeSlug(raw.default_company_slug) ?? null;
  const primaryCompanySlug = companySlugs[0] ?? normalizedCompanies[0]?.slug ?? defaultCompanySlug ?? null;

  return {
    companySlugs,
    companies: normalizedCompanies,
    roles,
    permissions,
    primaryCompanySlug,
    defaultCompanySlug,
    companyCount: companySlugs.length,
  };
}

export function resolveNormalizedCompanySlugs(
  user: AuthenticatedUserLike | null | undefined,
  companies: AuthCompany[] = [],
) {
  return normalizeAuthenticatedUser(user, companies).companySlugs;
}

export function resolvePrimaryCompanySlug(
  user: AuthenticatedUserLike | null | undefined,
  companies: AuthCompany[] = [],
) {
  return normalizeAuthenticatedUser(user, companies).primaryCompanySlug;
}

export function resolveDefaultCompanySlug(
  user: AuthenticatedUserLike | null | undefined,
  companies: AuthCompany[] = [],
) {
  return normalizeAuthenticatedUser(user, companies).defaultCompanySlug;
}

export type CompanyAccessStatus = "loading" | "error" | "unauthenticated" | "allowed" | "denied" | "not_found";

export type CompanyAccessResolution = {
  status: CompanyAccessStatus;
  normalizedUser: NormalizedAuthenticatedUser | null;
  routeSlug: string | null;
  matchedCompany: NormalizedAuthenticatedCompany | null;
  fallbackSlug: string | null;
  errorMessage: string | null;
};

export function resolveCompanyAccess(input: {
  user: AuthenticatedUserLike | null | undefined;
  companies: AuthCompany[];
  slug?: string | null;
  loading: boolean;
  error?: string | null;
}): CompanyAccessResolution {
  if (input.loading) {
    return {
      status: "loading",
      normalizedUser: null,
      routeSlug: null,
      matchedCompany: null,
      fallbackSlug: null,
      errorMessage: null,
    };
  }

  if (input.error) {
    return {
      status: "error",
      normalizedUser: null,
      routeSlug: normalizeSlug(input.slug),
      matchedCompany: null,
      fallbackSlug: null,
      errorMessage: input.error,
    };
  }

  if (!input.user) {
    return {
      status: "unauthenticated",
      normalizedUser: null,
      routeSlug: normalizeSlug(input.slug),
      matchedCompany: null,
      fallbackSlug: null,
      errorMessage: null,
    };
  }

  const normalizedUser = normalizeAuthenticatedUser(input.user, input.companies);
  const routeSlug = normalizeSlug(input.slug);
  const matchedCompany = routeSlug
    ? normalizedUser.companies.find((company) => company.slug === routeSlug) ?? null
    : null;
  const isPrivileged =
    normalizedUser.roles.includes(SYSTEM_ROLES.LEADER_TC) ||
    normalizedUser.roles.includes(SYSTEM_ROLES.TECHNICAL_SUPPORT) ||
    (input.user.isGlobalAdmin === true) ||
    (input.user.is_global_admin === true);
  const fallbackSlug = normalizedUser.primaryCompanySlug;

  if (!routeSlug) {
    return {
      status: "not_found",
      normalizedUser,
      routeSlug,
      matchedCompany,
      fallbackSlug,
      errorMessage: null,
    };
  }

  if (isPrivileged) {
    return {
      status: "allowed",
      normalizedUser,
      routeSlug,
      matchedCompany,
      fallbackSlug,
      errorMessage: null,
    };
  }

  if (normalizedUser.companySlugs.includes(routeSlug)) {
    return {
      status: "allowed",
      normalizedUser,
      routeSlug,
      matchedCompany,
      fallbackSlug,
      errorMessage: null,
    };
  }

  return {
    status: "denied",
    normalizedUser,
    routeSlug,
    matchedCompany,
    fallbackSlug,
    errorMessage: null,
  };
}
