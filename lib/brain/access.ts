import type { BrainEdge, BrainNode } from "@prisma/client";

import { SYSTEM_MODULE_BY_ID } from "@/lib/navigation/module-map";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import type { SystemModuleId, SystemPermission, SystemRouteDefinition } from "@/lib/navigation/navigation.types";
import { prisma } from "@/lib/prismaClient";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { canAccess, canAccessRoute } from "@/lib/permissions/can-access";
import { getUserAccessContext, type UserAccessContext } from "@/lib/permissions/get-user-access-context";
import type { PermissionMatrix } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

export type BrainAccessContext = {
  user: AuthUser;
  userAccess: UserAccessContext;
  hasGlobalVisibility: boolean;
  canManage: boolean;
  allowedCompanySlugs: Set<string>;
  allowedCompanyIds: Set<string>;
  allowedProjectIds: Set<string>;
};

export type BrainAccessResult =
  | { ok: true; context: BrainAccessContext }
  | { ok: false; status: 401 | 403; error: string };

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSlug(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeSlugList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSlug(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeKey(value: unknown) {
  const normalized = normalizeString(value);
  return normalized
    ? normalized
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : null;
}

function hasAnyPermissionAction(permissions: PermissionMatrix | null | undefined) {
  return Boolean(permissions && Object.values(permissions).some((actions) => actions.length > 0));
}

function resolveAllowedCompanySlugs(user: AuthUser) {
  const slugs = Array.isArray(user.companySlugs) ? user.companySlugs : user.companySlug ? [user.companySlug] : [];
  return slugs
    .map((slug) => normalizeSlug(slug))
    .filter((slug): slug is string => Boolean(slug));
}

async function resolveAllowedProjectIds(allowedCompanyIds: Set<string>, hasGlobalVisibility: boolean) {
  const allowedProjectIds = new Set<string>();
  if (hasGlobalVisibility || isE2eJsonMode() || allowedCompanyIds.size === 0) return allowedProjectIds;

  const projects = await prisma.project.findMany({
    where: { companyId: { in: Array.from(allowedCompanyIds) } },
    select: { id: true, slug: true },
  });

  for (const project of projects) {
    allowedProjectIds.add(project.id);
    if (project.slug) allowedProjectIds.add(project.slug);
  }

  return allowedProjectIds;
}

/**
 * Aplica a matriz efetiva oficial (defaults do perfil + override de perfil + allow/deny
 * individual do usuario, resolvidos por lib/serverPermissionAccess.ts) sobre o contexto
 * de acesso do Brain, para nao depender de uma segunda logica de permissao.
 */
async function withOfficialPermissions(user: AuthUser, userAccess: UserAccessContext): Promise<UserAccessContext> {
  const resolved = await resolvePermissionAccessForUser(user.id);
  return { ...userAccess, permissions: resolved.permissions };
}

function hasGlobalBrainVisibility(user: AuthUser, userAccess: UserAccessContext) {
  if (user.isGlobalAdmin || userAccess.isGlobalAdmin) return true;
  return (
    canAccess(userAccess, { moduleId: "context", action: "view_all_companies" }) ||
    canAccess(userAccess, { moduleId: "context", action: "global_overview" })
  );
}

function isE2eJsonMode() {
  return process.env.E2E_USE_JSON === "1" || process.env.E2E_USE_JSON === "true";
}

function parsePermissionRequirement(value: unknown): SystemPermission | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const moduleId = normalizeString(record.moduleId);
    const action = normalizeString(record.action);
    return moduleId && action ? { moduleId, action } : null;
  }

  const raw = normalizeString(value);
  if (!raw) return null;
  const separator = raw.includes(":") ? ":" : raw.includes(".") ? "." : null;
  if (!separator) return null;
  const [moduleId, action] = raw.split(separator);
  return moduleId && action ? { moduleId, action } : null;
}

function readPermissionRequirements(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => parsePermissionRequirement(item))
      .filter((item): item is SystemPermission => Boolean(item));
  }

  const parsed = parsePermissionRequirement(value);
  return parsed ? [parsed] : [];
}

