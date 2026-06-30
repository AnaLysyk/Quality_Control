"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { NAV_CATALOG, type NavItemDef, type NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser, getNavigationRoute } from "@/lib/navigation/navigationPermissions";
import type { SystemRole } from "@/lib/auth/roles";

const DISABLED_MODULE_IDS = new Set<NavModuleDef["id"]>(["operations"]);
const INTERNAL_DASHBOARD_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
]);
const COMPANY_DASHBOARD_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
]);
const OPERATIONAL_MODULE_IDS = new Set<NavModuleDef["id"]>(["quality", "automation", "documents", "brain"]);
const CLIENT_BASE_MODULES = new Set<NavModuleDef["id"]>([
  "home",
  "quality",
  "automation",
  "support",
  "brain",
  "documents",
]);
const PROJECT_SCOPED_ITEM_IDS = new Set(["quality-cases", "docs-central", "docs-repository"]);
const ENABLED_NAV_CATALOG = NAV_CATALOG.filter((module) => !DISABLED_MODULE_IDS.has(module.id));

function withScopeQuery(
  href: string | undefined,
  companySlug: string | null,
  projectSlug: string | null,
  includeProject = false,
): string | undefined {
  if (!href || !companySlug) return href;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("companySlug", companySlug);
  if (includeProject && projectSlug) {
    params.set("projectSlug", projectSlug);
  }

  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function resolveCompanyRouteHref(
  mappedPath: string | undefined,
  fallbackHref: string | undefined,
  companySlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
): string | undefined {
  if (mappedPath?.includes("/empresas/[slug]/")) {
    if (!companySlug) return fallbackHref;
    const companyRoute = mappedPath.split("/empresas/[slug]/")[1]?.split("?")[0];
    if (companyRoute) {
      return buildCompanyPathForAccess(companySlug, companyRoute, companyRouteInput);
    }
  }

  return mappedPath ?? fallbackHref;
}

function resolveItemHref(
  item: NavItemDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
): string | undefined {
  const includeProject = PROJECT_SCOPED_ITEM_IDS.has(item.id);

  if (item.companyRoute && companySlug) {
    const href = buildCompanyPathForAccess(companySlug, item.companyRoute, companyRouteInput);
    return withScopeQuery(href, companySlug, projectSlug, includeProject);
  }

  const mappedHref = resolveCompanyRouteHref(getNavigationRoute(item)?.path, item.href, companySlug, companyRouteInput);

  if (item.id === "quality-cases") {
    return withScopeQuery("/casos-de-teste", companySlug, projectSlug, true);
  }

  if (item.id === "docs-central") {
    return withScopeQuery("/documentos", companySlug, projectSlug, true);
  }

  if (item.id === "docs-repository") {
    return withScopeQuery("/documentos/repositorio", companySlug, projectSlug, true);
  }

  return withScopeQuery(mappedHref, companySlug, projectSlug, false);
}

function resolveModuleHref(
  mod: NavModuleDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
): string | undefined {
  if (mod.id === "home") {
    if (companySlug) {
      return buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput);
    }

    if (effectiveRole && INTERNAL_DASHBOARD_ROLES.has(effectiveRole)) {
      return "/dashboard";
    }

    if (companySlug && effectiveRole && COMPANY_DASHBOARD_ROLES.has(effectiveRole)) {
      return buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput);
    }
  }

  if (mod.id === "brain") {
    return withScopeQuery("/brain", companySlug, projectSlug, false);
  }

  return resolveCompanyRouteHref(getNavigationRoute(mod)?.path, mod.href, companySlug, companyRouteInput);
}

function resolveModuleItems(
  mod: NavModuleDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
): NavModuleDef {
  const usesDashboardHome =
    mod.id === "home" &&
    effectiveRole != null &&
    (INTERNAL_DASHBOARD_ROLES.has(effectiveRole) || COMPANY_DASHBOARD_ROLES.has(effectiveRole));

  return {
    ...mod,
    label: usesDashboardHome ? "Dashboard" : mod.label,
    href: resolveModuleHref(mod, companySlug, projectSlug, companyRouteInput, effectiveRole),
    items: mod.items
      .filter((item) => {
        if (PROJECT_SCOPED_ITEM_IDS.has(item.id)) return Boolean(projectSlug);
        return true;
      })
      .map((item) => ({
        ...item,
        href: resolveItemHref(item, companySlug, projectSlug, companyRouteInput),
      })),
  };
}

