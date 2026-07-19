"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useNavigationItems } from "@/hooks/navigation/useNavigationItems";
import { useClientContext } from "@/context/ClientContext";
import { SYSTEM_ROLES, type SystemRole } from "@/backend/auth/roles";
import type { NavItemDef, NavModuleDef } from "@/backend/navigation/navigationCatalog";

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
  requiredPermission: { moduleId: "relationships", action: "view" },
  favoriteEnabled: true,
  group: "Gestão de usuários",
  testId: "nav-management-relationships",
};

export { useNavigationItems };

export function useMenuLateral() {
  const navigation = useNavigationItems();
  const { can } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();

  const modules = useMemo<NavModuleDef[]>(() => {
    let next = navigation.modules;

    if (
      navigation.effectiveRole &&
      RELATIONSHIP_MANAGEMENT_ROLES.has(navigation.effectiveRole) &&
      can("relationships", "view")
    ) {
      const managementIndex = next.findIndex((module) => module.id === "management");
      if (managementIndex >= 0) {
        next = next.map((module, index) => {
          if (index !== managementIndex) return module;
          if (module.items.some((item) => item.id === RELATIONSHIP_ITEM.id)) return module;
          return { ...module, items: [...module.items, RELATIONSHIP_ITEM] };
        });
      }
    }

    if (!activeClientSlug) return next;

    const qualityIndex = next.findIndex((module) => module.id === "quality");
    if (qualityIndex < 0) return next;

    const integrationChildren: NavItemDef[] = [
      ...(can("qase", "view") || can("qase", "view_projects")
        ? [{
            id: "quality-integrations-qase",
            routeId: "integracoes.qase",
            label: "Qase",
            iconKey: "database",
            module: "quality" as const,
            href: `/empresas/${activeClientSlug}/integracoes/qase`,
            requiredPermission: { moduleId: "qase", action: "view" },
            favoriteEnabled: true,
            testId: "nav-quality-integrations-qase",
          }]
        : []),
      ...(can("jira", "view") || can("jira", "view_projects")
        ? [{
            id: "quality-integrations-jira",
            routeId: "integracoes.jira",
            label: "Jira",
            iconKey: "trello",
            module: "quality" as const,
            href: `/empresas/${activeClientSlug}/integracoes/jira`,
            requiredPermission: { moduleId: "jira", action: "view" },
            favoriteEnabled: true,
            testId: "nav-quality-integrations-jira",
          }]
        : []),
    ];

    const companyItems: NavItemDef[] = [
      {
        id: "quality-projects",
        routeId: "projetos.lista",
        label: "Projetos",
        iconKey: "folder",
        module: "quality",
        href: `/empresas/${activeClientSlug}/projetos`,
        requiredPermission: { moduleId: "context", action: "view_linked_projects" },
        favoriteEnabled: true,
        testId: "nav-quality-projects",
      },
      ...(integrationChildren.length
        ? [{
            id: "quality-integrations",
            routeId: "integracoes",
            label: "Integrações",
            iconKey: "link",
            module: "quality" as const,
            children: integrationChildren,
            testId: "nav-quality-integrations",
          }]
        : []),
    ];

    return next.map((module, index) => {
      if (index !== qualityIndex) return module;
      const existingIds = new Set(module.items.map((item) => item.id));
      return { ...module, items: [...companyItems.filter((item) => !existingIds.has(item.id)), ...module.items] };
    });
  }, [activeClientSlug, can, navigation.effectiveRole, navigation.modules]);

  return { ...navigation, modules };
}
