import "server-only";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeGlobalRole,
  normalizeLocalRole,
} from "@/lib/auth/localStore";
import { hasForcedGlobalAccessForUser } from "@/lib/auth/specialAccess";
import { resolvePermissionRoleForUser } from "@/lib/adminUsers";
import { resolveCapabilities } from "@/lib/permissions";
import { getJwtSecret } from "@/lib/auth/jwtSecret";
import { deriveProjectScope, type AccessAssignment, type ProjectScope } from "./accessAssignment";

export type SessionPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: string;
  permissionRole?: string;
  globalRole?: string;
  companyRole?: string;
  capabilities?: string[];
  companyId?: string;
  companySlug?: string;
  isGlobalAdmin?: boolean;
};

export type AccessContext = {
  userId: string;
  email: string;
  user?: string | null;
  userOrigin?: string | null;
  isGlobalAdmin: boolean;
  role: string | null;
  permissionRole: string | null;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  companyId: string | null;
  companySlug: string | null;
  // Campo legado: calculado exatamente como antes da Etapa 2.3A (a partir
  // de allowedCompanies), sem depender de `assignments`. Não usar para
  // validar pares empresa+projeto — usar
  // isCompanyProjectPairAllowed(assignments/projectScope, ...) de
  // lib/auth/accessAssignment.ts.
  companySlugs: string[];
  // Campo legado: DELIBERADAMENTE ainda com a semântica antiga (inclusive a
  // ambiguidade de Membership.allowedProjectIds=[] == "sem restrição
  // dentro da empresa", conforme o comentário do schema Prisma) — não foi
  // migrado para o novo contrato nesta etapa para não alterar
  // silenciosamente o comportamento vivo de rotas que já consomem este
  // campo hoje. O novo contrato (assignments/projectScope) já representa
  // essa mesma situação corretamente como projectAccess="all_company_projects".
  // deriveLegacyAllowedProjectIds (accessAssignment.ts) calcula a versão
  // correta a partir de `assignments`, mas só passa a alimentar este campo
  // quando operationalContext, /api/me, /api/auth/me e /api/projects
  // migrarem. Nenhum helper novo (isCompanyAllowed/isCompanyProjectPairAllowed)
  // usa este campo nem interpreta ausência de assignments como unrestricted.
  allowedProjectIds: string[] | null;
  // Contrato relacional oficial (Etapa 2.3A): pares empresa+projeto
  // preservados, sem achatamento, com projectAccess explícito
  // (company_only | selected_projects | all_company_projects). Representa
  // só vínculos reais — sem entradas sintéticas mesmo para acesso global
  // (nesse caso o escopo vem de projectScope="unrestricted"). Ainda não
  // consumido por operationalContext/rotas nesta etapa.
  assignments: AccessAssignment[];
  projectScope: ProjectScope;
};

type ActiveProjectAssignment = {
  companyId: string;
  projectId: string;
  projectSlug: string | null;
  projectName: string | null;
  role: string;
};

const SESSION_COOKIE = "session_id";
const ACCESS_COOKIE = "access_token";
const LEGACY_AUTH_COOKIE = "auth_token";

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      const value = rest.join("=").trim();
      return value.length ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }
  return null;
}

function safeJsonParse<T>(raw: unknown): T | null {
  try {
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return (raw as T) ?? null;
  } catch {
    return null;
  }
}

async function readSessionFromRedis(sessionId: string): Promise<SessionPayload | null> {
  if (!sessionId) return null;
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    return safeJsonParse<SessionPayload>(raw);
  } catch {
    return null;
  }
}

function parseJwtSession(token: string, secret: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      userId?: string;
      email?: string;
      role?: string;
      permissionRole?: string;
      globalRole?: string;
      companyRole?: string;
      capabilities?: string[];
      companyId?: string;
      companySlug?: string;
      isGlobalAdmin?: boolean;
    };

    return {
      userId: typeof payload.userId === "string" ? payload.userId : undefined,
      id: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      permissionRole: typeof payload.permissionRole === "string" ? payload.permissionRole : undefined,
      globalRole: typeof payload.globalRole === "string" ? payload.globalRole : undefined,
      companyRole: typeof payload.companyRole === "string" ? payload.companyRole : undefined,
      capabilities: Array.isArray(payload.capabilities) ? payload.capabilities : undefined,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      companySlug: typeof payload.companySlug === "string" ? payload.companySlug : undefined,
      isGlobalAdmin: payload.isGlobalAdmin === true,
    };
  } catch {
    return null;
  }
}

