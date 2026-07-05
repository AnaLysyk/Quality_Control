"use client";

import { useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { NAV_CATALOG, type NavItemDef, type NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser, canSeeNavItem, getNavigationRoute } from "@/lib/navigation/navigationPermissions";
import { hasPermissionAccess, type PermissionMatrix } from "@/lib/permissionMatrix";
import type { SystemRole } from "@/lib/auth/roles";

const INTERNAL_ROLES = new Set<SystemRole>([SYSTEM_ROLES.LEADER_TC, SYSTEM_ROLES.TECHNICAL_SUPPORT]);
const COMPANY_ROLES = new Set<SystemRole>([SYSTEM_ROLES.EMPRESA, SYSTEM_ROLES.COMPANY_USER]);
const AGENDA_ROLES: SystemRole[] = [SYSTEM_ROLES.LEADER_TC, SYSTEM_ROLES.TECHNICAL_SUPPORT, SYSTEM_ROLES.TESTING_COMPANY_USER, SYSTEM_ROLES.EMPRESA, SYSTEM_ROLES.COMPANY_USER];
const OPERATIONAL_MODULE_IDS = new Set<NavModuleDef["id"]>(["quality", "automation", "documents"]);
const CLIENT_BASE_MODULES = new Set<NavModuleDef["id"]>(["home", "quality", "automation", "support", "brain", "documents"]);
const PROJECT_QUERY_ITEM_IDS = new Set(["quality-cases", "quality-plans", "quality-runs", "quality-defects", "docs-central", "docs-repository"]);
const PROJECT_REQUIRED_ITEM_IDS = new Set(["docs-central", "docs-repository"]);
const DISABLED_ITEM_IDS = new Set(["admin-system-map"]);

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

function withScopeQuery(href: string | undefined, companySlug: string | null, projectSlug: string | null, includeProject = false) {
  if (!href || !companySlug) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("companySlug", companySlug);
  if (includeProject && projectSlug) params.set("projectSlug", projectSlug);
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function buildAgendaItems(effectiveRole: SystemRole | null, companySlug: string | null, projectSlug: string | null): NavItemDef[] {
  const basePermission = { moduleId: "release_calendar", action: "view" } as const;
  const geralScope = effectiveRole === SYSTEM_ROLES.LEADER_TC || effectiveRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ? "global" : effectiveRole === SYSTEM_ROLES.TESTING_COMPANY_USER ? "companies" : "company";
  const geralLabel = effectiveRole === SYSTEM_ROLES.EMPRESA || effectiveRole === SYSTEM_ROLES.COMPANY_USER ? "Calendário da empresa" : "Calendário geral";
  return [
    { id: "agenda-meus-agendamentos" as NavItemDef["id"], routeId: "agenda.meus", label: "Meus agendamentos", iconKey: "calendar", module: "agenda", href: withScopeQuery("/agenda/meus-agendamentos?scope=mine", companySlug, projectSlug), requiredPermission: basePermission, allowedRoles: AGENDA_ROLES, favoriteEnabled: true, testId: "nav-agenda-meus-agendamentos" },
    { id: "agenda-calendario-geral" as NavItemDef["id"], routeId: "agenda.geral", label: geralLabel, iconKey: "calendar", module: "agenda", href: withScopeQuery(`/agenda/calendario-geral?scope=${geralScope}`, companySlug, projectSlug), requiredPermission: basePermission, allowedRoles: AGENDA_ROLES, favoriteEnabled: true, testId: "nav-agenda-calendario-geral" },
  ];
}

function resolveMappedCompanyHref(mappedPath: string | undefined, fallbackHref: string | undefined, companySlug: string | null, input: Parameters<typeof buildCompanyPathForAccess>[2]) {
  if (mappedPath?.includes("/empresas/[slug]/")) {
    if (!companySlug) return fallbackHref;
    const route = mappedPath.split("/empresas/[slug]/")[1]?.split("?")[0];
    return route ? buildCompanyPathForAccess(companySlug, route, input) : fallbackHref;
  }
  return mappedPath ?? fallbackHref;
}

function resolveItemHref(item: NavItemDef, companySlug: string | null, projectSlug: string | null, input: Parameters<typeof buildCompanyPathForAccess>[2]) {
  const includeProject = PROJECT_QUERY_ITEM_IDS.has(item.id);
  if (item.id === "admin-permissions-profile") return "/admin/permissions";
  if (item.id === "admin-permissions" || item.id === "admin-permissions-user") return "/admin/users/permissions";
  if (item.id === "quality-projects" && companySlug) return buildCompanyPathForAccess(companySlug, "projetos", input);
  if (item.id === "quality-cases" && companySlug) return withScopeQuery(buildCompanyPathForAccess(companySlug, "casos-de-teste", input), companySlug, projectSlug, true);
  if (item.companyRoute && companySlug) return withScopeQuery(buildCompanyPathForAccess(companySlug, item.companyRoute, input), companySlug, projectSlug, includeProject);
  if (item.id === "quality-cases") return withScopeQuery("/casos-de-teste", companySlug, projectSlug, true);
  if (item.id === "docs-central") return withScopeQuery("/documentos", companySlug, projectSlug, true);
  if (item.id === "docs-repository") return withScopeQuery("/documentos/repositorio", companySlug, projectSlug, true);
  const mappedHref = resolveMappedCompanyHref(getNavigationRoute(item)?.path, item.href, companySlug, input);
  return withScopeQuery(mappedHref, companySlug, projectSlug, includeProject);
}

function resolveModuleHref(mod: NavModuleDef, companySlug: string | null, projectSlug: string | null, input: Parameters<typeof buildCompanyPathForAccess>[2], effectiveRole: SystemRole | null) {
  if (mod.id === "home") {
    if (effectiveRole && INTERNAL_ROLES.has(effectiveRole)) return "/admin/home";
    if (companySlug) return withScopeQuery(buildCompanyPathForAccess(companySlug, "dashboard", input), companySlug, projectSlug, true);
  }
  if (mod.id === "brain") return withScopeQuery("/brain", companySlug, projectSlug, true);
  return resolveMappedCompanyHref(getNavigationRoute(mod)?.path, mod.href, companySlug, input);
}

function buildBrainItems(effectiveRole: SystemRole | null, companySlug: string | null, projectSlug: string | null): NavItemDef[] {
  if (effectiveRole && INTERNAL_ROLES.has(effectiveRole) && !companySlug) {
    return [{ id: "brain-system-map", routeId: "brain.mapa-sistema", label: "Brain visual", iconKey: "cpu", module: "brain", href: "/admin/brain", favoriteEnabled: true, testId: "nav-brain-system-map" }];
  }
  if (!companySlug) return [];
  return [{ id: "brain-company", routeId: "brain.empresa", label: projectSlug ? "Brain do projeto" : "Brain da empresa", iconKey: "cpu", module: "brain", href: withScopeQuery("/brain", companySlug, projectSlug, true), favoriteEnabled: true, testId: "nav-brain-company" }];
}

function buildQualityItems(items: NavItemDef[], companySlug: string | null) {
  if (!companySlug) return items;
  const projectItem: NavItemDef = { id: "quality-projects", routeId: "empresa.projetos", label: "Projetos", iconKey: "folder", module: "quality", companyRoute: "projetos", favoriteEnabled: true, testId: "nav-company-projects" };
  return [projectItem, ...items.filter((item) => item.id !== projectItem.id)];
}

function resolveModuleItems(mod: NavModuleDef, companySlug: string | null, projectSlug: string | null, input: Parameters<typeof buildCompanyPathForAccess>[2], effectiveRole: SystemRole | null, permissions?: PermissionMatrix | null): NavModuleDef {
  const items = mod.id === "brain" ? buildBrainItems(effectiveRole, companySlug, projectSlug) : mod.id === "quality" ? buildQualityItems(mod.items, companySlug) : mod.items;
  return {
    ...mod,
    label: mod.id === "home" && effectiveRole && COMPANY_ROLES.has(effectiveRole) ? "Central da Empresa" : mod.label,
    href: resolveModuleHref(mod, companySlug, projectSlug, input, effectiveRole),
    items: items
      .filter((item) => !DISABLED_ITEM_IDS.has(item.id))
      .filter((item) => canSeeNavItem(item, effectiveRole, permissions))
      .filter((item) => !PROJECT_REQUIRED_ITEM_IDS.has(item.id) || Boolean(projectSlug))
      .map((item) => ({ ...item, href: resolveItemHref(item, companySlug, projectSlug, input), testId: item.testId })),
  };
}

function buildClientCatalog() {
  return NAV_CATALOG.filter((module) => CLIENT_BASE_MODULES.has(module.id)).map((module) => module.id === "automation" ? { ...module, allowedRoles: [SYSTEM_ROLES.EMPRESA, SYSTEM_ROLES.COMPANY_USER] } : module);
}

function filterByActiveContext(modules: NavModuleDef[], companySlug: string | null) {
  return companySlug ? modules : modules.filter((module) => !OPERATIONAL_MODULE_IDS.has(module.id));
}

function withReleaseAgendaModule(modules: NavModuleDef[], effectiveRole: SystemRole | null, permissions?: PermissionMatrix | null) {
  if (!effectiveRole || !AGENDA_ROLES.includes(effectiveRole)) return modules;
  if (!hasPermissionAccess(permissions, "release_calendar", "view")) return modules;
  if (modules.some((module) => (module.id as string) === "agenda")) return modules;
  const homeIndex = modules.findIndex((module) => module.id === "home");
  return homeIndex < 0 ? [AGENDA_MODULE, ...modules] : [...modules.slice(0, homeIndex + 1), AGENDA_MODULE, ...modules.slice(homeIndex + 1)];
}

export function useNavigationItems() {
  const { user, loading, permissions, accessContext } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();
  const { activeProjectSlug } = useProjectContext();

  const normalizedRole = useMemo<SystemRole | null>(() => normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ?? normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ?? normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null), [user]);
  const isGlobalAdmin = useMemo(() => user?.isGlobalAdmin === true || (user as { is_global_admin?: boolean } | null)?.is_global_admin === true || normalizedRole === SYSTEM_ROLES.LEADER_TC, [normalizedRole, user]);
  const effectiveRole = useMemo<SystemRole | null>(() => isGlobalAdmin ? SYSTEM_ROLES.LEADER_TC : normalizedRole, [isGlobalAdmin, normalizedRole]);
  const companySlug = activeClientSlug || (typeof user?.clientSlug === "string" && user.clientSlug.trim() ? user.clientSlug.trim() : null) || (typeof user?.primaryCompanySlug === "string" && user.primaryCompanySlug.trim() ? user.primaryCompanySlug.trim() : null);

  const companyRouteInput = useMemo(() => ({
    isGlobalAdmin,
    permissionRole: typeof user?.permissionRole === "string" ? user.permissionRole : null,
    role: typeof user?.role === "string" ? user.role : null,
    companyRole: typeof user?.companyRole === "string" ? user.companyRole : null,
    userOrigin: typeof (user as { userOrigin?: string | null } | null)?.userOrigin === "string" ? (user as { userOrigin?: string | null }).userOrigin : typeof (user as { user_origin?: string | null } | null)?.user_origin === "string" ? (user as { user_origin?: string | null }).user_origin : null,
    clientSlug: activeClientSlug ?? (typeof user?.clientSlug === "string" ? user.clientSlug : null),
  }), [activeClientSlug, isGlobalAdmin, user]);

  const roleForFiltering = useMemo<SystemRole | null>(() => effectiveRole, [effectiveRole]);
  const isInstitutional = useMemo(() => isInstitutionalCompanyAccount(user), [user]);
  const isClientProfile = effectiveRole === SYSTEM_ROLES.EMPRESA || effectiveRole === SYSTEM_ROLES.COMPANY_USER || isInstitutional;

  const modules = useMemo<NavModuleDef[]>(() => {
    if (!user) return [];
    const catalog = isClientProfile ? buildClientCatalog() : NAV_CATALOG;
    const filtered = buildNavigationForUser(filterByActiveContext(catalog, companySlug), roleForFiltering, permissions, accessContext);
    const resolved = filtered
      .map((mod) => resolveModuleItems(mod, companySlug, activeProjectSlug, companyRouteInput, effectiveRole, permissions))
      .filter((mod) => mod.href || mod.items.length > 0);
    return withReleaseAgendaModule(resolved, effectiveRole, permissions);
  }, [user, isClientProfile, roleForFiltering, permissions, accessContext, companySlug, activeProjectSlug, companyRouteInput, effectiveRole]);

  return { modules, loading, companySlug, effectiveRole, isGlobalAdmin };
}