function normalizeRouteIdentity(value: unknown, includeQuery = false) {
  const raw = normalizeString(value);
  if (!raw || !raw.startsWith("/")) return null;

  const queryIndex = raw.indexOf("?");
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex + 1) : "";
  const normalizedPath =
    pathPart
      .replace(/\[([^\]]+)\]/g, ":$1")
      .replace(/\/+/g, "/")
      .replace(/\/$/g, "") || "/";

  return includeQuery && queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath;
}

function routePatternMatches(routePath: string, candidatePath: string) {
  const routeParts = routePath.split("/").filter(Boolean);
  const candidateParts = candidatePath.split("/").filter(Boolean);
  if (routeParts.length !== candidateParts.length) return false;

  return routeParts.every((part, index) => part.startsWith(":") || part === candidateParts[index]);
}

function findSystemRouteDefinition(routeValue: unknown): SystemRouteDefinition | null {
  const fullRoute = normalizeRouteIdentity(routeValue, true);
  const pathOnly = normalizeRouteIdentity(routeValue);
  if (!pathOnly) return null;

  const exactWithQuery = SYSTEM_ROUTES.find((route) => normalizeRouteIdentity(route.path, true) === fullRoute);
  if (exactWithQuery) return exactWithQuery;

  const exactPath = SYSTEM_ROUTES.find((route) => normalizeRouteIdentity(route.path) === pathOnly);
  if (exactPath) return exactPath;

  return SYSTEM_ROUTES.find((route) => {
    const routePath = normalizeRouteIdentity(route.path);
    return Boolean(routePath && routePatternMatches(routePath, pathOnly));
  }) ?? null;
}

const MODULE_PERMISSION_REQUIREMENTS: Record<string, SystemPermission[]> = {
  contexto: [],
  home: [{ moduleId: "dashboard", action: "view" }],
  dashboard: [{ moduleId: "dashboard", action: "view" }],
  dashboards: [{ moduleId: "dashboard", action: "view" }],
  "visao-geral": [{ moduleId: "dashboard", action: "view" }],
  empresas: [{ moduleId: "applications", action: "view" }],
  applications: [{ moduleId: "applications", action: "view" }],
  usuarios: [{ moduleId: "users", action: "view" }],
  users: [{ moduleId: "users", action: "view" }],
  perfis: [{ moduleId: "users", action: "view" }, { moduleId: "permissions", action: "view" }],
  permissoes: [{ moduleId: "permissions", action: "view" }],
  permissions: [{ moduleId: "permissions", action: "view" }],
  solicitacoes: [{ moduleId: "access_requests", action: "view" }],
  "access-requests": [{ moduleId: "access_requests", action: "view" }],
  suporte: [{ moduleId: "support", action: "view" }, { moduleId: "tickets", action: "view" }],
  support: [{ moduleId: "support", action: "view" }, { moduleId: "tickets", action: "view" }],
  chamados: [{ moduleId: "tickets", action: "view" }, { moduleId: "support", action: "view" }],
  tickets: [{ moduleId: "tickets", action: "view" }, { moduleId: "support", action: "view" }],
  documentos: [{ moduleId: "documents", action: "view" }],
  docs: [{ moduleId: "documents", action: "view" }],
  documents: [{ moduleId: "documents", action: "view" }],
  notas: [{ moduleId: "notes", action: "view" }, { moduleId: "documents", action: "view" }],
  notes: [{ moduleId: "notes", action: "view" }, { moduleId: "documents", action: "view" }],
  logs: [{ moduleId: "audit", action: "view" }],
  audit: [{ moduleId: "audit", action: "view" }],
  auditoria: [{ moduleId: "audit", action: "view" }],
  automacao: [{ moduleId: "playwright", action: "read" }],
  automacoes: [{ moduleId: "playwright", action: "read" }],
  automation: [{ moduleId: "playwright", action: "read" }],
  playwright: [{ moduleId: "playwright", action: "read" }],
  defeitos: [{ moduleId: "defect_tracking", action: "read" }, { moduleId: "defects", action: "view" }],
  defects: [{ moduleId: "defect_tracking", action: "read" }, { moduleId: "defects", action: "view" }],
  bugs: [{ moduleId: "defect_tracking", action: "read" }, { moduleId: "defects", action: "view" }],
  releases: [{ moduleId: "release_management", action: "read" }, { moduleId: "releases", action: "view" }],
  runs: [{ moduleId: "test_run", action: "read" }, { moduleId: "runs", action: "view" }],
  "testes-manuais": [{ moduleId: "test_repository", action: "read" }],
  "repositorio-de-testes": [{ moduleId: "test_repository", action: "read" }],
  "casos-de-teste": [{ moduleId: "test_repository", action: "read" }],
  "plano-de-teste": [{ moduleId: "test_plan", action: "read" }],
  "planos-de-teste": [{ moduleId: "test_plan", action: "read" }],
  brain: [{ moduleId: "brain", action: "view" }],
  brian: [{ moduleId: "brain", action: "view" }],
  assistente: [{ moduleId: "ai", action: "use" }],
  assistant: [{ moduleId: "assistant", action: "query_qase" }, { moduleId: "assistant", action: "query_jira" }],
  ai: [{ moduleId: "ai", action: "use" }],
  chat: [{ moduleId: "chat", action: "view" }, { moduleId: "chat", action: "use" }],
  qase: [{ moduleId: "qase", action: "view" }],
  kase: [{ moduleId: "qase", action: "view" }],
  jira: [{ moduleId: "jira", action: "view" }],
  operacao: [{ moduleId: "operations", action: "view" }],
  operacoes: [{ moduleId: "operations", action: "view" }],
  operations: [{ moduleId: "operations", action: "view" }],
  configuracoes: [{ moduleId: "settings", action: "view" }],
  settings: [{ moduleId: "settings", action: "view" }],
  agenda: [{ moduleId: "release_calendar", action: "view" }],
  "release-calendar": [{ moduleId: "release_calendar", action: "view" }],
};