async function listActiveProjectAssignments(userId: string): Promise<ActiveProjectAssignment[]> {
  if (process.env.E2E_USE_JSON === "1") return [];

  try {
    const { prisma } = await import("@/lib/prismaClient");
    const rows = await prisma.projectTeamAssignment.findMany({
      where: { userId, status: "active" },
      select: {
        companyId: true,
        projectId: true,
        role: true,
        project: { select: { slug: true, name: true } },
      },
    });
    return rows.map((row) => ({
      companyId: row.companyId,
      projectId: row.projectId,
      role: row.role,
      projectSlug: row.project?.slug ?? null,
      projectName: row.project?.name ?? null,
    }));
  } catch {
    // A autenticação não deve cair quando o banco estiver temporariamente indisponível.
    return [];
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

type ResolvedMembershipProject = {
  id: string;
  companyId: string;
  slug: string | null;
  name: string | null;
};

// Consulta em lote (uma query, não uma por projeto) dos projetos referidos
// por Membership.allowedProjectIds em qualquer vínculo do usuário. Usada
// para resolver slug/name e, principalmente, para confirmar a empresa REAL
// de cada projectId antes de virar um assignment (Correção 4): um
// Membership.allowedProjectIds corrompido apontando pra projeto de outra
// empresa nunca deve virar acesso.
async function resolveMembershipProjectsByIds(projectIds: string[]): Promise<Map<string, ResolvedMembershipProject>> {
  const uniqueIds = unique(projectIds);
  if (uniqueIds.length === 0) return new Map();
  if (process.env.E2E_USE_JSON === "1") return new Map();

  try {
    const { prisma } = await import("@/lib/prismaClient");
    const rows = await prisma.project.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, companyId: true, slug: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  } catch {
    // Mesma política de listActiveProjectAssignments: banco indisponível
    // não derruba a autenticação. Sem resolução, esses IDs simplesmente não
    // viram assignment (fail-closed, não fail-open).
    return new Map();
  }
}

export async function getSessionPayload(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";

  // Preferimos um access token explícito (Bearer / cookie access_token).
  // Se existir, mas estiver inválido/expirado, não fazemos fallback para session_id.
  const bearer = extractBearerToken(req);
  const accessCookie = readCookieValue(cookieHeader, ACCESS_COOKIE);
  const legacyCookie = readCookieValue(cookieHeader, LEGACY_AUTH_COOKIE);
  const token = bearer || accessCookie || legacyCookie;
  if (token) {
    const secret = getJwtSecret();
    if (!secret) return await readSessionFromRedis(token);
    return parseJwtSession(token, secret);
  }

  const sessionId = readCookieValue(cookieHeader, SESSION_COOKIE);
  if (sessionId) {
    const fromRedis = await readSessionFromRedis(sessionId);
    if (fromRedis) return fromRedis;
  }

  return null;
}

export async function getAccessContext(req: Request): Promise<AccessContext | null> {
  const session = await getSessionPayload(req);
  if (!session) return null;

  const userId = session.userId ?? session.id;
  if (!userId) return null;

  const [user, links, companies, projectAssignments] = await Promise.all([
    getLocalUserById(userId),
    listLocalLinksForUser(userId),
    listLocalCompanies(),
    listActiveProjectAssignments(userId),
  ]);

  if (!user || user.active === false || user.status === "blocked") return null;

  const hasForcedLeaderAccess = hasForcedGlobalAccessForUser({
    id: user.id,
    email: user.email,
    user: user.user,
  });

  const resolvedGlobalRole = normalizeGlobalRole(user.globalRole ?? session.globalRole ?? null);
  const sessionRole = (session.role ?? "").trim().toLowerCase();
  const userRole = normalizeLocalRole(user.role ?? null);

  // A lista especial preserva o perfil/permissões de Líder TC, mas não concede
  // visibilidade global de empresas e projetos.
  const isGlobalAdmin =
    !hasForcedLeaderAccess &&
    (resolvedGlobalRole === "global_admin" ||
      user.is_global_admin === true ||
      session.isGlobalAdmin === true);

  const hasTechnicalSupportRole =
    sessionRole === "technical_support" ||
    userRole === "technical_support" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "technical_support");

  const hasLeaderTcRole =
    hasForcedLeaderAccess ||
    sessionRole === "leader_tc" ||
    userRole === "leader_tc" ||
    links.some((link) => normalizeLocalRole(link.role ?? null) === "leader_tc") ||
    projectAssignments.some((assignment) => assignment.role === "leader_tc");

  const hasQaTcAssignments = projectAssignments.some((assignment) => assignment.role === "qa_tc");
  const hasUnrestrictedCompanyAccess = isGlobalAdmin || hasTechnicalSupportRole;
  const shouldBindCompanyContext = !hasUnrestrictedCompanyAccess;

  const roleAssignments = hasLeaderTcRole
    ? projectAssignments.filter((assignment) => assignment.role === "leader_tc")
    : hasQaTcAssignments
      ? projectAssignments.filter((assignment) => assignment.role === "qa_tc")
      : [];
  const assignedCompanyIds = new Set(roleAssignments.map((assignment) => assignment.companyId));

  const isDirectCompanyUser =
    userRole === "empresa" ||
    userRole === "company_user" ||
    user.user_origin === "client_company";

  // Mesmo conjunto de empresas permitidas de sempre (inalterado nesta etapa,
  // para não regredir companySlugs) — só a representação como `assignments`
  // é nova.
  const allowedCompanies = hasUnrestrictedCompanyAccess
    ? companies
    : hasLeaderTcRole || hasQaTcAssignments
      ? companies.filter((company) => assignedCompanyIds.has(company.id))
      : companies.filter((company) => {
          if (links.some((link) => link.companyId === company.id)) return true;
          if (!isDirectCompanyUser) return false;
          if (session.companyId && company.id === session.companyId) return true;
          if (session.companySlug && company.slug === session.companySlug) return true;
          if (user.default_company_slug && company.slug === user.default_company_slug) return true;
          return false;
        });

  const primaryCompany = shouldBindCompanyContext
    ? allowedCompanies.find((company) => company.id === session.companyId) ??
      allowedCompanies.find((company) => company.slug === session.companySlug) ??
      allowedCompanies.find((company) => company.slug === user.default_company_slug) ??
      allowedCompanies[0] ??
      null
    : null;

  const primaryLink = primaryCompany
    ? links.find((link) => link.companyId === primaryCompany.id) ?? null
    : null;

  const rawRole = session.companyRole ?? primaryLink?.role ?? user.role ?? null;
  const companyRole = normalizeLocalRole(rawRole);
  const permissionRole = hasForcedLeaderAccess
    ? "leader_tc"
    : resolvePermissionRoleForUser(user, links);
  const capabilities = resolveCapabilities({
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    membershipCapabilities: primaryLink?.capabilities ?? session.capabilities ?? null,
  });
  const effectiveRole = hasForcedLeaderAccess ? "leader_tc" : permissionRole;

  const isProjectScopedRole =
    companyRole === "company_user" || companyRole === "testing_company_user";

  // ── Campos legados: calculados exatamente como antes da Etapa 2.3A ────
  // (Correção 5: não alterar a semântica viva antes da migração dos
  // consumidores.) companySlugs vem de allowedCompanies, não de
  // `assignments`. allowedProjectIds usa a mesma fórmula de sempre,
  // inclusive a ambiguidade de Membership.allowedProjectIds=[] == "sem
  // restrição dentro da empresa" (documentada no schema Prisma) — o
  // contrato novo abaixo já resolve essa ambiguidade corretamente como
  // projectAccess="all_company_projects", mas isso só passa a alimentar
  // este campo quando os consumidores migrarem.
  const companySlugs = unique(
    allowedCompanies
      .map((company) => company.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0),
  );

  const leaderProjectIds = unique(
    projectAssignments.filter((assignment) => assignment.role === "leader_tc").map((assignment) => assignment.projectId),
  );
  const qaProjectIds = unique(
    projectAssignments.filter((assignment) => assignment.role === "qa_tc").map((assignment) => assignment.projectId),
  );
  const allowedProjectIds = hasUnrestrictedCompanyAccess
    ? null
    : hasLeaderTcRole
      ? leaderProjectIds
      : hasQaTcAssignments
        ? qaProjectIds
        : isProjectScopedRole && primaryLink?.allowedProjectIds?.length
          ? unique(primaryLink.allowedProjectIds)
          : null;

  // ── Contrato relacional (Etapa 2.3A/2.3B) ──────────────────────────────
  // Monta `assignments` preservando o par empresa+projeto, com
  // projectAccess explícito. Fonte por perfil, sem misturar: Líder
  // TC/Usuário TC usam só ProjectTeamAssignment ativo (nunca Membership
  // para completar escopo); todo mundo mais (inclusive admin global e
  // Suporte Técnico) usa só Membership/link real — sem nenhuma entrada
  // sintética. Para acesso global o escopo real vem de
  // projectScope="unrestricted" (decidido pela flag
  // `hasUnrestrictedCompanyAccess`), nunca do conteúdo de `assignments`.
  const companyById = new Map(companies.map((company) => [company.id, company] as const));
  let assignments: AccessAssignment[];

  if (hasLeaderTcRole || hasQaTcAssignments) {
    // Só ProjectTeamAssignment ativo — nunca Membership/link antigo para
    // completar artificialmente o escopo de Líder TC/Usuário TC.
    assignments = roleAssignments.map((assignment) => {
      const company = companyById.get(assignment.companyId);
      return {
        companyId: assignment.companyId,
        companySlug: company?.slug ?? "",
        companyName: company?.name ?? null,
        projectId: assignment.projectId,
        projectSlug: assignment.projectSlug,
        projectName: assignment.projectName,
        projectAccess: "selected_projects",
        role: assignment.role,
        status: "active",
        source: "project_assignment",
      };
    });
  } else {
    // Empresa / usuário empresarial / company_user sem papel líder /
    // admin global / Suporte Técnico: processa TODOS os Memberships/links
    // reais do usuário (Correção 3 — não só o primário). Para cada
    // vínculo:
    //   - papel não escopado por projeto (ex.: "empresa") -> company_only;
    //   - papel escopado por projeto com allowedProjectIds=[] -> essa
    //     empresa libera todos os projetos dela (é a semântica que o
    //     schema já documenta para esse campo vazio) -> all_company_projects;
    //   - papel escopado por projeto com IDs explícitos -> um assignment
    //     por projeto, resolvido em lote (Correção 4) e validado contra a
    //     empresa real do projeto (nunca confia no companyId do Membership
    //     sozinho: um ID corrompido apontando pra outra empresa é
    //     descartado, não gera assignment nem acesso).
    const allMembershipProjectIds = links.flatMap((link) =>
      Array.isArray(link.allowedProjectIds) ? link.allowedProjectIds : [],
    );
    const resolvedProjects = await resolveMembershipProjectsByIds(allMembershipProjectIds);

    const built: AccessAssignment[] = [];
    for (const link of links) {
      const company = companyById.get(link.companyId);
      if (!company) continue; // vínculo para empresa inexistente/removida -- ignora (fail-closed)

      const roleForCompany = normalizeLocalRole(link.role ?? user.role ?? null) ?? effectiveRole;
      const isProjectScopedForLink = roleForCompany === "company_user" || roleForCompany === "testing_company_user";
      const explicitProjectIds = isProjectScopedForLink && Array.isArray(link.allowedProjectIds) ? unique(link.allowedProjectIds) : [];

      if (!isProjectScopedForLink || explicitProjectIds.length === 0) {
        built.push({
          companyId: company.id,
          companySlug: company.slug,
          companyName: company.name ?? null,
          projectId: null,
          projectSlug: null,
          projectName: null,
          projectAccess: isProjectScopedForLink ? "all_company_projects" : "company_only",
          role: roleForCompany,
          status: "active",
          source: "membership",
        });
        continue;
      }

      for (const projectId of explicitProjectIds) {
        const project = resolvedProjects.get(projectId);
        if (!project) continue; // ID inexistente/corrompido -- ignora, nunca concede
        if (project.companyId !== company.id) continue; // aponta pra outra empresa -- nega (Correção 4)
        built.push({
          companyId: company.id,
          companySlug: company.slug,
          companyName: company.name ?? null,
          projectId: project.id,
          projectSlug: project.slug,
          projectName: project.name,
          projectAccess: "selected_projects",
          role: roleForCompany,
          status: "active",
          source: "membership",
        });
      }
    }
    assignments = built;
  }

  const projectScope = deriveProjectScope(hasUnrestrictedCompanyAccess, assignments);

  return {
    userId: user.id,
    email: user.email,
    user: user.user ?? null,
    userOrigin: user.user_origin ?? null,
    isGlobalAdmin,
    role: effectiveRole,
    permissionRole,
    globalRole: isGlobalAdmin ? "global_admin" : null,
    companyRole,
    capabilities,
    companyId: shouldBindCompanyContext ? primaryCompany?.id ?? null : null,
    companySlug: shouldBindCompanyContext ? primaryCompany?.slug ?? null : null,
    companySlugs,
    allowedProjectIds,
    assignments,
    projectScope,
  };
}
