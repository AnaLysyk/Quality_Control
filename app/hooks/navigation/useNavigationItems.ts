"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/context/ProjectContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import { buildCompanyPathForAccess } from "@/backend/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/backend/activeIdentity";
import { NAV_CATALOG, type NavItemDef, type NavModuleDef } from "@/backend/navigation/navigationCatalog";
import { buildNavigationForUser, canSeeNavItem, getNavigationRoute } from "@/backend/navigation/navigationPermissions";
import { hasPermissionAccess, type PermissionMatrix } from "@/backend/permissionMatrix";
import type { SystemRole } from "@/backend/auth/roles";

const DISABLED_ITEM_IDS = new Set(["admin-system-map"]);
const DISABLED_MODULE_IDS = new Set<NavModuleDef["id"]>(["operations"]);
const INTERNAL_DASHBOARD_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
]);
const COMPANY_DASHBOARD_ROLES = new Set<SystemRole>([
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
]);
const AGENDA_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.TESTING_COMPANY_USER,
  SYSTEM_ROLES.EMPRESA,
  SYSTEM_ROLES.COMPANY_USER,
];
const MANAGEMENT_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.EMPRESA,
];
const PERMISSION_MANAGEMENT_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
];
const TC_USER_CREATOR_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
];
const COMPANY_USER_CREATOR_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
  SYSTEM_ROLES.EMPRESA,
];
const INTERNAL_USER_CREATOR_ROLES: SystemRole[] = [
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
];
const AGENDA_MODULE: NavModuleDef = {
  id: "agenda" as NavModuleDef["id"],
  label: "Agenda",
  iconKey: "calendar",
  href: "/agenda",
  requiredPermission: { moduleId: "release_calendar", action: "view" },
  allowedRoles: AGENDA_ROLES,
  testId: "nav-release-agenda",
  items: [],
};
const OPERATIONAL_MODULE_IDS = new Set<NavModuleDef["id"]>(["quality", "documents"]);
const PROJECT_CONTEXT_ONLY_MODULE_IDS = new Set<NavModuleDef["id"]>(["automation"]);
const CLIENT_BASE_MODULES = new Set<NavModuleDef["id"]>([
  "home",
  "agenda",
  "quality",
  "automation",
  "support",
  "chat",
  "brain",
  "documents",
  "management",
]);
const PROJECT_SCOPED_ITEM_IDS = new Set([
  "quality-cases",
  "quality-plans",
  "quality-runs",
  "quality-defects",
  "docs-central",
  "docs-repository",
  "auto-playwright",
  "auto-api-lab",
  "auto-base64",
  "auto-arquivos",
  "auto-logs",
  "quality-automation-cases",
  "quality-automation-plans",
  "quality-automation-runs",
  "quality-automation-defects",
  "quality-doc-links",
  "quality-doc-repository",
]);
const PROJECT_OPTIONAL_SCOPED_ITEM_IDS = new Set<string>();
const ENABLED_NAV_CATALOG = NAV_CATALOG;

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
  const includeProject = PROJECT_SCOPED_ITEM_IDS.has(item.id) || PROJECT_OPTIONAL_SCOPED_ITEM_IDS.has(item.id);

  if (item.id === "admin-permissions-profile") {
    return "/admin/permissions";
  }

  if (item.id === "admin-permissions" || item.id === "admin-permissions-user") {
    return "/admin/users/permissions";
  }

  if (item.id === "quality-projects" && companySlug) {
    return buildCompanyPathForAccess(companySlug, "projetos", companyRouteInput);
  }

  if (item.id === "quality-cases" && companySlug) {
    const href = buildCompanyPathForAccess(companySlug, "casos-de-teste", companyRouteInput);
    return withScopeQuery(href, companySlug, projectSlug, includeProject);
  }

  if (item.id === "docs-central") {
    return withScopeQuery("/documentos", companySlug, projectSlug, true);
  }

  if (item.id === "docs-repository") {
    return withScopeQuery("/documentos/repositorio", companySlug, projectSlug, true);
  }

  if (item.companyRoute && companySlug) {
    const href = buildCompanyPathForAccess(companySlug, item.companyRoute, companyRouteInput);
    return withScopeQuery(href, companySlug, projectSlug, includeProject);
  }

  const mappedHref = resolveCompanyRouteHref(getNavigationRoute(item)?.path, item.href, companySlug, companyRouteInput);

  if (item.id === "quality-cases") {
    return withScopeQuery("/casos-de-teste", companySlug, projectSlug, true);
  }

  return withScopeQuery(mappedHref, companySlug, projectSlug, includeProject);
}