function hasAnyRequirement(access: BrainAccessContext, requirements: SystemPermission[]) {
  if (requirements.length === 0) return true;
  // isGlobalAdmin e um bypass total legitimo. hasGlobalVisibility NAO bypassa permissao de
  // modulo aqui: empresa/projeto global e permissao por modulo sao regras independentes
  // (ex.: ve todas as empresas mas nao tem audit:view -> continua sem ver logs).
  if (access.user.isGlobalAdmin) return true;
  if (isE2eJsonMode() && !hasAnyPermissionAction(access.userAccess.permissions)) return true;
  return requirements.some((permission) => canAccess(access.userAccess, permission));
}

function requirementsForModuleKey(moduleKey: unknown): SystemPermission[] | null {
  const normalizedModuleKey = normalizeKey(moduleKey);
  if (!normalizedModuleKey) return null;

  const mapped = MODULE_PERMISSION_REQUIREMENTS[normalizedModuleKey];
  if (mapped) return mapped;

  const moduleDefinition = SYSTEM_MODULE_BY_ID.get(normalizedModuleKey as SystemModuleId);
  return moduleDefinition?.basePermission ? [moduleDefinition.basePermission] : null;
}

function requirementsForPermissionNode(
  node: Pick<BrainNode, "refType" | "refId" | "metadata">,
  metadata: Record<string, unknown>,
) {
  const explicit = [
    ...readPermissionRequirements(metadata.requiredPermission),
    ...readPermissionRequirements(metadata.permission),
    ...readPermissionRequirements(metadata.requiredPermissions),
    ...readPermissionRequirements(metadata.canOpen),
  ];
  if (explicit.length > 0) return explicit;

  const permissionModuleId = normalizeString(metadata.permissionModuleId);
  const action = normalizeString(metadata.action);
  if (permissionModuleId && action) return [{ moduleId: permissionModuleId, action }];

  if (node.refType === "PermissionAction") {
    const requirement = parsePermissionRequirement(node.refId);
    return requirement ? [requirement] : [];
  }

  if (node.refType === "PermissionModule" && node.refId) {
    const requirements = requirementsForModuleKey(node.refId);
    return requirements ?? [{ moduleId: node.refId, action: "view" }];
  }

  return [];
}

