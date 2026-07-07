import "server-only";

import { NextResponse } from "next/server";

import { getAccessContext, type AccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

export type OperationalScope = "global" | "company" | "own";

export type OperationalContext = {
  access: AccessContext;
  role: SystemRole | null;
  scope: OperationalScope;
  companyId: string | null;
  companySlug: string | null;
  projectSlug: string | null;
};

export type OperationalContextOptions = {
  moduleId?: string;
  action?: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectSlug?: string | null;
  requireCompany?: boolean;
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

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
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

export async function resolveOperationalContext(
  request: Request,
  options: OperationalContextOptions = {},
): Promise<{ ok: true; context: OperationalContext } | { ok: false; response: NextResponse }> {
  const access = await getAccessContext(request);
  if (!access) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const role = readRole(access);
  const moduleId = options.moduleId;
  const action = options.action;

  if (moduleId && action) {
    const allowed = hasCapability(access, moduleId, action) || hasDefaultPermission(role, moduleId, action);
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
    }
  }

  const companyId = options.companyId ?? access.companyId ?? null;
  const companySlug = options.companySlug ?? access.companySlug ?? null;

  if (options.requireCompany && !companyId && !companySlug) {
    return { ok: false, response: NextResponse.json({ error: "Empresa obrigatória" }, { status: 400 }) };
  }

  if (!companyAllowed(access, companyId, companySlug)) {
    return { ok: false, response: NextResponse.json({ error: "Empresa fora do escopo permitido" }, { status: 403 }) };
  }

  return {
    ok: true,
    context: {
      access,
      role,
      scope: readScope(access, role),
      companyId,
      companySlug,
      projectSlug: options.projectSlug ?? null,
    },
  };
}