function resolveModuleHref(
  mod: NavModuleDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
): string | undefined {
  if (mod.id === "home") {
    if (effectiveRole && INTERNAL_DASHBOARD_ROLES.has(effectiveRole)) {
      return "/admin/home";
    }

    if (companySlug) {
      return withScopeQuery(buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput), companySlug, projectSlug, true);
    }

    if (companySlug && effectiveRole && COMPANY_DASHBOARD_ROLES.has(effectiveRole)) {
      return withScopeQuery(buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput), companySlug, projectSlug, true);
    }
  }

  if (mod.id === "brain") {
    return effectiveRole && INTERNAL_DASHBOARD_ROLES.has(effectiveRole) ? "/admin/brain" : withScopeQuery("/brain", companySlug, projectSlug, true);
  }

  if (mod.id === "agenda") {
    return withScopeQuery("/agenda", companySlug, projectSlug, true);
  }

  if (mod.id === "chat") {
    return withScopeQuery("/chat", companySlug, projectSlug, true);
  }

  if (mod.id === "support") {
    return withScopeQuery("/kanban-it", companySlug, projectSlug, true);
  }

  return resolveCompanyRouteHref(getNavigationRoute(mod)?.path, mod.href, companySlug, companyRouteInput);
}

function buildBrainItems(
  effectiveRole: SystemRole | null,
  companySlug: string | null,
  projectSlug: string | null,
  permissions?: PermissionMatrix | null,
): NavItemDef[] {
  if (effectiveRole && INTERNAL_DASHBOARD_ROLES.has(effectiveRole)) {
    return [
      {
        id: "brain-map-admin",
        routeId: "brain.admin",
        label: "Mapa Neural",
        iconKey: "cpu",
        module: "brain",
        href: "/admin/brain",
        favoriteEnabled: true,
        testId: "nav-brain-map",
      },
      {
        id: "brain-memories-admin",
        routeId: "brain.memories",
        label: "Memórias do Brain",
        iconKey: "file-text",
        module: "brain",
        href: "/admin/brain/memories",
        allowedRoles: TC_USER_CREATOR_ROLES,
        requiredPermission: { moduleId: "brain", action: "manage_memories" },
        favoriteEnabled: true,
        testId: "nav-brain-memories",
      },
      {
        id: "brain-settings-admin",
        routeId: "brain.settings.admin",
        label: "Configurações do Brain",
        iconKey: "settings",
        module: "brain",
        href: "/admin/brain/settings",
        allowedRoles: TC_USER_CREATOR_ROLES,
        requiredPermission: { moduleId: "brain", action: "configure_sources" },
        favoriteEnabled: true,
        testId: "nav-brain-settings",
      },
      {
        id: "brain-behavior-profiles-admin",
        routeId: "brain.behavior-profiles",
        label: "Perfis de comportamento",
        iconKey: "message-square",
        module: "brain",
        href: "/admin/brain/behavior-profiles",
        requiredPermission: { moduleId: "brain", action: "use" },
        favoriteEnabled: true,
        testId: "nav-brain-behavior-profiles",
      },
    ];
  }

  const canConfigureCompanySources = hasPermissionAccess(permissions, "brain", "configure_sources");

  if (companySlug) {
    return [
      {
        id: "brain-company",
        routeId: "brain.empresa",
        label: projectSlug ? "Mapa Neural do projeto" : "Mapa Neural",
        iconKey: "cpu",
        module: "brain",
        href: withScopeQuery("/brain", companySlug, projectSlug, true),
        favoriteEnabled: true,
        testId: "nav-brain-company",
      },
      ...(canConfigureCompanySources
        ? [{
            id: "brain-settings-company",
            routeId: "brain.settings.company",
            label: "Configurações do Brain",
            iconKey: "settings",
            module: "brain" as const,
            href: withScopeQuery("/brain/settings", companySlug, projectSlug, true),
            requiredPermission: { moduleId: "brain", action: "configure_sources" },
            favoriteEnabled: true,
            testId: "nav-brain-settings-company",
          }]
        : []),
      {
        id: "brain-behavior-profiles-company",
        routeId: "brain.behavior-profiles",
        label: "Perfis de comportamento",
        iconKey: "message-square",
        module: "brain" as const,
        href: "/admin/brain/behavior-profiles",
        requiredPermission: { moduleId: "brain", action: "use" },
        favoriteEnabled: true,
        testId: "nav-brain-behavior-profiles-company",
      },
    ];
  }

  return [
    {
      id: "brain-graph",
      routeId: "brain.grafo",
      label: "Mapa Neural",
      iconKey: "cpu",
      module: "brain",
      href: "/brain",
      favoriteEnabled: true,
      testId: "nav-brain-graph",
    },
    {
      id: "brain-behavior-profiles",
      routeId: "brain.behavior-profiles",
      label: "Perfis de comportamento",
      iconKey: "message-square",
      module: "brain",
      href: "/admin/brain/behavior-profiles",
      requiredPermission: { moduleId: "brain", action: "use" },
      favoriteEnabled: true,
      testId: "nav-brain-behavior-profiles-fallback",
    },
  ];
}