function routeValueForNode(
  node: Pick<BrainNode, "refType" | "refId" | "metadata">,
  metadata: Record<string, unknown>,
) {
  const explicitRoute =
    normalizeString(metadata.routePath) ??
    normalizeString(metadata.route) ??
    normalizeString(metadata.path);
  if (explicitRoute) return explicitRoute;

  if (node.refType === "SystemRoute" && node.refId) {
    return node.refId.replace(/^(page|api):/, "");
  }

  return null;
}

type PermissionScope = "allowed" | "denied" | "unknown";

function resolveBrainNodePermissionScope(
  node: Pick<BrainNode, "type" | "refType" | "refId" | "metadata">,
  access: BrainAccessContext,
): PermissionScope {
  if (access.user.isGlobalAdmin) return "allowed";

  const metadata = toRecord(node.metadata);
  const explicitRequirements = requirementsForPermissionNode(node, metadata);
  if (explicitRequirements.length > 0) {
    return hasAnyRequirement(access, explicitRequirements) ? "allowed" : "denied";
  }

  const routeValue = routeValueForNode(node, metadata);
  const routeDefinition = routeValue ? findSystemRouteDefinition(routeValue) : null;
  if (routeDefinition) {
    return canAccessRoute(access.userAccess, routeDefinition) ? "allowed" : "denied";
  }

  const moduleRequirements =
    requirementsForModuleKey(metadata.moduleKey) ??
    requirementsForModuleKey(metadata.module) ??
    requirementsForModuleKey(node.refType === "SystemModule" ? node.refId : null) ??
    requirementsForModuleKey(node.type);
  if (moduleRequirements) {
    return hasAnyRequirement(access, moduleRequirements) ? "allowed" : "denied";
  }

  return "unknown";
}

function isCompanyScopeVisible(
  scope: { companyId?: unknown; companySlug?: unknown; slug?: unknown; companyIds?: unknown; companySlugs?: unknown },
  access: BrainAccessContext,
) {
  const metadataCompanyId = normalizeString(scope.companyId);
  const metadataCompanySlug = normalizeSlug(scope.companySlug ?? scope.slug);
  const metadataCompanyIds = normalizeStringList(scope.companyIds);
  const metadataCompanySlugs = normalizeSlugList(scope.companySlugs);

  if (metadataCompanyId && access.allowedCompanyIds.has(metadataCompanyId)) return true;
  if (metadataCompanySlug && access.allowedCompanySlugs.has(metadataCompanySlug)) return true;
  if (metadataCompanyIds.some((companyId) => access.allowedCompanyIds.has(companyId))) return true;
  if (metadataCompanySlugs.some((companySlug) => access.allowedCompanySlugs.has(companySlug))) return true;
  return false;
}

function isProjectScopeVisible(
  scope: { projectId?: unknown; projectSlug?: unknown; projectCode?: unknown },
  access: BrainAccessContext,
) {
  if (access.hasGlobalVisibility) return true;

  const metadataProjectId =
    normalizeString(scope.projectId) ??
    normalizeString(scope.projectSlug);

  if (!metadataProjectId) return true;
  if (access.allowedProjectIds.has(metadataProjectId)) return true;

  return isE2eJsonMode() && access.allowedProjectIds.size === 0;
}

function isNonSensitiveSystemNode(node: Pick<BrainNode, "type" | "refType">) {
  return (
    ["ExecutiveContext", "SystemModule", "SystemSubmodule", "SystemRoute", "PermissionModule", "PermissionAction"].includes(
      node.refType ?? "",
    ) ||
    ["Module", "Submodule", "Screen", "PermissionModule", "PermissionAction"].includes(node.type)
  );
}

export function canAccessBrainModule(access: BrainAccessContext, moduleName: unknown) {
  // Empresa/projeto global (hasGlobalVisibility) nao bypassa permissao de modulo: ver todas
  // as empresas e ter audit:view sao permissoes independentes na matriz efetiva.
  if (access.user.isGlobalAdmin) return true;

  const requirements = requirementsForModuleKey(moduleName);
  if (!requirements) return true;
  return hasAnyRequirement(access, requirements);
}

