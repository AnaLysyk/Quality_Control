"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
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
const ENABLED_NAV_CATALOG = NAV_CATALOG.filter((module) => !DISABLED_MODULE_IDS.has(module.id));

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
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
): string | undefined {
  return resolveCompanyRouteHref(getNavigationRoute(item)?.path, item.href, companySlug, companyRouteInput);
}

function resolveModuleHref(
  mod: NavModuleDef,
  companySlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
): string | undefined {
  if (mod.id === "home") {
    if (effectiveRole && INTERNAL_DASHBOARD_ROLES.has(effectiveRole)) {
      return "/dashboard";
    }

    if (companySlug && effectiveRole && COMPANY_DASHBOARD_ROLES.has(effectiveRole)) {
      return buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput);
    }
  }

  return resolveCompanyRouteHref(getNavigationRoute(mod)?.path, mod.href, companySlug, companyRouteInput);
}

function resolveModuleItems(
  mod: NavModuleDef,
  companySlug: string | null,
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
    href: resolveModuleHref(mod, companySlug, companyRouteInput, effectiveRole),
    items: mod.items.map((item) => ({
      ...item,
      href: resolveItemHref(item, companySlug, companyRouteInput),
    })),
  };
}

export function useNavigationItems() {
  const { user, loading, permissions, accessContext } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();

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

  // For company-role users (empresa/company_user), override to show all-access modules
  // since role filtering in catalog is for internal TC users
  const roleForFiltering = useMemo<SystemRole | null>(() => {
    if (!effectiveRole) return null;
    // empresa and company_user are "client" profiles - they can see most modules
    // but the catalog's allowedRoles gate is for TC-internal only
    if (
      effectiveRole === SYSTEM_ROLES.EMPRESA ||
      effectiveRole === SYSTEM_ROLES.COMPANY_USER
    ) {
      // They can see: home, quality, support, brain, documents
      return null; // will be handled below by isInstitutional
    }
    return effectiveRole;
  }, [effectiveRole]);

  const isInstitutional = useMemo(
    () => isInstitutionalCompanyAccount(user),
    [user],
  );
  const isClientProfile =
    effectiveRole === SYSTEM_ROLES.EMPRESA || effectiveRole === SYSTEM_ROLES.COMPANY_USER || isInstitutional;

  const modules = useMemo<NavModuleDef[]>(() => {
    if (!user) return [];

    let filtered: NavModuleDef[];

    if (isClientProfile) {
      // Client profiles: home, quality, support, brain, documents only
      const CLIENT_MODULES = new Set(["home", "quality", "support", "brain", "documents"]);
      filtered = buildNavigationForUser(
        ENABLED_NAV_CATALOG.filter((m) => CLIENT_MODULES.has(m.id)),
        effectiveRole ?? SYSTEM_ROLES.COMPANY_USER,
        permissions,
        accessContext,
      );
    } else {
      filtered = buildNavigationForUser(ENABLED_NAV_CATALOG, roleForFiltering, permissions, accessContext);
    }

    return filtered.map((mod) => resolveModuleItems(mod, companySlug, companyRouteInput, effectiveRole));
  }, [user, isClientProfile, effectiveRole, roleForFiltering, permissions, accessContext, companySlug, companyRouteInput]);

  return { modules, loading, companySlug, effectiveRole, isGlobalAdmin };
}
