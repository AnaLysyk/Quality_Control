import "server-only";

import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { resolveCapabilities } from "@/lib/permissions";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

export type BuiltSessionPayload = {
  userId: string;
  email: string;
  name: string;
  companyId: string | null;
  companySlug: string | null;
  defaultCompanySlug: string | null;
  userOrigin: string | null;
  role: string;
  permissionRole: string;
  globalRole: "global_admin" | null;
  companyRole: string;
  capabilities: string[];
  isGlobalAdmin: boolean;
};

export type BuiltJwtPayload = {
  sub: string;
  email: string;
  role: string;
  permissionRole: string;
  globalRole: "global_admin" | null;
  companyRole: string;
  capabilities: string[];
  companyId: string | null;
  companySlug: string | null;
  defaultCompanySlug: string | null;
  userOrigin: string | null;
  isGlobalAdmin: boolean;
};

export type BuiltSession = {
  session: BuiltSessionPayload;
  jwt: BuiltJwtPayload;
  requestedCompanySlug: string | null;
};

type LocalSessionUser = NonNullable<Awaited<ReturnType<typeof getLocalUserById>>>;
type LocalCompany = Awaited<ReturnType<typeof listLocalCompanies>>[number];
type LocalCompanyLink = Awaited<ReturnType<typeof listLocalLinksForUser>>[number];
type ActiveAssignment = {
  companyId: string;
  projectId: string;
  role: string;
};

function userHasRole(
  user: LocalSessionUser,
  links: LocalCompanyLink[],
  expectedRole: string,
) {
  return (
    normalizeLocalRole(user.role ?? null) === expectedRole ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === expectedRole)
  );
}

function hasDirectCompanyRole(user: LocalSessionUser) {
  const role = normalizeLocalRole(user.role ?? null);
  return role === "empresa" || role === "company_user" || user.user_origin === "client_company";
}

function canAccessCompanyDirectly(user: LocalSessionUser, company: LocalCompany) {
  return Boolean(user.default_company_slug && company.slug === user.default_company_slug);
}

async function listActiveAssignments(userId: string): Promise<ActiveAssignment[]> {
  if (process.env.E2E_USE_JSON === "1") return [];

  try {
    const { prisma } = await import("@/lib/prismaClient");
    return await prisma.projectTeamAssignment.findMany({
      where: { userId, status: "active" },
      select: { companyId: true, projectId: true, role: true },
    });
  } catch {
    return [];
  }
}

function resolveAllowedSessionCompanies(input: {
  companies: LocalCompany[];
  hasUnrestrictedCompanyAccess: boolean;
  isDirectCompanyUser: boolean;
  links: LocalCompanyLink[];
  assignments: ActiveAssignment[];
  user: LocalSessionUser;
  isLeaderTc: boolean;
  hasQaAssignments: boolean;
}) {
  if (input.hasUnrestrictedCompanyAccess) return input.companies;

  if (input.isLeaderTc || input.hasQaAssignments) {
    const expectedRole = input.isLeaderTc ? "leader_tc" : "qa_tc";
    const companyIds = new Set(
      input.assignments
        .filter((assignment) => assignment.role === expectedRole)
        .map((assignment) => assignment.companyId),
    );
    return input.companies.filter((company) => companyIds.has(company.id));
  }

  return input.companies.filter((company) => {
    if (input.links.some((link) => link.companyId === company.id)) return true;
    return input.isDirectCompanyUser && canAccessCompanyDirectly(input.user, company);
  });
}

function resolveRequestedCompany(
  allowedCompanies: LocalCompany[],
  requestedSlug: string,
  shouldBindCompanyContext: boolean,
) {
  if (!shouldBindCompanyContext || !requestedSlug || allowedCompanies.length === 0) return null;
  return allowedCompanies.find((company) => company.slug === requestedSlug) ?? null;
}

function resolveActiveCompany(input: {
  allowedCompanies: LocalCompany[];
  requestedCompany: LocalCompany | null;
  shouldBindCompanyContext: boolean;
  user: LocalSessionUser;
}) {
  if (!input.shouldBindCompanyContext) return null;
  return (
    input.requestedCompany ??
    input.allowedCompanies.find((company) => company.slug === input.user.default_company_slug) ??
    input.allowedCompanies[0] ??
    null
  );
}

function resolveDisplayName(user: LocalSessionUser) {
  return (
    (typeof user.full_name === "string" ? user.full_name.trim() : "") ||
    (typeof user.name === "string" ? user.name.trim() : "") ||
    user.email
  );
}

export async function buildLocalSessionForUser(
  userId: string,
  opts?: { requestedSlug?: string | null },
): Promise<BuiltSession | null> {
  const user = await getLocalUserById(userId);
  if (!user || user.active === false || user.status === "blocked") return null;

  const [links, companies, assignments] = await Promise.all([
    listLocalLinksForUser(user.id),
    listLocalCompanies(),
    listActiveAssignments(user.id),
  ]);

  const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
  const hasTechnicalSupportRole = userHasRole(user, links, "technical_support");
  const hasLeaderTcRole =
    userHasRole(user, links, "leader_tc") ||
    assignments.some((assignment) => assignment.role === "leader_tc");
  const hasQaAssignments = assignments.some((assignment) => assignment.role === "qa_tc");

  // Apenas administrador global e suporte técnico têm visibilidade irrestrita.
  // Líder TC e Usuário TC são escopados pelos vínculos ativos no banco.
  const hasUnrestrictedCompanyAccess = isGlobalAdmin || hasTechnicalSupportRole;
  const shouldBindCompanyContext = !hasUnrestrictedCompanyAccess;
  const allowedCompanies = resolveAllowedSessionCompanies({
    companies,
    hasUnrestrictedCompanyAccess,
    isDirectCompanyUser: hasDirectCompanyRole(user),
    links,
    assignments,
    user,
    isLeaderTc: hasLeaderTcRole,
    hasQaAssignments,
  });

  const requestedSlug = typeof opts?.requestedSlug === "string" ? opts.requestedSlug.trim() : "";
  const requestedCompany = resolveRequestedCompany(
    allowedCompanies,
    requestedSlug,
    shouldBindCompanyContext,
  );
  const activeCompany = resolveActiveCompany({
    allowedCompanies,
    requestedCompany,
    shouldBindCompanyContext,
    user,
  });

  const activeLink = activeCompany
    ? links.find((link) => link.companyId === activeCompany.id) ?? null
    : null;
  const companyRole = normalizeLocalRole(activeLink?.role ?? user.role ?? null);

  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: activeLink?.capabilities ?? null,
  });

  const permissionAccess = await resolvePermissionAccessForUser(user.id);
  const permissionRole = permissionAccess.roleKey;
  const effectiveRole = permissionRole;

  const session: BuiltSessionPayload = {
    userId: user.id,
    email: user.email,
    name: resolveDisplayName(user),
    companyId: shouldBindCompanyContext ? activeCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? activeCompany?.slug ?? null : null,
    defaultCompanySlug: user.default_company_slug ?? null,
    userOrigin: user.user_origin ?? null,
    role: effectiveRole,
    permissionRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    isGlobalAdmin,
  };

  const jwtPayload: BuiltJwtPayload = {
    sub: user.id,
    email: user.email,
    role: effectiveRole,
    permissionRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: shouldBindCompanyContext ? activeCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? activeCompany?.slug ?? null : null,
    defaultCompanySlug: user.default_company_slug ?? null,
    userOrigin: user.user_origin ?? null,
    isGlobalAdmin,
  };

  return {
    session,
    jwt: jwtPayload,
    requestedCompanySlug: requestedCompany?.slug ?? null,
  };
}