export async function resolveBrainAccess(req: Request, options?: { requireManage?: boolean }): Promise<BrainAccessResult> {
  const user = await authenticateRequest(req);
  if (!user) return { ok: false, status: 401, error: "Nao autorizado" };

  const baseUserAccess = getUserAccessContext(user);
  if (!baseUserAccess) return { ok: false, status: 403, error: "Sem contexto de permissao" };
  const userAccess = await withOfficialPermissions(user, baseUserAccess);

  const hasGlobalVisibility = hasGlobalBrainVisibility(user, userAccess);
  const canReadBrain =
    hasGlobalVisibility ||
    canAccess(userAccess, { moduleId: "brain", action: "view" }) ||
    canAccess(userAccess, { moduleId: "brain", action: "read" }) ||
    canAccess(userAccess, { moduleId: "brain", action: "use" });

  if (!canReadBrain && !isE2eJsonMode()) {
    return { ok: false, status: 403, error: "Sem permissao para acessar o Brain" };
  }

  const canManage = hasGlobalVisibility;

  if (options?.requireManage && !canManage) {
    return { ok: false, status: 403, error: "Sem permissao" };
  }

  const allowedCompanySlugs = new Set(resolveAllowedCompanySlugs(user));
  const allowedCompanyIds = new Set<string>();

  if (user.companyId) {
    allowedCompanyIds.add(user.companyId);
  }

  if (!hasGlobalVisibility && allowedCompanySlugs.size > 0 && !isE2eJsonMode()) {
    const companies = await prisma.company.findMany({
      where: { slug: { in: Array.from(allowedCompanySlugs) } },
      select: { id: true },
    });
    for (const company of companies) {
      allowedCompanyIds.add(company.id);
    }
  }

  if (!hasGlobalVisibility && allowedCompanySlugs.size === 0 && allowedCompanyIds.size === 0) {
    return { ok: false, status: 403, error: "Sem escopo de empresa para acessar o Brain" };
  }

  const allowedProjectIds = await resolveAllowedProjectIds(allowedCompanyIds, hasGlobalVisibility);

  return {
    ok: true,
    context: {
      user,
      userAccess,
      hasGlobalVisibility,
      canManage,
      allowedCompanySlugs,
      allowedCompanyIds,
      allowedProjectIds,
    },
  };
}

export async function buildBrainAccessContextFromAuthUser(user: AuthUser | null | undefined): Promise<BrainAccessContext | null> {
  if (!user) return null;

  const baseUserAccess = getUserAccessContext(user);
  if (!baseUserAccess) return null;
  const userAccess = await withOfficialPermissions(user, baseUserAccess);

  const hasGlobalVisibility = hasGlobalBrainVisibility(user, userAccess);
  const canManage = hasGlobalVisibility;
  const allowedCompanySlugs = new Set(resolveAllowedCompanySlugs(user));
  const allowedCompanyIds = new Set<string>();

  if (user.companyId) {
    allowedCompanyIds.add(user.companyId);
  }

  if (!hasGlobalVisibility && allowedCompanySlugs.size > 0 && !isE2eJsonMode()) {
    const companies = await prisma.company.findMany({
      where: { slug: { in: Array.from(allowedCompanySlugs) } },
      select: { id: true },
    });
    for (const company of companies) {
      allowedCompanyIds.add(company.id);
    }
  }

  const allowedProjectIds = await resolveAllowedProjectIds(allowedCompanyIds, hasGlobalVisibility);

  return {
    user,
    userAccess,
    hasGlobalVisibility,
    canManage,
    allowedCompanySlugs,
    allowedCompanyIds,
    allowedProjectIds,
  };
}

export function isBrainNodeVisible(node: Pick<BrainNode, "type" | "refType" | "refId" | "metadata">, access: BrainAccessContext) {
  const metadata = toRecord(node.metadata);
  const permissionScope = resolveBrainNodePermissionScope(node, access);
  if (permissionScope === "denied") return false;

  if (access.hasGlobalVisibility) return true;

  const metadataCompanyId = normalizeString(metadata.companyId);
  const metadataCompanySlug = normalizeSlug(metadata.companySlug);
  if (!isProjectScopeVisible(metadata, access)) return false;

  if (node.refType === "Company" && node.refId && access.allowedCompanyIds.has(node.refId)) {
    return true;
  }

  if (node.type === "Company") {
    const companySlug = normalizeSlug(metadata.slug);
    if (companySlug && access.allowedCompanySlugs.has(companySlug)) return true;
  }

  if (isCompanyScopeVisible({
    companyId: metadataCompanyId,
    companySlug: metadataCompanySlug,
    companyIds: metadata.companyIds,
    companySlugs: metadata.companySlugs,
  }, access)) return true;
  if (permissionScope === "allowed" && isNonSensitiveSystemNode(node)) return true;

  return false;
}

