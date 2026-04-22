import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

export type CompanyVisibilityMode = "all" | "linked" | "own";

export type CompanyVisibilityUserLike = {
  clientSlug?: string | null;
  clientSlugs?: string[] | null;
  companyRole?: string | null;
  companySlug?: string | null;
  companySlugs?: string[] | null;
  defaultClientSlug?: string | null;
  default_company_slug?: string | null;
  isGlobalAdmin?: boolean | null;
  is_global_admin?: boolean | null;
  permissionRole?: string | null;
  role?: string | null;
  userOrigin?: string | null;
  user_origin?: string | null;
};

export type CompanyVisibilityLinkLike = {
  companyId: string;
  role?: string | null;
};

export type CompanyVisibilityItem = {
  id: string;
  slug: string;
};

function normalizeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0)
    .filter((value, index, self) => self.indexOf(value) === index);
}

function collectPreferredSlugs(user: CompanyVisibilityUserLike | null | undefined, preferredSlug?: string | null) {
  return uniqueStrings([
    preferredSlug,
    user?.companySlug,
    user?.clientSlug,
    user?.default_company_slug,
    user?.defaultClientSlug,
    ...(Array.isArray(user?.companySlugs) ? user.companySlugs : []),
    ...(Array.isArray(user?.clientSlugs) ? user.clientSlugs : []),
  ]);
}

function collectOwnCompanySlugs(user: CompanyVisibilityUserLike | null | undefined, preferredSlug?: string | null) {
  return uniqueStrings([
    preferredSlug,
    user?.companySlug,
    user?.clientSlug,
    user?.default_company_slug,
    user?.defaultClientSlug,
  ]);
}

export function resolveCompanyVisibilityMode(
  user: CompanyVisibilityUserLike | null | undefined,
): CompanyVisibilityMode {
  const roles = [user?.permissionRole, user?.role, user?.companyRole]
    .map((value) => normalizeLegacyRole(value))
    .filter((value): value is NonNullable<ReturnType<typeof normalizeLegacyRole>> => Boolean(value));

  const isLeader =
    user?.isGlobalAdmin === true ||
    user?.is_global_admin === true ||
    roles.includes(SYSTEM_ROLES.LEADER_TC);
  if (isLeader || roles.includes(SYSTEM_ROLES.TECHNICAL_SUPPORT)) {
    return "all";
  }

  const userOrigin = normalizeValue(user?.userOrigin ?? user?.user_origin);
  const isOwnCompanyScope =
    userOrigin === "client_company" ||
    roles.includes(SYSTEM_ROLES.EMPRESA) ||
    roles.includes(SYSTEM_ROLES.COMPANY_USER) ||
    isInstitutionalCompanyAccount(user as Parameters<typeof isInstitutionalCompanyAccount>[0]);

  if (isOwnCompanyScope) {
    return "own";
  }

  return "linked";
}

export function resolveVisibleCompanies<T extends CompanyVisibilityItem>(
  companies: T[],
  input?: {
    links?: CompanyVisibilityLinkLike[] | null;
    preferredSlug?: string | null;
    user?: CompanyVisibilityUserLike | null;
  },
): T[] {
  const links = input?.links ?? [];
  const mode = resolveCompanyVisibilityMode(input?.user, links);

  if (mode === "all") {
    return companies;
  }

  const linkedCompanyIds = new Set(
    links
      .map((link) => link.companyId)
      .filter((companyId): companyId is string => typeof companyId === "string" && companyId.length > 0),
  );

  if (mode === "linked") {
    const visibleSlugs = new Set(collectPreferredSlugs(input?.user, input?.preferredSlug).map(normalizeValue));
    return companies.filter((company) => linkedCompanyIds.has(company.id) || visibleSlugs.has(normalizeValue(company.slug)));
  }

  const preferredSlugs = collectOwnCompanySlugs(input?.user, input?.preferredSlug);
  for (const slug of preferredSlugs) {
    const match = companies.find((company) => normalizeValue(company.slug) === normalizeValue(slug));
    if (match) return [match];
  }

  const linkedCompany = companies.find((company) => linkedCompanyIds.has(company.id));
  return linkedCompany ? [linkedCompany] : [];
}

export function resolveVisibleCompanySlugs(
  companies: CompanyVisibilityItem[],
  input?: {
    links?: CompanyVisibilityLinkLike[] | null;
    preferredSlug?: string | null;
    user?: CompanyVisibilityUserLike | null;
  },
) {
  return resolveVisibleCompanies(companies, input)
    .map((company) => company.slug)
    .filter((slug, index, self) => slug.length > 0 && self.indexOf(slug) === index);
}
