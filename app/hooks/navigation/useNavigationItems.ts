"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { NAV_CATALOG, type NavItemDef, type NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser } from "@/lib/navigation/navigationPermissions";
import type { SystemRole } from "@/lib/auth/roles";

function resolveItemHref(
  item: NavItemDef,
  companySlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
): string | undefined {
  if (item.companyRoute && companySlug) {
    return buildCompanyPathForAccess(companySlug, item.companyRoute, companyRouteInput);
  }
  return item.href;
}

function resolveModuleItems(
  mod: NavModuleDef,
  companySlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
): NavModuleDef {
  return {
    ...mod,
    items: mod.items.map((item) => ({
      ...item,
      href: resolveItemHref(item, companySlug, companyRouteInput),
    })),
  };
}

export function useNavigationItems() {
  const { user, loading } = usePermissionAccess();
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
      clientSlug: typeof user?.clientSlug === "string" ? user.clientSlug : activeClientSlug ?? null,
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
      // (not companies/operations/automation/admin since those are TC-internal)
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
      filtered = NAV_CATALOG.filter((m) => CLIENT_MODULES.has(m.id));
    } else {
      filtered = buildNavigationForUser(NAV_CATALOG, roleForFiltering);
    }

    return filtered.map((mod) => resolveModuleItems(mod, companySlug, companyRouteInput));
  }, [user, isClientProfile, roleForFiltering, companySlug, companyRouteInput]);

  return { modules, loading, companySlug, effectiveRole, isGlobalAdmin };
}
