import { resolveFixedProfileKind } from "@/lib/fixedProfilePresentation";

type CompanyRouteAccessInput = {
  isGlobalAdmin?: boolean | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  userOrigin?: string | null;
  companyCount?: number | null;
  clientSlug?: string | null;
  isInstitutionalCompany?: boolean;
};

export const COMPANY_ROUTE_MODE_COOKIE = "qc_company_route_mode";
export const SHORT_COMPANY_ROUTE_MODE = "short";
export const LONG_COMPANY_ROUTE_MODE = "long";

const RESERVED_APP_ROOTS = new Set([
  "500",
  "admin",
  "api",
  "login",
  "settings",
  "me",
  "profile",
  "home",
  "empresas",
  "dashboard",
  "runs",
  "release",
  "requests",
  "docs",
  "documentos",
  "chamados",
  "meus-chamados",
  "clients",
  "clients-list",
  "integrations",
  "issues",
  "metrics",
  "brand-identity",
  "applications-hub",
  "applications-panel",
  "painel-releases-manuais",
  "painel-releases-manuais-autenticado",
  "kanban-it",
  "health",
  "chat",
]);

function normalizeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeRoute(route?: string | null) {
  const value = (route ?? "").trim();
  if (!value) return "home";
  return value.replace(/^\/+/, "").replace(/\/+$/, "") || "home";
}

export function isReservedAppRoot(segment?: string | null) {
  return RESERVED_APP_ROOTS.has(normalizeValue(segment));
}

export function shouldUseShortCompanyRoutes(input?: CompanyRouteAccessInput | null) {
  if (!input || input.isGlobalAdmin) return false;

  const profileKind = resolveFixedProfileKind({
    permissionRole: input.permissionRole ?? null,
    role: input.role ?? null,
    companyRole: input.companyRole ?? null,
    userOrigin: input.userOrigin ?? null,
    companyCount: input.companyCount ?? null,
    clientSlug: input.clientSlug ?? null,
    isInstitutionalCompany: input.isInstitutionalCompany === true,
  });

  if (profileKind === "empresa") return true;
  return profileKind === "company_user" && normalizeValue(input.userOrigin) === "client_company";
}

export function resolveCompanyRouteMode(input?: CompanyRouteAccessInput | null) {
  return shouldUseShortCompanyRoutes(input) ? SHORT_COMPANY_ROUTE_MODE : LONG_COMPANY_ROUTE_MODE;
}

export function buildCompanyPath(
  companySlug: string | null | undefined,
  route?: string | null,
  options?: { short?: boolean; fallback?: string },
) {
  const normalizedSlug = (companySlug ?? "").trim();
  if (!normalizedSlug) return options?.fallback ?? "/empresas";

  const encodedSlug = encodeURIComponent(normalizedSlug);
  const normalizedRoute = normalizeRoute(route);
  const basePath = options?.short ? `/${encodedSlug}` : `/empresas/${encodedSlug}`;
  return `${basePath}/${normalizedRoute}`;
}

export function buildCompanyPathForAccess(
  companySlug: string | null | undefined,
  route: string | null | undefined,
  input?: CompanyRouteAccessInput | null,
  options?: { fallback?: string },
) {
  return buildCompanyPath(companySlug, route, {
    short: shouldUseShortCompanyRoutes(input),
    fallback: options?.fallback,
  });
}

export function rewriteShortCompanyPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const [companySlug, ...rest] = parts;
  if (!companySlug || isReservedAppRoot(companySlug)) return null;

  return buildCompanyPath(companySlug, rest.join("/") || "home", { short: false });
}

export function shortenCompanyPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "empresas" || !parts[1]) return null;

  const [, companySlug, ...rest] = parts;
  return buildCompanyPath(companySlug, rest.join("/") || "home", { short: true });
}
