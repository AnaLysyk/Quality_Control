import "server-only";

import { NextResponse } from "next/server";

import { getAccessContext, type AccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

export type OperationalScope = "global" | "company" | "own";
export type TicketScope = "all_companies" | "own_company" | "own_tickets";
export type UserScope = "all_users" | "own_company_users" | "self";

export type OperationalCapabilities = {
  canViewScreen: boolean;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canUse: boolean;
};

export type OperationalContext = {
  access: AccessContext;
  role: SystemRole | null;
  scope: OperationalScope;
  ticketScope: TicketScope;
  userScope: UserScope;
  companyId: string | null;
  companySlug: string | null;
  allowedCompanyIds: string[];
  allowedCompanySlugs: string[];
  selectedCompanyId: string | null;
  selectedCompanySlug: string | null;
  projectId: string | null;
  projectSlug: string | null;
  allowedProjectIds: string[];
  allowedProjectSlugs: string[];
  selectedProjectId: string | null;
  selectedProjectSlug: string | null;
  moduleId: string | null;
  action: string | null;
  screenCapabilities: OperationalCapabilities;
};

export type OperationalContextOptions = {
  moduleId?: string;
  action?: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  requireCompany?: boolean;
  requireProject?: boolean;
};

function readRole(access: AccessContext): SystemRole | null {
  return (
    normalizeLegacyRole(access.role) ??
    normalizeLegacyRole(access.companyRole) ??
    normalizeLegacyRole(access.globalRole)
  );
}

function isGlobalRole(access: AccessContext, role: SystemRole | null) {
  return (
    access.isGlobalAdmin === true ||
    role === SYSTEM_ROLES.LEADER_TC ||
    role === SYSTEM_ROLES.TECHNICAL_SUPPORT
  );
}

function readScope(access: AccessContext, role: SystemRole | null): OperationalScope {
  if (isGlobalRole(access, role)) return "global";
  if (role === SYSTEM_ROLES.EMPRESA) return "company";
  return "own";
}

function readTicketScope(scope: OperationalScope): TicketScope {
  if (scope === "global") return "all_companies";
  if (scope === "company") return "own_company";
  return "own_tickets";
}

function readUserScope(scope: OperationalScope): UserScope {
  if (scope === "global") return "all_users";
  if (scope === "company") return "own_company_users";
  return "self";
}

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function companyAllowed(access: AccessContext, companyId?: string | null, companySlug?: string | null) {
  const role = readRole(access);
  if (isGlobalRole(access, role)) return true;

  const requestedId = normalize(companyId);
  const requestedSlug = normalize(companySlug);
  if (!requestedId && !requestedSlug) return true;

  if (requestedId && normalize(access.companyId) === requestedId) return true;
  if (requestedSlug && normalize(access.companySlug) === requestedSlug) return true;

  const slugs = new Set((access.companySlugs ?? []).map(normalize).filter(Boolean));
  return Boolean(requestedSlug && slugs.has(requestedSlug));
}

function actionAliases(action: string) {
  if (action === "view") return ["view", "read", "view_own", "view_company", "view_all"];
  if (action === "read") return ["read", "view", "view_own", "view_company", "view_all"];
  if (action === "use") return ["use", "view", "read"];
  if (action === "edit") return ["edit", "update"];
  if (action === "update") return ["update", "edit"];
  return [action];
}

function hasDefaultPermission(role: SystemRole | null, moduleId: string, action: string) {
  if (!role) return false;
  const defaults = resolveRoleDefaults(role);
  const actions = defaults[moduleId] ?? [];
  return actionAliases(action).some((candidate) => actions.includes(candidate));
}

function hasCapability(access: AccessContext, moduleId: string, action: string) {
  const capabilities = Array.isArray(access.capabilities) ? access.capabilities : [];
  return actionAliases(action).some(
    (candidate) =>
      capabilities.includes(`${moduleId}.${candidate}`) ||
      capabilities.includes(`${moduleId}:${candidate}`),
  );
}

function hasOperationalPermission(access: AccessContext, role: SystemRole | null, moduleId: string, action: string) {
  return hasCapability(access, moduleId, action) || hasDefaultPermission(role, moduleId, action);
}

function buildCapabilities(access: AccessContext, role: SystemRole | null, moduleId?: string): OperationalCapabilities {
  if (!moduleId) {
    return { canViewScreen: true, canRead: true, canCreate: false, canEdit: false, canDelete: false, canUse: true };
  }
  const canRead = hasOperationalPermission(access, role, moduleId, "read") || hasOperationalPermission(access, role, moduleId, "view");
  const canCreate = hasOperationalPermission(access, role, moduleId, "create");
  const canEdit = hasOperationalPermission(access, role, moduleId, "edit") || hasOperationalPermission(access, role, moduleId, "update");
  const canDelete = hasOperationalPermission(access, role, moduleId, "delete");
  const canUse = hasOperationalPermission(access, role, moduleId, "use") || canRead;
  return { canViewScreen: canRead || canUse || canCreate || canEdit || canDelete, canRead, canCreate, canEdit, canDelete, canUse };
}

function readRequestValue(url: URL, explicit: string | null | undefined, ...keys: string[]) {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export async function resolveOperationalContext(
  request: Request,
  options: OperationalContextOptions = {},
): Promise<{ ok: true; context: OperationalContext } | { ok: false; response: NextResponse }> {
  const access = await getAccessContext(request);
  if (!access) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const role = readRole(access);
  const scope = readScope(access, role);
  const moduleId = options.moduleId;
  const action = options.action;
  const url = new URL(request.url);

  if (moduleId && action) {
    const allowed = hasOperationalPermission(access, role, moduleId, action);
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
    }
  }

  const companyId = readRequestValue(url, options.companyId, "companyId", "clientId", "client_id") ?? access.companyId ?? null;
  const companySlug = readRequestValue(url, options.companySlug, "companySlug", "clientSlug", "company") ?? access.companySlug ?? null;
  const projectId = readRequestValue(url, options.projectId, "projectId") ?? null;
  const projectSlug = readRequestValue(url, options.projectSlug, "projectSlug", "project") ?? null;

  if (options.requireCompany && !companyId && !companySlug) {
    return { ok: false, response: NextResponse.json({ error: "Empresa obrigatória" }, { status: 400 }) };
  }

  if (options.requireProject && !projectId && !projectSlug) {
    return { ok: false, response: NextResponse.json({ error: "Projeto obrigatório" }, { status: 400 }) };
  }

  if (!companyAllowed(access, companyId, companySlug)) {
    return { ok: false, response: NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 }) };
  }

  return {
    ok: true,
    context: {
      access,
      role,
      scope,
      ticketScope: readTicketScope(scope),
      userScope: readUserScope(scope),
      companyId,
      companySlug,
      allowedCompanyIds: unique([access.companyId, companyId]),
      allowedCompanySlugs: unique([access.companySlug, ...(access.companySlugs ?? []), companySlug]),
      selectedCompanyId: companyId,
      selectedCompanySlug: companySlug,
      projectId,
      projectSlug,
      allowedProjectIds: projectId ? [projectId] : [],
      allowedProjectSlugs: projectSlug ? [projectSlug] : [],
      selectedProjectId: projectId,
      selectedProjectSlug: projectSlug,
      moduleId: moduleId ?? null,
      action: action ?? null,
      screenCapabilities: buildCapabilities(access, role, moduleId),
    },
  };
}

export function assertOperationalAccess(context: OperationalContext, requirement: { moduleId: string; action: string }) {
  return hasOperationalPermission(context.access, context.role, requirement.moduleId, requirement.action);
}

export async function withOperationalContext<TResponse extends Response | NextResponse>(
  request: Request,
  options: OperationalContextOptions,
  handler: (context: OperationalContext) => Promise<TResponse> | TResponse,
): Promise<TResponse | NextResponse> {
  const result = await resolveOperationalContext(request, options);
  if (!result.ok) return result.response;
  return handler(result.context);
}
