import type { FixedProfileKind } from "@/lib/fixedProfilePresentation";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

type CompanyRouteAccessInput = {
  isGlobalAdmin?: boolean | null;
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  userOrigin?: string | null;
  companyCount?: number | null;
  clientSlug?: string | null;
  defaultClientSlug?: string | null;
  isInstitutionalCompany?: boolean;
};

export function resolveCompanyRouteAccessInput(input: {
  user?: Record<string, unknown> | null;
}): CompanyRouteAccessInput {
  const user = (input?.user ?? {}) as Record<string, unknown>;
  const clientSlug = readLowerSlug(user, [
    "clientSlug",
    "client_slug",
    "companySlug",
    "company_slug",
  ]);
  const defaultClientSlug = readLowerSlug(user, ["defaultClientSlug", "default_client_slug"]);

  return {
    isGlobalAdmin: typeof user.isGlobalAdmin === "boolean" ? user.isGlobalAdmin : null,
    permissionRole: readString(user, "permissionRole"),
    role: readString(user, "role"),
    companyRole: readString(user, "companyRole"),
    userOrigin: readString(user, "user_origin") ?? readString(user, "userOrigin"),
    companyCount: resolveCompanyCount(user, clientSlug),
    clientSlug,
    defaultClientSlug,
    isInstitutionalCompany: typeof user.isInstitutionalCompany === "boolean" ? user.isInstitutionalCompany : undefined,
  };
}

export type ParsedCompanyRoute = {
  kind: "internal" | FixedProfileKind;
  targetSlug: string;
  route: string;
  prefixSlug: string | null;
};

export const COMPANY_ROUTE_MODE_COOKIE = "qc_company_route_mode";
export const SHORT_COMPANY_ROUTE_MODE = "short";
export const LONG_COMPANY_ROUTE_MODE = "long";

export const COMPANY_ROUTE_PREFIXES: Record<
  Exclude<FixedProfileKind, "empresa" | "company_user">,
  string
> = {
  leader_tc: "lider-tc",
  technical_support: "suporte",
  testing_company_user: "user-tc",
};

const PREFIX_TO_PROFILE_KIND = new Map<string, Exclude<FixedProfileKind, "empresa" | "company_user">>([
  [COMPANY_ROUTE_PREFIXES.leader_tc, "leader_tc"],
  [COMPANY_ROUTE_PREFIXES.technical_support, "technical_support"],
  [COMPANY_ROUTE_PREFIXES.testing_company_user, "testing_company_user"],
]);

const RESERVED_APP_ROOTS = new Set([
  "500",
  "admin",
  "agenda",
  "api",
  "automacoes",
  "casos-de-teste",
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
  "brain",
  "applications-hub",
  "applications-panel",
  "painel-releases-manuais",
  "painel-releases-manuais-autenticado",
  "kanban-it",
  "health",
  "chat",
  "operacao",
  "operacoes",
]);

const COMPANY_SECTION_ROOTS = new Set([
  "home",
  "dashboard",
  "metrics",
  "aplicacoes",
  "aplicações",
  "planos-de-teste",
  "runs",
  "defeitos",
  "chamados",
  "docs",
  "documentos",
  "perfil",
  "profile",
  "admin",
  "releases",
]);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeSlug(value?: string | null) {
  const normalized = (value ?? "").trim();
  return normalized || null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readLowerSlug(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const normalized = normalizeSlug(readString(record, key));
    if (normalized) return normalized.toLowerCase();
  }
  return null;
}

function resolveCompanyCount(record: Record<string, unknown>, clientSlug?: string | null) {
  return typeof record.companyCount === "number" ? record.companyCount : clientSlug ? 1 : 0;
}

function normalizeRoute(route?: string | null) {
  const value = (route ?? "").trim();
  if (!value) return "home";
  return value.replace(/^\/+/, "").replace(/\/+$/, "") || "home";
}