function buildQualityItems(items: NavItemDef[], companySlug: string | null): NavItemDef[] {
  if (!companySlug) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const clone = (id: string, overrides: Partial<NavItemDef> = {}): NavItemDef | null => {
    const item = byId.get(id);
    if (!item) return null;
    return { ...item, group: undefined, ...overrides };
  };

  const manualChildren = [
    clone("quality-cases", {
      label: "Repositório de casos de teste",
      testId: "nav-quality-manual-cases",
    }),
    clone("quality-plans", {
      label: "Planos de teste",
      testId: "nav-quality-manual-plans",
    }),
    clone("quality-runs", {
      label: "Execuções de casos de teste",
      testId: "nav-quality-manual-runs",
    }),
    clone("quality-defects", {
      label: "Defeitos",
      testId: "nav-quality-manual-defects",
    }),
  ].filter((item): item is NavItemDef => Boolean(item));

  const automatedChildren: NavItemDef[] = [
    {
      id: "quality-automation-cases",
      routeId: "",
      label: "Repositório de casos de teste",
      iconKey: "clipboard",
      module: "quality",
      href: "/automacoes/casos",
      requiredPermission: { moduleId: "playwright", action: "read" },
      favoriteEnabled: true,
      testId: "nav-quality-automation-cases",
    },
    {
      id: "quality-automation-plans",
      routeId: "",
      label: "Planos de teste",
      iconKey: "list",
      module: "quality",
      href: "/automacoes/fluxos",
      requiredPermission: { moduleId: "playwright", action: "read" },
      favoriteEnabled: true,
      testId: "nav-quality-automation-plans",
    },
    {
      id: "quality-automation-runs",
      routeId: "",
      label: "Execução",
      iconKey: "play",
      module: "quality",
      href: "/automacoes/execucoes",
      requiredPermission: { moduleId: "playwright", action: "read" },
      favoriteEnabled: true,
      testId: "nav-quality-automation-runs",
    },
    {
      id: "quality-automation-defects",
      routeId: "",
      label: "Defeitos",
      iconKey: "alert-triangle",
      module: "quality",
      href: "/defeitos",
      requiredPermission: { moduleId: "defect_tracking", action: "read" },
      favoriteEnabled: true,
      testId: "nav-quality-automation-defects",
    },
  ];

  const documentationChildren: NavItemDef[] = [
    {
      id: "quality-doc-links",
      routeId: "",
      label: "Anexos e links",
      iconKey: "link",
      module: "quality",
      href: "/documentos",
      requiredPermission: { moduleId: "documents", action: "view" },
      favoriteEnabled: true,
      testId: "nav-quality-doc-links",
    },
    {
      id: "quality-doc-repository",
      routeId: "",
      label: "Repositório publicado",
      iconKey: "book-open",
      module: "quality",
      href: "/documentos/repositorio",
      requiredPermission: { moduleId: "documents", action: "view" },
      favoriteEnabled: true,
      testId: "nav-quality-doc-repository",
    },
  ];

  return [
    {
      id: "quality-manual-tests",
      routeId: "",
      label: "Testes manuais",
      iconKey: "clipboard",
      module: "quality",
      children: manualChildren,
      testId: "nav-quality-manual-tests",
    },
    {
      id: "quality-automated-tests",
      routeId: "",
      label: "Testes automatizados",
      iconKey: "zap",
      module: "quality",
      children: automatedChildren,
      testId: "nav-quality-automated-tests",
    },
    {
      id: "quality-documentation",
      routeId: "",
      label: "Documentação",
      iconKey: "file-text",
      module: "quality",
      requiredPermission: { moduleId: "documents", action: "view" },
      children: documentationChildren,
      testId: "nav-quality-documentation",
    },
  ];
}

