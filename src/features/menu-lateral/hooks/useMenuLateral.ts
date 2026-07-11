"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useNavigationItems } from "@/hooks/navigation/useNavigationItems";
import { SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";

const RELATIONSHIP_MANAGEMENT_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.EMPRESA,
]);

const RELATIONSHIP_ITEM: NavItemDef = {
  id: "companies-relationships",
  routeId: "",
  label: "Gestão de vínculos",
  iconKey: "link",
  module: "companies",
  href: "/usuarios/vinculos",
  requiredPermission: { moduleId: "users", action: "view" },
  favoriteEnabled: true,
  testId: "nav-companies-relationships",
};

export { useNavigationItems };

export function useMenuLateral() {
  const navigation = useNavigationItems();
  const { can } = usePermissionAccess();

  const modules = useMemo<NavModuleDef[]>(() => {
    if (!navigation.effectiveRole) return navigation.modules;
    if (!RELATIONSHIP_MANAGEMENT_ROLES.has(navigation.effectiveRole)) return navigation.modules;
    if (!can("users", "view")) return navigation.modules;

    const existingCompaniesIndex = navigation.modules.findIndex((module) => module.id === "companies");

    if (existingCompaniesIndex >= 0) {
      return navigation.modules.map((module, index) => {
        if (index !== existingCompaniesIndex) return module;
        if (module.items.some((item) => item.id === RELATIONSHIP_ITEM.id)) return module;
        return { ...module, items: [...module.items, RELATIONSHIP_ITEM] };
      });
    }

    const companyModule: NavModuleDef = {
      id: "companies",
      routeId: "",
      label: "Empresa",
      iconKey: "briefcase",
      href: "/usuarios/vinculos",
      allowedRoles: [navigation.effectiveRole],
      testId: "nav-company-context",
      items: [RELATIONSHIP_ITEM],
    };

    const homeIndex = navigation.modules.findIndex((module) => module.id === "home");
    if (homeIndex < 0) return [companyModule, ...navigation.modules];

    return [
      ...navigation.modules.slice(0, homeIndex + 1),
      companyModule,
      ...navigation.modules.slice(homeIndex + 1),
    ];
  }, [can, navigation.effectiveRole, navigation.modules]);

  return { ...navigation, modules };
}