function encodePathSegments(segments: string[]) {
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function buildPathFromSegments(segments: string[], route?: string | null) {
  const normalizedRoute = normalizeRoute(route);
  const routeSegments = normalizedRoute.split("/").filter(Boolean);
  return encodePathSegments([...segments, ...routeSegments]);
}

function resolveLegacyRouteRoles(input: CompanyRouteAccessInput) {
  return {
    permissionRole: normalizeLegacyRole(input.permissionRole ?? null),
    role: normalizeLegacyRole(input.role ?? null),
    companyRole: normalizeLegacyRole(input.companyRole ?? null),
  };
}

function hasLegacyRouteRole(
  roles: ReturnType<typeof resolveLegacyRouteRoles>,
  expectedRole: FixedProfileKind,
) {
  return Object.values(roles).includes(expectedRole);
}

function resolveProfileKind(input?: CompanyRouteAccessInput | null): FixedProfileKind | null {
  if (!input) return null;

  const roles = resolveLegacyRouteRoles(input);
  const origin = normalizeValue(input.userOrigin);

  // Internal profiles from testing_company always use long /empresas/ routes
  if (origin === "testing_company") return null;

  if (input.isGlobalAdmin === true || hasLegacyRouteRole(roles, SYSTEM_ROLES.LEADER_TC)) {
    return SYSTEM_ROLES.LEADER_TC;
  }

  // companyRole reflects the user's role for the active company in their session.
  // It must take priority over permissionRole (which is system-wide and can include
  // cross-company TS links) to avoid routing empresa accounts through /suporte/.
  if (input.isInstitutionalCompany === true || roles.companyRole === SYSTEM_ROLES.EMPRESA) {
    return SYSTEM_ROLES.EMPRESA;
  }

  if (hasLegacyRouteRole(roles, SYSTEM_ROLES.TECHNICAL_SUPPORT)) {
    return SYSTEM_ROLES.TECHNICAL_SUPPORT;
  }

  if (roles.permissionRole === SYSTEM_ROLES.EMPRESA || roles.role === SYSTEM_ROLES.EMPRESA) {
    return SYSTEM_ROLES.EMPRESA;
  }

  if (
    origin === "client_company" ||
    hasLegacyRouteRole(roles, SYSTEM_ROLES.COMPANY_USER)
  ) {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  return SYSTEM_ROLES.TESTING_COMPANY_USER;
}

function resolveCompanyUserPrefixSlug(targetSlug: string, input?: CompanyRouteAccessInput | null) {
  const candidates = [
    normalizeSlug(input?.defaultClientSlug),
    normalizeSlug(input?.clientSlug),
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => normalizeValue(candidate) !== normalizeValue(targetSlug)) ?? null;
}

function splitPathname(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => safeDecode(part));
}

export function isReservedAppRoot(segment?: string | null) {
  return RESERVED_APP_ROOTS.has(normalizeValue(segment));
}

export function isCompanySectionRoot(segment?: string | null) {
  return COMPANY_SECTION_ROOTS.has(normalizeValue(segment));
}

export function shouldUseShortCompanyRoutes(input?: CompanyRouteAccessInput | null) {
  return resolveProfileKind(input) !== null;
}

export function resolveCompanyRouteMode(input?: CompanyRouteAccessInput | null) {
  return shouldUseShortCompanyRoutes(input) ? SHORT_COMPANY_ROUTE_MODE : LONG_COMPANY_ROUTE_MODE;
}

export function buildCompanyPath(
  companySlug: string | null | undefined,
  route?: string | null,
  options?: { short?: boolean; fallback?: string },
) {
  const normalizedSlug = normalizeSlug(companySlug);
  if (!normalizedSlug) return options?.fallback ?? "/empresas";

  const normalizedRoute = normalizeRoute(route);
  const baseSegments = options?.short ? [normalizedSlug] : ["empresas", normalizedSlug];
  return buildPathFromSegments(baseSegments, normalizedRoute);
}

export function buildCompanyPathForAccess(
  companySlug: string | null | undefined,
  route: string | null | undefined,
  input?: CompanyRouteAccessInput | null,
  options?: { fallback?: string },
) {
  const normalizedSlug = normalizeSlug(companySlug);
  if (!normalizedSlug) return options?.fallback ?? "/empresas";

  const profileKind = resolveProfileKind(input);
  if (!profileKind) {
    return buildCompanyPath(normalizedSlug, route, { short: false, fallback: options?.fallback });
  }

  if (profileKind === "empresa") {
    return buildPathFromSegments([normalizedSlug], route);
  }

  if (profileKind === "company_user") {
    const prefixSlug = resolveCompanyUserPrefixSlug(normalizedSlug, input);
    return prefixSlug
      ? buildPathFromSegments([prefixSlug, normalizedSlug], route)
      : buildPathFromSegments([normalizedSlug], route);
  }

  const prefix = COMPANY_ROUTE_PREFIXES[profileKind];
  const effectiveRoute = profileKind === "technical_support" && normalizeRoute(route) === "home" ? "dashboard" : route;
  return buildPathFromSegments([prefix, normalizedSlug], effectiveRoute);
}

export function parseCompanyRoutePathname(pathname: string): ParsedCompanyRoute | null {
  const parts = splitPathname(pathname);
  if (parts.length === 0) return null;

  if (normalizeValue(parts[0]) === "empresas" && parts[1]) {
    return {
      kind: "internal",
      targetSlug: parts[1],
      route: normalizeRoute(parts.slice(2).join("/")),
      prefixSlug: null,
    };
  }

  const prefixedKind = PREFIX_TO_PROFILE_KIND.get(normalizeValue(parts[0]));
  if (prefixedKind && parts[1]) {
    return {
      kind: prefixedKind,
      targetSlug: parts[1],
      route: normalizeRoute(parts.slice(2).join("/")),
      prefixSlug: parts[0],
    };
  }

  if (isReservedAppRoot(parts[0])) return null;

  if (parts.length === 1) {
    return {
      kind: "empresa",
      targetSlug: parts[0],
      route: "home",
      prefixSlug: null,
    };
  }

  if (isCompanySectionRoot(parts[1])) {
    return {
      kind: "empresa",
      targetSlug: parts[0],
      route: normalizeRoute(parts.slice(1).join("/")),
      prefixSlug: null,
    };
  }

  if (!isReservedAppRoot(parts[1])) {
    return {
      kind: "company_user",
      targetSlug: parts[1],
      route: normalizeRoute(parts.slice(2).join("/")),
      prefixSlug: parts[0],
    };
  }

  return null;
}

export function getCompanyRouteTargetSlug(pathname: string) {
  return parseCompanyRoutePathname(pathname)?.targetSlug ?? null;
}

export function getCompanyRouteSection(pathname: string) {
  const parsed = parseCompanyRoutePathname(pathname);
  if (!parsed) return null;
  return normalizeRoute(parsed.route).split("/")[0] ?? "home";
}

export function isCompanyRoutePathname(pathname: string) {
  return parseCompanyRoutePathname(pathname) !== null;
}

export function isCompanyHomePathname(pathname: string) {
  const parsed = parseCompanyRoutePathname(pathname);
  return parsed?.route === "home";
}

export function rewriteShortCompanyPathname(pathname: string) {
  const parsed = parseCompanyRoutePathname(pathname);
  if (!parsed || parsed.kind === "internal") return null;
  return buildCompanyPath(parsed.targetSlug, parsed.route, { short: false });
}

export function shortenCompanyPathname(pathname: string) {
  const parsed = parseCompanyRoutePathname(pathname);
  if (!parsed || parsed.kind !== "internal") return null;
  return buildCompanyPath(parsed.targetSlug, parsed.route, { short: true });
}

export function canonicalizeCompanyPathnameForAccess(
  pathname: string,
  input?: CompanyRouteAccessInput | null,
) {
  const parsed = parseCompanyRoutePathname(pathname);
  if (!parsed || parsed.kind !== "internal") return null;
  return buildCompanyPathForAccess(parsed.targetSlug, parsed.route, input);
}