function buildManagementModule(effectiveRole: SystemRole | null): NavModuleDef | null {
  if (!effectiveRole || !MANAGEMENT_ROLES.includes(effectiveRole)) return null;

  const items: NavItemDef[] = [];

  if (PERMISSION_MANAGEMENT_ROLES.includes(effectiveRole)) {
    items.push(
      {
        id: "management-permissions-profile",
        routeId: "permissoes.perfil",
        label: "Perfil",
        iconKey: "shield",
        module: "management",
        href: "/admin/permissions",
        allowedRoles: PERMISSION_MANAGEMENT_ROLES,
        requiredPermission: { moduleId: "permissions", action: "view" },
        group: "Gestão de permissões",
        favoriteEnabled: true,
        testId: "nav-management-permissions-profile",
      },
      {
        id: "management-permissions-users",
        routeId: "permissoes.matriz",
        label: "Usuários",
        iconKey: "users",
        module: "management",
        href: "/admin/users/permissions",
        allowedRoles: PERMISSION_MANAGEMENT_ROLES,
        requiredPermission: { moduleId: "permissions", action: "view" },
        group: "Gestão de permissões",
        favoriteEnabled: true,
        testId: "nav-management-permissions-users",
      },
    );
  }

  items.push({
    id: "management-users-list",
    routeId: "usuarios.listagem",
    label: "Listagem de usuários",
    iconKey: "users",
    module: "management",
    href: "/admin/users",
    allowedRoles: MANAGEMENT_ROLES,
    requiredPermission: { moduleId: "users", action: "view" },
    group: "Gestão de usuários",
    favoriteEnabled: true,
    testId: "nav-management-users-list",
  });

  if (TC_USER_CREATOR_ROLES.includes(effectiveRole)) {
    items.push({
      id: "management-users-create-tc",
      routeId: "usuarios.criar-usuário-tc",
      label: "Criar Usuários TC",
      iconKey: "user-plus",
      module: "management",
      href: "/admin/users?tab=testing&modal=create&role=testing_company_user",
      action: "openCreateModal",
      allowedRoles: TC_USER_CREATOR_ROLES,
      requiredPermission: { moduleId: "users", action: "create" },
      group: "Gestão de usuários",
      favoriteEnabled: true,
      testId: "nav-management-users-create-tc",
    });
  }

  if (COMPANY_USER_CREATOR_ROLES.includes(effectiveRole)) {
    items.push({
      id: "management-users-create-company",
      routeId: effectiveRole === SYSTEM_ROLES.EMPRESA ? "usuarios.criar-usuário" : "usuarios.criar-usuário-empresa",
      label: "Criar usuário empresarial",
      iconKey: "plus-circle",
      module: "management",
      href: "/admin/users?tab=company&modal=create&role=company_user",
      action: "openCreateModal",
      allowedRoles: COMPANY_USER_CREATOR_ROLES,
      requiredPermission: { moduleId: "users", action: "create" },
      group: "Gestão de usuários",
      favoriteEnabled: true,
      testId: "nav-management-users-create-company",
    });
  }

  if (INTERNAL_USER_CREATOR_ROLES.includes(effectiveRole)) {
    items.push(
      {
        id: "management-users-create-leader",
        routeId: "usuarios.criar-lider",
        label: "Criar Líder TC",
        iconKey: "user-plus",
        module: "management",
        href: "/admin/users?tab=admin&modal=create&role=leader_tc",
        action: "openCreateModal",
        allowedRoles: INTERNAL_USER_CREATOR_ROLES,
        requiredPermission: { moduleId: "users", action: "create" },
        group: "Gestão de usuários",
        favoriteEnabled: true,
        testId: "nav-management-users-create-leader",
      },
      {
        id: "management-users-create-support",
        routeId: "usuarios.criar-suporte",
        label: "Criar administrador",
        iconKey: "tool",
        module: "management",
        href: "/admin/users?tab=support&modal=create&role=technical_support",
        action: "openCreateModal",
        allowedRoles: INTERNAL_USER_CREATOR_ROLES,
        requiredPermission: { moduleId: "users", action: "create" },
        group: "Gestão de usuários",
        favoriteEnabled: true,
        testId: "nav-management-users-create-support",
      },
    );
  }

  return {
    id: "management",
    label: "Gestão",
    iconKey: "settings",
    allowedRoles: MANAGEMENT_ROLES,
    testId: "nav-management",
    items,
  };
}

