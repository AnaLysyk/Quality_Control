import type { AuthUser } from "@/contracts/auth";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import type { DashboardCompanyOption, DashboardContextLabels, DashboardContextValue, DashboardScopeKind } from "@/lib/dashboard/types";

export type DashboardUserLike = AuthUser & {
  companySlug?: string | null;
  companySlugs?: string[] | null;
  clientSlug?: string | null;
  clientSlugs?: string[] | null;
  defaultCompanySlug?: string | null;
  defaultClientSlug?: string | null;
};

type ResolveDashboardContextOptions = {
  user?: DashboardUserLike | null;
  companies?: DashboardCompanyOption[];
  selectedCompanySlugs?: string[];
  fixedCompanySlug?: string | null;
  labels?: DashboardContextLabels;
};

function normalizeSlug(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function uniqueSlugs(values: Array<unknown>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeSlug(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function uniqueCompanies(companies: DashboardCompanyOption[]) {
  const seen = new Set<string>();
  return companies.filter((company) => {
    const slug = normalizeSlug(company.slug);
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function resolveScope(user?: DashboardUserLike | null): { scope: DashboardScopeKind; role: string; isElevatedInternal: boolean } {
  const normalizedRole =
    normalizeLegacyRole(user?.permissionRole ?? null) ??
    normalizeLegacyRole(user?.role ?? null) ??
    normalizeLegacyRole(user?.companyRole ?? null);

  const isElevatedInternal =
    user?.isGlobalAdmin === true ||
    user?.is_global_admin === true ||
    user?.globalRole === "global_admin" ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC ||
    normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;

  if (normalizedRole === SYSTEM_ROLES.EMPRESA || normalizedRole === SYSTEM_ROLES.COMPANY_USER) {
    return { scope: "company", role: normalizedRole ?? "company", isElevatedInternal: false };
  }

  if (isElevatedInternal || normalizedRole === SYSTEM_ROLES.TESTING_COMPANY_USER) {
    return { scope: "internal", role: normalizedRole ?? "internal", isElevatedInternal };
  }

  return { scope: "global", role: normalizedRole ?? "unknown", isElevatedInternal };
}

function formatCompanyLabel(companies: DashboardCompanyOption[], selectedSlugs: string[], canSelectAllCompanies: boolean, fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim();
  if (selectedSlugs.length === 0) {
    return canSelectAllCompanies ? "Todas as empresas permitidas" : "Sem empresa definida";
  }

  const selectedCompanies = companies.filter((company) => selectedSlugs.includes(company.slug.toLowerCase()));
  if (selectedCompanies.length === 0) {
    return canSelectAllCompanies ? "Todas as empresas permitidas" : "Sem empresa definida";
  }
  if (canSelectAllCompanies && selectedCompanies.length === companies.length && companies.length > 1) {
    return "Todas as empresas permitidas";
  }
  if (selectedCompanies.length === 1) return selectedCompanies[0].name;
  if (selectedCompanies.length <= 3) return selectedCompanies.map((company) => company.name).join(", ");
  return `${selectedCompanies.length} empresas selecionadas`;
}

export function formatDashboardContextLabel(context: Pick<DashboardContextValue, "allowedCompanies" | "selectedCompanySlugs" | "canSelectAllCompanies" | "labels">) {
  const companyLabel = formatCompanyLabel(
    context.allowedCompanies,
    context.selectedCompanySlugs,
    context.canSelectAllCompanies,
    context.labels.companyLabel,
  );
  const parts = [
    companyLabel,
    context.labels.applicationLabel?.trim() || "Todas as aplicações",
    context.labels.moduleLabel?.trim() || null,
    context.labels.periodLabel?.trim() || "Últimos 30 dias",
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

export function resolveDashboardContext({
  user,
  companies = [],
  selectedCompanySlugs = [],
  fixedCompanySlug = null,
  labels = {},
}: ResolveDashboardContextOptions): DashboardContextValue {
  const { scope, role, isElevatedInternal } = resolveScope(user);
  const availableCompanies = uniqueCompanies(companies.map((company) => ({ ...company, slug: company.slug.toLowerCase() })));
  const explicitCompanySlugs = uniqueSlugs([
    ...(Array.isArray(user?.companySlugs) ? user.companySlugs : []),
    ...(Array.isArray(user?.clientSlugs) ? user.clientSlugs : []),
    user?.companySlug,
    user?.clientSlug,
    user?.defaultCompanySlug,
    user?.defaultClientSlug,
  ]);

  const fixedSlug = normalizeSlug(fixedCompanySlug);
  const companyScopedSlug = fixedSlug ?? explicitCompanySlugs[0] ?? null;

  const allowedCompanies = (() => {
    if (scope === "company") {
      if (companyScopedSlug) {
        const found = availableCompanies.find((company) => company.slug === companyScopedSlug);
        if (found) return [{ ...found, locked: true }];
        return [{ slug: companyScopedSlug, name: labels.companyLabel?.trim() || companyScopedSlug, locked: true }];
      }
      return [];
    }

    if (isElevatedInternal && availableCompanies.length > 0 && explicitCompanySlugs.length === 0) {
      return availableCompanies;
    }

    if (availableCompanies.length === 0) {
      return explicitCompanySlugs.map((slug) => ({ slug, name: slug }));
    }

    if (explicitCompanySlugs.length === 0) {
      return availableCompanies;
    }

    return availableCompanies.filter((company) => explicitCompanySlugs.includes(company.slug));
  })();

  const allowedCompanySlugs = uniqueSlugs(allowedCompanies.map((company) => company.slug));
  const requestedCompanySlugs = fixedSlug
    ? [fixedSlug]
    : uniqueSlugs(selectedCompanySlugs).filter((slug) => allowedCompanySlugs.length === 0 || allowedCompanySlugs.includes(slug));
  const selectedSlugs = (() => {
    if (requestedCompanySlugs.length > 0) return requestedCompanySlugs;
    if (scope === "company") return companyScopedSlug ? [companyScopedSlug] : [];
    if (allowedCompanySlugs.length <= 1) return allowedCompanySlugs;
    return allowedCompanySlugs;
  })();

  const canSelectCompany = scope !== "company" && allowedCompanySlugs.length > 0;
  const canSelectMultipleCompanies = canSelectCompany && allowedCompanySlugs.length > 1;
  const canSelectAllCompanies = canSelectMultipleCompanies;
  const companySelectorMode = scope === "company" ? "locked" : canSelectCompany ? "select" : "hidden";
  const value: DashboardContextValue = {
    userId: user?.id ?? null,
    role,
    scope,
    allowedCompanies,
    allowedCompanySlugs,
    selectedCompanySlugs: selectedSlugs,
    fixedCompanySlug: fixedSlug,
    canSelectCompany,
    canSelectMultipleCompanies,
    canSelectAllCompanies,
    companySelectorMode,
    labels,
    contextLabel: "",
  };

  value.contextLabel = formatDashboardContextLabel(value);
  return value;
}

