import "server-only";

import { NextResponse } from "next/server";

import { getAccessContext, type AccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import {
  isCompanyAllowed,
  isCompanyProjectPairAllowed,
} from "@/lib/core/session/accessAssignment";
import type { PermissionMatrix } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import { resolveOperationalProject } from "./operationalProjectResolver";

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
  permissions: PermissionMatrix;
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

function hasGlobalVisibility(access: AccessContext) {
  return access.projectScope === "unrestricted" || access.isGlobalAdmin === true;
}

function readScope(access: AccessContext, role: SystemRole | null): OperationalScope {
  if (hasGlobalVisibility(access)) return "global";
  if (role === SYSTEM_ROLES.EMPRESA || role === SYSTEM_ROLES.LEADER_TC) return "company";
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

function uniqueExact(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? "").trim()).filter(Boolean)));
}

function actionAliases(action: string) {
  if (action === "view") return ["view", "read", "view_own", "view_company", "view_all"];
  if (action === "read") return ["read", "view", "view_own", "view_company", "view_all"];
  if (action === "view_linked_projects") {
    return ["view_linked_projects", "view_all_projects", "switch_project", "read", "view"];
  }
  if (action === "view_linked_companies") {
    return ["view_linked_companies", "view_all_companies", "switch_company", "read", "view"];
  }
  if (action === "use") return ["use", "view", "read"];
  if (action === "edit") return ["edit", "update"];
  if (action === "update") return ["update", "edit"];
  return [action];
}

function hasOperationalPermission(permissions: PermissionMatrix, moduleId: string, action: string) {
  const actions = permissions[moduleId] ?? [];
  return actionAliases(action).some((candidate) => actions.includes(candidate));
}

function buildCapabilities(permissions: PermissionMatrix, moduleId?: string): OperationalCapabilities {
  if (!moduleId) {
    return { canViewScreen: true, canRead: true, canCreate: false, canEdit: false, canDelete: false, canUse: true };
  }
  const canRead =
    hasOperationalPermission(permissions, moduleId, "read") ||
    hasOperationalPermission(permissions, moduleId, "view");
  const canCreate = hasOperationalPermission(permissions, moduleId, "create");
  const canEdit =
    hasOperationalPermission(permissions, moduleId, "edit") ||
    hasOperationalPermission(permissions, moduleId, "update");
  const canDelete = hasOperationalPermission(permissions, moduleId, "delete");
  const canUse = hasOperationalPermission(permissions, moduleId, "use") || canRead;
  return {
    canViewScreen: canRead || canUse || canCreate || canEdit || canDelete,
    canRead,
    canCreate,
    canEdit,
    canDelete,
    canUse,
  };
}