function withScopedManagementModule(catalog: NavModuleDef[], effectiveRole: SystemRole | null) {
  const managementModule = buildManagementModule(effectiveRole);
  if (!managementModule) return catalog.filter((module) => module.id !== "management");
  return [...catalog.filter((module) => module.id !== "management"), managementModule];
}


function resolveScopedNavItem(
  item: NavItemDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): NavItemDef | null {
  if (DISABLED_ITEM_IDS.has(item.id)) return null;
  if (PROJECT_SCOPED_ITEM_IDS.has(item.id) && !projectSlug) return null;

  const children = (item.children ?? [])
    .map((child) => resolveScopedNavItem(child, companySlug, projectSlug, companyRouteInput, effectiveRole, permissions))
    .filter((child): child is NavItemDef => Boolean(child));

  const canSeeSelf = canSeeNavItem(item, effectiveRole, permissions);
  if (!canSeeSelf && children.length === 0) return null;

  const href = resolveItemHref(item, companySlug, projectSlug, companyRouteInput);
  if (!href && children.length === 0) return null;

  return {
    ...item,
    href,
    children: children.length > 0 ? children : undefined,
  };
}

function resolveModuleItems(
  mod: NavModuleDef,
  companySlug: string | null,
  projectSlug: string | null,
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2],
  effectiveRole: SystemRole | null,
  permissions?: PermissionMatrix | null,
): NavModuleDef {
  const usesCompanyCentral =
    mod.id === "home" && effectiveRole != null && COMPANY_DASHBOARD_ROLES.has(effectiveRole);
  const dynamicItems =
    mod.id === "agenda"
      ? []
      : mod.id === "brain"
        ? buildBrainItems(effectiveRole, companySlug, projectSlug, permissions)
        : mod.id === "quality"
          ? buildQualityItems(mod.items, companySlug)
          : mod.items;

  return {
    ...mod,
    label: usesCompanyCentral ? "Central da Empresa" : mod.label,
    href: resolveModuleHref(mod, companySlug, projectSlug, companyRouteInput, effectiveRole),
    items: dynamicItems
      .map((item) => resolveScopedNavItem(item, companySlug, projectSlug, companyRouteInput, effectiveRole, permissions))
      .filter((item): item is NavItemDef => Boolean(item)),
  };
}

function buildClientCatalog() {
  return ENABLED_NAV_CATALOG
    .filter((module) => CLIENT_BASE_MODULES.has(module.id))
    .map((module) => {
      if (module.id === "automation") {
        return { ...module, allowedRoles: [SYSTEM_ROLES.EMPRESA, SYSTEM_ROLES.COMPANY_USER] };
      }
      return module;
    });
}

function filterByActiveContext(modules: NavModuleDef[], companySlug: string | null, projectSlug: string | null) {
  return modules.filter((module) => {
    if (PROJECT_CONTEXT_ONLY_MODULE_IDS.has(module.id)) return Boolean(companySlug && projectSlug);
    if (!companySlug) return !OPERATIONAL_MODULE_IDS.has(module.id);
    return true;
  });
}