function buildClientCatalog(effectiveRole: SystemRole | null) {
  return ENABLED_NAV_CATALOG
    .filter((module) => CLIENT_BASE_MODULES.has(module.id))
    .map((module) => {
      if (module.id === "automation") {
        return { ...module, allowedRoles: [SYSTEM_ROLES.EMPRESA, SYSTEM_ROLES.COMPANY_USER] };
      }
      return module;
    });
}

function filterByActiveContext(modules: NavModuleDef[], companySlug: string | null) {
  if (companySlug) return modules;
  return modules.filter((module) => !OPERATIONAL_MODULE_IDS.has(module.id));
}

export function useNavigationItems() {
  const { user, loading, permissions, accessContext } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();
  const { activeProjectSlug } = useProjectContext();

  const normalizedRole = useMemo<SystemRole | null>(() => {
    const r =
      normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
      normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
      normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null);
    return r;
  }, [user]);

  const isGlobalAdmin = useMemo(
    () =>
      user?.isGlobalAdmin === true ||
      (user as { is_global_admin?: boolean } | null)?.is_global_admin === true ||
      normalizedRole === SYSTEM_ROLES.LEADER_TC,
    [normalizedRole, user],
  );

  const effectiveRole = useMemo<SystemRole | null>(() => {
    if (isGlobalAdmin) return SYSTEM_ROLES.LEADER_TC;
    return normalizedRole;
  }, [isGlobalAdmin, normalizedRole]);

  const companySlug =
    activeClientSlug ||
    (typeof user?.clientSlug === "string" && user.clientSlug.trim() ? user.clientSlug.trim() : null) ||
    (typeof user?.primaryCompanySlug === "string" && user.primaryCompanySlug.trim()
      ? user.primaryCompanySlug.trim()
      : null);

  const companyRouteInput = useMemo(
    () => ({
      isGlobalAdmin,
      permissionRole: typeof user?.permissionRole === "string" ? user.permissionRole : null,
      role: typeof user?.role === "string" ? user.role : null,
      companyRole: typeof user?.companyRole === "string" ? user.companyRole : null,
      userOrigin:
        typeof (user as { userOrigin?: string | null } | null)?.userOrigin === "string"
          ? (user as { userOrigin?: string | null }).userOrigin
          : typeof (user as { user_origin?: string | null } | null)?.user_origin === "string"
            ? (user as { user_origin?: string | null }).user_origin
            : null,
      clientSlug: activeClientSlug ?? (typeof user?.clientSlug === "string" ? user.clientSlug : null),
    }),
    [activeClientSlug, isGlobalAdmin, user],
  );

  const roleForFiltering = useMemo<SystemRole | null>(() => effectiveRole, [effectiveRole]);

  const isInstitutional = useMemo(
    () => isInstitutionalCompanyAccount(user),
    [user],
  );
  const isClientProfile =
    effectiveRole === SYSTEM_ROLES.EMPRESA || effectiveRole === SYSTEM_ROLES.COMPANY_USER || isInstitutional;

  const modules = useMemo<NavModuleDef[]>(() => {
    if (!user) return [];

    const catalog = isClientProfile ? buildClientCatalog(effectiveRole) : ENABLED_NAV_CATALOG;
    const contextCatalog = filterByActiveContext(catalog, companySlug);
    const filtered = buildNavigationForUser(contextCatalog, roleForFiltering, permissions, accessContext);

    return filtered.map((mod) =>
      resolveModuleItems(mod, companySlug, activeProjectSlug, companyRouteInput, effectiveRole),
    );
  }, [
    user,
    isClientProfile,
    effectiveRole,
    roleForFiltering,
    permissions,
    accessContext,
    companySlug,
    activeProjectSlug,
    companyRouteInput,
  ]);

  return { modules, loading, companySlug, effectiveRole, isGlobalAdmin };
}