export function isBrainDomainNodeVisible(
  node: { module?: string | null; type?: string | null; companyId?: string | null; metadata?: unknown },
  access: BrainAccessContext,
) {
  if (!canAccessBrainModule(access, node.module ?? node.type)) return false;
  if (access.hasGlobalVisibility) return true;

  const metadata = toRecord(node.metadata);
  const nodeCompanyId = node.companyId ?? normalizeString(metadata.companyId);
  const nodeCompanySlug = normalizeString(metadata.companySlug) ?? normalizeString(metadata.slug);
  const nodeProjectId = normalizeString(metadata.projectId) ?? normalizeString((node as { projectId?: unknown }).projectId);

  if (!isProjectScopeVisible({ projectId: nodeProjectId, projectSlug: metadata.projectSlug, projectCode: metadata.projectCode }, access)) {
    return false;
  }

  if (!nodeCompanyId && !nodeCompanySlug) return true;
  return isCompanyScopeVisible({
    companyId: nodeCompanyId,
    companySlug: nodeCompanySlug,
    companyIds: metadata.companyIds,
    companySlugs: metadata.companySlugs,
  }, access);
}

export function filterBrainDomainGraphByAccess<
  TNode extends { id: string; module?: string | null; type?: string | null; companyId?: string | null; metadata?: unknown },
  TEdge extends { id: string; source: string; target: string; module?: string | null; companyId?: string | null; metadata?: unknown },
>(nodes: TNode[], edges: TEdge[], access: BrainAccessContext) {
  const visibleNodes = nodes.filter((node) => isBrainDomainNodeVisible(node, access));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
    if (!canAccessBrainModule(access, edge.module)) return false;
    if (access.hasGlobalVisibility) return true;

    const metadata = toRecord(edge.metadata);
    const edgeProjectId = normalizeString((edge as { projectId?: unknown }).projectId) ?? normalizeString(metadata.projectId);
    if (!isProjectScopeVisible({ projectId: edgeProjectId, projectSlug: metadata.projectSlug, projectCode: metadata.projectCode }, access)) {
      return false;
    }

    const edgeCompanyId = edge.companyId ?? normalizeString(metadata.companyId);
    const edgeCompanySlug = normalizeString(metadata.companySlug) ?? normalizeString(metadata.slug);
    if (!edgeCompanyId && !edgeCompanySlug) return true;
    return isCompanyScopeVisible({
      companyId: edgeCompanyId,
      companySlug: edgeCompanySlug,
      companyIds: metadata.companyIds,
      companySlugs: metadata.companySlugs,
    }, access);
  });

  return { nodes: visibleNodes, edges: visibleEdges };
}

export function filterBrainGraphByAccess(
  nodes: Array<Pick<BrainNode, "id" | "type" | "refType" | "refId" | "metadata">>,
  edges: Array<Pick<BrainEdge, "id" | "fromId" | "toId">>,
  access: BrainAccessContext,
) {
  const visibleNodeIds = new Set(
    nodes
      .filter((node) => isBrainNodeVisible(node, access))
      .map((node) => node.id),
  );

  const visibleEdgeIds = new Set(
    edges
      .filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId))
      .map((edge) => edge.id),
  );

  return { visibleNodeIds, visibleEdgeIds };
}

export async function assertBrainNodeAccess(nodeId: string, access: BrainAccessContext) {
  const node = await prisma.brainNode.findUnique({ where: { id: nodeId } });
  if (!node) return { ok: false as const, status: 404 as const, error: "No nao encontrado" };
  if (!isBrainNodeVisible(node, access)) {
    return { ok: false as const, status: 403 as const, error: "Sem permissao para acessar este no" };
  }
  return { ok: true as const, node };
}
