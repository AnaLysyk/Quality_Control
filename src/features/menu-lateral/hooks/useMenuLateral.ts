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
  id: "management-relationships",
  routeId: "",
  label: "Gestão de vínculos",
  iconKey: "link",
  module: "management",
  href: "/admin/users/vinculos",
  requiredPermission: { moduleId: "users", action: "view" },
  favoriteEnabled: true,
  group: "Gestão de usuários",
  testId: "nav-management-relationships",
};

export { useNavigationItems };

export function useMenuLateral() {
  const navigation = useNavigationItems();
  const { can } = usePermissionAccess();

  const modules = useMemo<NavModuleDef[]>(() => {
    if (!navigation.effectiveRole) return navigation.modules;
    if (!RELATIONSHIP_MANAGEMENT_ROLES.has(navigation.effectiveRole)) return navigation.modules;
    if (!can("users", "view")) return navigation.modules;

    const managementIndex = navigation.modules.findIndex((module) => module.id === "management");
    if (managementIndex < 0) return navigation.modules;

    return navigation.modules.map((module, index) => {
      if (index !== managementIndex) return module;
      if (module.items.some((item) => item.id === RELATIONSHIP_ITEM.id)) return module;
      return { ...module, items: [...module.items, RELATIONSHIP_ITEM] };
    });
  }, [can, navigation.effectiveRole, navigation.modules]);

  return { ...navigation, modules };
}