function readRequestValue(url: URL, explicit: string | null | undefined, ...keys: string[]) {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

function requestedCompanyConflictsWithResolvedProject(input: {
  requestedCompanyId: string | null;
  requestedCompanySlug: string | null;
  resolvedCompanyId: string;
  resolvedCompanySlug: string | null;
}) {
  if (input.requestedCompanyId && input.requestedCompanyId !== input.resolvedCompanyId) {
    return true;
  }
  if (
    input.requestedCompanySlug &&
    normalize(input.requestedCompanySlug) !== normalize(input.resolvedCompanySlug)
  ) {
    return true;
  }
  return false;
}

export async function resolveOperationalContext(
  request: Request,
  options: OperationalContextOptions = {},
): Promise<{ ok: true; context: OperationalContext } | { ok: false; response: NextResponse }> {
  const access = await getAccessContext(request);
  if (!access) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const permissions = permissionAccess.permissions;
  const role = readRole(access);
  const scope = readScope(access, role);
  const moduleId = options.moduleId;
  const action = options.action;
  const url = new URL(request.url);

  if (moduleId && action && !hasOperationalPermission(permissions, moduleId, action)) {
    return { ok: false, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }

  const requestedCompanyId = readRequestValue(url, options.companyId, "companyId", "clientId", "client_id");
  const requestedCompanySlug = readRequestValue(url, options.companySlug, "companySlug", "clientSlug", "company");
  const requestedProjectId = readRequestValue(url, options.projectId, "projectId");
  const requestedProjectSlug = readRequestValue(url, options.projectSlug, "projectSlug", "project");
  const wantsProject = Boolean(requestedProjectId || requestedProjectSlug);

  const projectResolution = await resolveOperationalProject({
    access,
    companyId: requestedCompanyId,
    companySlug: requestedCompanySlug,
    projectId: requestedProjectId,
    projectSlug: requestedProjectSlug,
  });

  if (wantsProject && projectResolution.kind !== "resolved") {
    return { ok: false, response: NextResponse.json({ error: "Projeto fora do escopo permitido" }, { status: 403 }) };
  }

  const resolvedProject = projectResolution.kind === "resolved" ? projectResolution.project : null;

  if (
    resolvedProject &&
    requestedCompanyConflictsWithResolvedProject({
      requestedCompanyId,
      requestedCompanySlug,
      resolvedCompanyId: resolvedProject.companyId,
      resolvedCompanySlug: resolvedProject.companySlug,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Empresa e projeto não pertencem ao mesmo contexto" }, { status: 403 }),
    };
  }

  const companyId = requestedCompanyId ?? resolvedProject?.companyId ?? access.companyId ?? null;
  const companySlug = requestedCompanySlug ?? resolvedProject?.companySlug ?? access.companySlug ?? null;
  const projectId = resolvedProject?.id ?? requestedProjectId ?? null;
  const projectSlug = resolvedProject?.slug ?? requestedProjectSlug ?? null;

  if (options.requireCompany && !companyId && !companySlug) {
    return { ok: false, response: NextResponse.json({ error: "Empresa obrigatória" }, { status: 400 }) };
  }

  if (options.requireProject && !projectId && !projectSlug) {
    return { ok: false, response: NextResponse.json({ error: "Projeto obrigatório" }, { status: 400 }) };
  }

  if (!wantsProject && !isCompanyAllowed(access, { companyId, companySlug })) {
    return { ok: false, response: NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 }) };
  }

  if (
    wantsProject &&
    !isCompanyProjectPairAllowed(access, {
      companyId,
      companySlug,
      projectId,
      projectSlug,
      projectCompanyId: resolvedProject?.companyId ?? null,
    })
  ) {
    return { ok: false, response: NextResponse.json({ error: "Projeto fora do escopo permitido" }, { status: 403 }) };
  }

  const assignmentCompanyIds = access.assignments.map((assignment) => assignment.companyId);
  const assignmentCompanySlugs = access.assignments.map((assignment) => assignment.companySlug);
  const selectedAssignments = access.assignments.filter(
    (assignment) => assignment.status === "active" && assignment.projectAccess === "selected_projects",
  );
  const allowedProjectIds = uniqueExact([
    ...selectedAssignments.map((assignment) => assignment.projectId),
    resolvedProject?.id,
  ]);
  const allowedProjectSlugs = unique([
    ...selectedAssignments.map((assignment) => assignment.projectSlug),
    resolvedProject?.slug,
  ]);

  return {
    ok: true,
    context: {
      access,
      permissions,
      role,
      scope,
      ticketScope: readTicketScope(scope),
      userScope: readUserScope(scope),
      companyId,
      companySlug,
      allowedCompanyIds: uniqueExact([...assignmentCompanyIds, companyId]),
      allowedCompanySlugs: unique([...assignmentCompanySlugs, companySlug]),
      selectedCompanyId: companyId,
      selectedCompanySlug: companySlug,
      projectId,
      projectSlug,
      allowedProjectIds,
      allowedProjectSlugs,
      selectedProjectId: projectId,
      selectedProjectSlug: projectSlug,
      moduleId: moduleId ?? null,
      action: action ?? null,
      screenCapabilities: buildCapabilities(permissions, moduleId),
    },
  };
}

export function assertOperationalAccess(
  context: OperationalContext,
  requirement: { moduleId: string; action: string },
) {
  return hasOperationalPermission(context.permissions, requirement.moduleId, requirement.action);
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