// Monta os módulos visíveis dado o papel do usuário + o contexto de
// empresa/projeto ativo. Extraído do useMemo do hook pra ser testável sem
// precisar montar ClientContext/ProjectContext/usePermissionAccess reais —
// é aqui (não em buildNavigationForUser) que mora a regra "sem projeto
// vinculado, o módulo quality (e outros com itens PROJECT_SCOPED_ITEM_IDS)
// fica sem itens visíveis e desaparece do menu".
export function computeNavigationModules(params: {
  isClientProfile: boolean;
  effectiveRole: SystemRole | null;
  roleForFiltering: SystemRole | null;
  permissions?: PermissionMatrix | null;
  accessContext?: Parameters<typeof buildNavigationForUser>[3];
  companySlug: string | null;
  activeProjectSlug: string | null;
  companyRouteInput: Parameters<typeof buildCompanyPathForAccess>[2];
}): NavModuleDef[] {
  const {
    isClientProfile,
    effectiveRole,
    roleForFiltering,
    permissions,
    accessContext,
    companySlug,
    activeProjectSlug,
    companyRouteInput,
  } = params;

  const baseCatalog = isClientProfile ? buildClientCatalog() : ENABLED_NAV_CATALOG;
  const catalog = withScopedManagementModule(baseCatalog, effectiveRole);
  const contextCatalog = filterByActiveContext(catalog, companySlug, activeProjectSlug).filter(
    (module) => !DISABLED_MODULE_IDS.has(module.id),
  );
  const filtered = buildNavigationForUser(contextCatalog, roleForFiltering, permissions, accessContext);
  const resolvedModules = filtered
    .map((mod) => resolveModuleItems(mod, companySlug, activeProjectSlug, companyRouteInput, effectiveRole, permissions))
    .filter((mod) => mod.href || mod.items.length > 0);

  return withReleaseAgendaModule(resolvedModules, effectiveRole, permissions);
}

function withReleaseAgendaModule(modules: NavModuleDef[], effectiveRole: SystemRole | null, permissions?: PermissionMatrix | null) {
  if (!effectiveRole || !AGENDA_ROLES.includes(effectiveRole)) return modules;
  if (!hasPermissionAccess(permissions, "release_calendar", "view")) return modules;
  if (modules.some((module) => (module.id as string) === "agenda")) return modules;

  const agendaModule: NavModuleDef = { ...AGENDA_MODULE };
  const homeIndex = modules.findIndex((module) => module.id === "home");
  if (homeIndex < 0) return [agendaModule, ...modules];

  return [
    ...modules.slice(0, homeIndex + 1),
    agendaModule,
    ...modules.slice(homeIndex + 1),
  ];
}

export function useNavigationItems() {
  const { user, loading, permissions, accessContext } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();
  const { activeProjectSlug, activeProject } = useProjectContext();

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

    return computeNavigationModules({
      isClientProfile,
      effectiveRole,
      roleForFiltering,
      permissions,
      accessContext,
      companySlug,
      activeProjectSlug,
      companyRouteInput,
    });
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

  // Tela de tickets do Jira: só aparece quando o projeto ativo tem uma chave
  // de projeto Jira configurada (tela de Projetos da empresa).
  const modulesWithJira = useMemo<NavModuleDef[]>(() => {
    if (!companySlug || !activeProject?.jiraProjectKey) return modules;
    const qualityIndex = modules.findIndex((mod) => mod.id === "quality");
    if (qualityIndex < 0) return modules;

    const href = withScopeQuery(
      buildCompanyPathForAccess(companySlug, "jira", companyRouteInput),
      companySlug,
      activeProjectSlug,
      true,
    );
    const jiraItem: NavItemDef = {
      id: "quality-jira",
      routeId: "",
      label: "Jira",
      iconKey: "link",
      module: "quality",
      href,
      favoriteEnabled: true,
      testId: "nav-quality-jira",
    };

    const nextModules = [...modules];
    const qualityModule = nextModules[qualityIndex];
    if (qualityModule.items.some((item) => item.id === "quality-jira")) return modules;
    nextModules[qualityIndex] = { ...qualityModule, items: [...qualityModule.items, jiraItem] };
    return nextModules;
  }, [modules, companySlug, activeProject?.jiraProjectKey, activeProjectSlug, companyRouteInput]);

  return { modules: modulesWithJira, loading, companySlug, effectiveRole, isGlobalAdmin };
}
