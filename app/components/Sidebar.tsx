"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiClipboard,
  FiCompass,
  FiColumns,
  FiChevronRight,
  FiBookmark,
  FiGrid,
  FiHome,
  FiList,
  FiShield,
  FiCpu,
  FiMessageSquare,
  FiPlus,
  FiTool,
  FiUser,
  FiUserPlus,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { useI18n } from "@/hooks/useI18n";
import { useClientContext } from "@/context/ClientContext";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { buildCompanyPathForAccess, parseCompanyRoutePathname } from "@/lib/companyRoutes";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";
import { hasAdminClientToolAccess } from "@/lib/adminClientAccess";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";
const debugSidebar = process.env.NEXT_PUBLIC_DEBUG_SIDEBAR === "true";
const FAVORITES_STORAGE_KEY = "qc:sidebar:favorites:v1";

type AppRole = "admin" | "client" | "user" | "technical_support";

type NavItem = {
  label: string;
  icon: typeof FiHome;
  href: string;
  roles?: AppRole[];
};

type SidebarMenuItem = {
  id: string;
  label: string;
  icon: typeof FiHome;
  href?: string;
  description?: string;
  children?: SidebarMenuItem[];
};

type SidebarMenuSection = {
  id: string;
  label: string;
  icon: typeof FiHome;
  href?: string;
  description: string;
  items: SidebarMenuItem[];
};

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

function normalizeHref(href: string) {
  const trimmed = href.trim();
  const hashIndex = trimmed.indexOf("#");
  const queryIndex = trimmed.indexOf("?");
  const pathEnd =
    hashIndex === -1
      ? queryIndex === -1
        ? trimmed.length
        : queryIndex
      : queryIndex === -1
        ? hashIndex
        : Math.min(queryIndex, hashIndex);
  const path = trimmed.slice(0, pathEnd) || "/";
  const query = queryIndex === -1 ? "" : trimmed.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
  return { path, query };
}

function isHrefActive(href: string, pathname: string, searchQuery: string) {
  const { path, query } = normalizeHref(href);
  if (path === "/") return pathname === "/";
  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;
  if (!query) return true;
  const expected = new URLSearchParams(query);
  const current = new URLSearchParams(searchQuery);
  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

function resolveModuleFromHref(href: string) {
  if (href === "/admin/users/permissions") return "permissions";
  if (href === "/admin/chamados") return "support";
  if (href === "/meus-chamados") return "support";
  if (href === "/admin/support" || href === "/kanban-it") return "support";
  if (href === "/empresas" || href === "/admin/clients") return "applications";
  if (href === "/admin/dashboard") return "dashboard";
  if (href === "/admin/operacao") return "runs";
  if (href === "/admin/runs") return "runs";
  if (href === "/operacao") return null;
  if (href === "/runs") return null;
  if (href === "/admin/defeitos") return "defects";
  if (href === "/admin/access-requests") return "access_requests";
  if (href === "/admin/audit-logs") return "audit";
  if (href === "/admin/brain") return null;
  if (/^\/empresas\/[^/]+\/(home|dashboard)$/.test(href)) return "dashboard";
  if (/^\/empresas\/[^/]+\/aplicacoes$/.test(href)) return "applications";
  if (/^\/empresas\/[^/]+\/runs$/.test(href)) return "runs";
  if (/^\/empresas\/[^/]+\/defeitos$/.test(href)) return "defects";
  if (/^\/empresas\/[^/]+\/releases$/.test(href)) return "releases";
  if (/^\/empresas\/[^/]+\/chamados$/.test(href)) return "support";
  return null;
}

function resolveSidebarModuleFromHref(href: string) {
  const { path } = normalizeHref(href);
  const legacyResolved = resolveModuleFromHref(href);
  if (path === "/admin/users/permissions") return "permissions";
  if (path === "/admin/users") return "users";
  if (path === "/admin/chamados") return "support";
  if (path === "/meus-chamados") return "support";
  if (path === "/admin/support" || path === "/kanban-it") return "support";
  if (path === "/empresas" || path === "/admin/clients") return "applications";
  if (path === "/admin/dashboard") return "dashboard";
  if (path === "/admin/test-metric" || path === "/admin/metrics" || path === "/metrics") return "metrics";
  if (path === "/admin/operacao") return "runs";
  if (path === "/admin/runs") return "runs";
  if (path === "/operacao") return null;
  if (path === "/runs") return null;
  if (path === "/admin/defeitos") return "defects";
  if (path === "/admin/access-requests") return "access_requests";
  if (path === "/admin/audit-logs") return "audit";
  if (path === "/admin/brain" || path === "/chat") return "ai";
  if (path === "/planos-de-teste" || path === "/admin/test-plans") return "testPlans";
  if (/^\/empresas\/[^/]+\/(home|dashboard)$/.test(path)) return "dashboard";
  if (/^\/empresas\/[^/]+\/aplicacoes$/.test(path)) return "applications";
  if (/^\/empresas\/[^/]+\/runs$/.test(path)) return "runs";
  if (/^\/empresas\/[^/]+\/defeitos$/.test(path)) return "defects";
  if (/^\/empresas\/[^/]+\/releases$/.test(path)) return "releases";
  if (/^\/empresas\/[^/]+\/chamados$/.test(path)) return "support";
  return legacyResolved;
}

export default function Sidebar({ pathname, mobileOpen = false, onClose, mobilePanelId }: SidebarProps) {
  const router = useRouter();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const [favoriteHrefs, setFavoriteHrefs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const { user, loading, visibility, normalizedUser } = usePermissionAccess();
  const logoSrc = useMemo(() => {
    const dbLogo = typeof user?.companyLogoUrl === "string" ? user.companyLogoUrl.trim() : "";
    if (dbLogo) return dbLogo;
    if (menuLogoEnv) return menuLogoEnv;
    return "/images/tc.png";
  }, [user?.companyLogoUrl]);
  const { activeClientSlug } = useClientContext();
  const { t } = useI18n();

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteHrefs));
    } catch {
      /* ignore */
    }
  }, [favoriteHrefs]);

  const legacyUser = (user ?? null) as unknown as { is_global_admin?: boolean } | null;
  const parsedCompanyRoute = useMemo(() => parseCompanyRoutePathname(pathname), [pathname]);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();

  const normalizedRole =
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null);
  const isTechnicalSupport = normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const isGlobalAdmin =
    !isTechnicalSupport &&
    (user?.isGlobalAdmin === true ||
      legacyUser?.is_global_admin === true ||
      normalizedRole === SYSTEM_ROLES.LEADER_TC);
  const isInstitutionalCompany = isInstitutionalCompanyAccount(user ?? null);
  const isOperationalProfile =
    normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC ||
    normalizedRole === SYSTEM_ROLES.TESTING_COMPANY_USER;
  const canUseAdminClientTools = hasAdminClientToolAccess(user);
  const adminRunsMenuLabel = isOperationalProfile ? t("nav.operations") : t("nav.runsManagement");
  const companyRunsMenuLabel = isOperationalProfile ? t("nav.operations") : t("nav.runs");

  const appRole = useMemo<AppRole | null>(() => {
    if (!user) return null;
    if (isInstitutionalCompany) return "client";
    const role =
      normalizeLegacyRole(typeof user.permissionRole === "string" ? user.permissionRole : null) ??
      normalizeLegacyRole(typeof user.role === "string" ? user.role : null) ??
      normalizeLegacyRole(typeof user.companyRole === "string" ? user.companyRole : null);
    if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "technical_support";
    if (isGlobalAdmin) return "admin";
    if (role === SYSTEM_ROLES.EMPRESA || role === SYSTEM_ROLES.COMPANY_USER) return "client";
    if (role === SYSTEM_ROLES.TESTING_COMPANY_USER) return "user";
    return "user";
  }, [user, isGlobalAdmin, isInstitutionalCompany]);

  if (debugSidebar) {
    try {
      console.debug("[SIDEBAR] debug", {
        userId: user?.id ?? null,
        role: user?.role ?? null,
        activeClientSlug,
        isGlobalAdmin,
        appRole,
      pathname,
      });
    } catch {}
  }

  const companySlug = useMemo(() => {
    if (parsedCompanyRoute?.targetSlug) return parsedCompanyRoute.targetSlug;
    if (isGlobalAdmin) return activeClientSlug ?? null;
    return activeClientSlug ?? normalizedUser.primaryCompanySlug ?? null;
  }, [parsedCompanyRoute, activeClientSlug, normalizedUser.primaryCompanySlug, isGlobalAdmin]);

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
      clientSlug: normalizedUser.primaryCompanySlug ?? activeClientSlug ?? null,
      defaultClientSlug: normalizedUser.defaultCompanySlug ?? null,
      companyCount: normalizedUser.companyCount,
    }),
    [activeClientSlug, isGlobalAdmin, normalizedUser, user],
  );

  const logoHref = useMemo(() => {
    if (isGlobalAdmin) return "/admin/dashboard";
    if (companySlug) return buildCompanyPathForAccess(companySlug, "home", companyRouteInput);
    return "/";
  }, [isGlobalAdmin, companySlug, companyRouteInput]);

  const publicNav: NavItem[] = useMemo(
    () => [
      { label: t("nav.home"), icon: FiHome, href: "/" },
      { label: t("nav.companies"), icon: FiUsers, href: "/empresas" },
      { label: t("nav.brandIdentity"), icon: FiCompass, href: "/brand-identity" },
    ],
    [t]
  );

  const adminNav: NavItem[] = useMemo(() => [
    { label: t("nav.dashboard"), icon: FiCompass, href: "/admin/dashboard" },
    { label: t("nav.metrics"), icon: FiBarChart2, href: "/admin/test-metric" },
    { label: adminRunsMenuLabel, icon: FiList, href: "/admin/operacao" },
    { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
    { label: t("nav.users"), icon: FiUsers, href: "/admin/users?tab=company" },
    { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
    { label: t("nav.support"), icon: FiColumns, href: "/admin/support" },
    { label: t("nav.management"), icon: FiShield, href: "/admin/users/permissions" },
    { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
    { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    { label: "Brain", icon: FiCpu, href: "/admin/brain" },
    { label: "Conversas", icon: FiMessageSquare, href: "/chat" },
  ], [t, adminRunsMenuLabel]);

  const supportNav: NavItem[] = useMemo(() => {
    return adminNav;
  }, [adminNav]);

  const companyNav: NavItem[] = useMemo(
    () =>
      companySlug
        ? [
            { label: t("nav.home"), icon: FiHome, href: buildCompanyPathForAccess(companySlug, "home", companyRouteInput) },
            { label: t("nav.dashboard"), icon: FiGrid, href: buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput) },
            { label: t("nav.metrics"), icon: FiBarChart2, href: buildCompanyPathForAccess(companySlug, "metrics", companyRouteInput) },
            { label: t("nav.apps"), icon: FiBriefcase, href: buildCompanyPathForAccess(companySlug, "aplicacoes", companyRouteInput) },
            { label: t("nav.testPlans"), icon: FiClipboard, href: buildCompanyPathForAccess(companySlug, "planos-de-teste", companyRouteInput) },
            { label: t("nav.automations"), icon: FiZap, href: "/automacoes", roles: ["admin", "technical_support", "user", "client"] },
            { label: companyRunsMenuLabel, icon: FiList, href: buildCompanyPathForAccess(companySlug, "runs", companyRouteInput) },
            { label: t("nav.defects"), icon: FiAlertTriangle, href: buildCompanyPathForAccess(companySlug, "defeitos", companyRouteInput) },
            { label: t("nav.support"), icon: FiColumns, href: buildCompanyPathForAccess(companySlug, "chamados", companyRouteInput) },
            { label: "Conversas", icon: FiMessageSquare, href: "/chat" },
          ]
        : [],
    [companyRouteInput, companySlug, companyRunsMenuLabel, t]
  );

  const navigation = useMemo(() => {
    if (loading) return [];
    if (!user) return publicNav;
    const isSupportScopedRoute =
      parsedCompanyRoute?.kind === "technical_support" || parsedCompanyRoute?.kind === "leader_tc";
    const isCompanyScopedRoute =
      pathname.startsWith("/empresas/") ||
      parsedCompanyRoute?.kind === "empresa" ||
      parsedCompanyRoute?.kind === "company_user" ||
      parsedCompanyRoute?.kind === "testing_company_user";
    if (isSupportScopedRoute && supportNav.length) return supportNav;
    if (isCompanyScopedRoute && companyNav.length) return companyNav;
    if (appRole === "admin") return adminNav;
    if (appRole === "technical_support") return supportNav;
    // testing_company_user not in company context → runs goes to /operacao hub
    if (appRole === "user" && companyNav.length && !isInstitutionalCompany) {
      return companyNav.map((item) =>
        /\/runs$/.test(item.href) ? { ...item, href: "/operacao" } : item,
      );
    }
    if (companyNav.length) return companyNav;
    return publicNav;
  }, [loading, user, appRole, adminNav, supportNav, companyNav, publicNav, pathname, isInstitutionalCompany, parsedCompanyRoute]);

  const visibleNavigation = useMemo(
    () =>
      navigation
        .filter((item) => !item.roles || (appRole ? item.roles.includes(appRole) : false))
        .filter((item) => {
          const moduleId = resolveSidebarModuleFromHref(item.href);
          if (!moduleId) return true;
          const isCompanyScopedLink = /^\/empresas\/[^/]+\//.test(item.href);
          if (isCompanyScopedLink && ["runs", "releases", "defects", "support"].includes(moduleId)) {
            return true;
          }
          return Boolean(visibility[moduleId]);
        }),
    [navigation, appRole, visibility],
  );

  function prefetchHref(href: string) {
    const { path } = normalizeHref(href);
    if (!href || (path === pathname && isHrefActive(href, pathname, searchQuery)) || prefetchedRoutesRef.current.has(href)) return;
    prefetchedRoutesRef.current.add(href);
    try {
      router.prefetch(href);
    } catch {
      prefetchedRoutesRef.current.delete(href);
    }
  }

  function toggleFavorite(href: string) {
    setFavoriteHrefs((current) =>
      current.includes(href) ? current.filter((item) => item !== href) : [...current, href],
    );
  }

  const visibleNavByPath = useMemo(() => {
    const byPath = new Map<string, NavItem>();
    for (const item of visibleNavigation) {
      const { path } = normalizeHref(item.href);
      if (!byPath.has(path)) byPath.set(path, item);
    }
    return byPath;
  }, [visibleNavigation]);

  const moduleNavigation = useMemo(() => {
    const buckets = new Map<string, NavItem[]>();
    for (const item of visibleNavigation) {
      const moduleId = resolveSidebarModuleFromHref(item.href);
      if (!moduleId) continue;
      const current = buckets.get(moduleId) ?? [];
      current.push(item);
      buckets.set(moduleId, current);
    }
    return buckets;
  }, [visibleNavigation]);

  const findVisibleNavItem = useCallback(
    (href: string) => {
      const { path } = normalizeHref(href);
      return visibleNavByPath.get(path) ?? null;
    },
    [visibleNavByPath],
  );

  function toMenuItem(
    item: NavItem,
    overrides: Partial<Pick<SidebarMenuItem, "id" | "label" | "icon" | "href" | "description" | "children">> = {},
  ): SidebarMenuItem {
    return {
      id: overrides.id ?? item.href,
      label: overrides.label ?? item.label,
      icon: overrides.icon ?? item.icon,
      href: overrides.href ?? item.href,
      description: overrides.description,
      children: overrides.children,
    };
  }

  function isMenuItemActive(item: SidebarMenuItem): boolean {
    if (item.href && isHrefActive(item.href, pathname, searchQuery)) return true;
    return Boolean(item.children?.some((child) => isMenuItemActive(child)));
  }

  const desktopSections = useMemo<SidebarMenuSection[]>(() => {
    const uniqueByHref = (items: SidebarMenuItem[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = item.href ?? item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const companiesItems: SidebarMenuItem[] = [];
    const companiesBase = findVisibleNavItem("/admin/clients") ?? findVisibleNavItem("/empresas");
    if (companiesBase) {
      companiesItems.push(
        toMenuItem(companiesBase, {
          id: "companies-list",
          description: companiesBase.href === "/admin/clients" ? "Visão da base de empresas" : "Catálogo público de empresas",
        }),
      );
    }
    if (canUseAdminClientTools) {
      companiesItems.push({
        id: "companies-create",
        label: "Criar empresa",
        icon: FiPlus,
        href: "/admin/clients?create=1",
        description: "Abrir o cadastro da nova empresa",
      });
    }

    const usersBase = findVisibleNavItem("/admin/users") ?? findVisibleNavItem("/admin/users?tab=company");
    if (usersBase && canUseAdminClientTools) {
      companiesItems.push({
        id: "companies-users",
        label: t("nav.users"),
        icon: FiUsers,
        href: "/admin/users?tab=company",
        description: "Gestão de usuários e perfis",
        children: [
          {
            id: "users-company",
            label: "Empresa e usuários",
            icon: FiHome,
            href: "/admin/users?tab=company",
            description: "Usuários vinculados à empresa",
          },
          {
            id: "users-testing",
            label: "Usuários TC",
            icon: FiUser,
            href: "/admin/users?tab=testing",
            description: "Contas do time TC",
          },
          {
            id: "users-admin",
            label: "Lider TC",
            icon: FiShield,
            href: "/admin/users?tab=admin",
            description: "Perfis administrativos",
          },
          {
            id: "users-support",
            label: "Suporte Técnico",
            icon: FiTool,
            href: "/admin/users?tab=support",
            description: "Perfis de suporte técnico",
          },
          {
            id: "users-create",
            label: "Criar usuário",
            icon: FiUserPlus,
            href: "/admin/users?tab=company&create=1",
            description: "Abrir o modal de criação",
          },
        ],
      });
    } else if (usersBase) {
      companiesItems.push(
        toMenuItem(usersBase, {
          id: "companies-users",
          label: t("nav.users"),
          description: "Gestão de usuários",
        }),
      );
    }

    const permissionsItem = findVisibleNavItem("/admin/users/permissions");
    if (permissionsItem) {
      companiesItems.push(
        toMenuItem(permissionsItem, {
          id: "companies-permissions",
          description: "Perfis, regras e permissões",
        }),
      );
    }

    const operationsItems = uniqueByHref([
      ...(moduleNavigation.get("dashboard") ?? []).map((item) =>
        toMenuItem(item, { description: item.href.startsWith("/admin/") ? "Painel executivo" : "Visão da empresa" }),
      ),
      ...(moduleNavigation.get("metrics") ?? []).map((item) =>
        toMenuItem(item, { description: "Indicadores e leitura analítica" }),
      ),
      ...(moduleNavigation.get("runs") ?? []).map((item) =>
        toMenuItem(item, { description: "Execuções e acompanhamento" }),
      ),
      ...(moduleNavigation.get("testPlans") ?? []).map((item) =>
        toMenuItem(item, { description: "Planos e campanhas de teste" }),
      ),
      ...(moduleNavigation.get("defects") ?? []).map((item) =>
        toMenuItem(item, { description: "Triagem de defeitos" }),
      ),
      ...(findVisibleNavItem("/operacao")
        ? [toMenuItem(findVisibleNavItem("/operacao")!, { id: "operations-hub", description: "Atalho operacional" })]
        : []),
      ...(findVisibleNavItem("/runs")
        ? [toMenuItem(findVisibleNavItem("/runs")!, { id: "operations-legacy-hub", description: "Redirecionamento legado" })]
        : []),
      ...(findVisibleNavItem("/automacoes")
        ? [toMenuItem(findVisibleNavItem("/automacoes")!, { id: "operations-automations", description: "Fluxos e automações" })]
        : []),
    ]);

    const supportItems = uniqueByHref([
      ...(moduleNavigation.get("support") ?? []).map((item) =>
        toMenuItem(item, { description: "Central de suporte e chamados" }),
      ),
      ...(moduleNavigation.get("access_requests") ?? []).map((item) =>
        toMenuItem(item, { description: "Solicitações de acesso" }),
      ),
      ...(moduleNavigation.get("audit") ?? []).map((item) =>
        toMenuItem(item, { description: "Registros e auditoria" }),
      ),
    ]);

    const assistantItems = uniqueByHref([
      ...(moduleNavigation.get("ai") ?? []).map((item) =>
        toMenuItem(item, { description: item.href === "/chat" ? "Conversas e atalhos" : "Painel de Brain" }),
      ),
    ]);

    const brandItem = findVisibleNavItem("/brand-identity");
    const brandItems = brandItem
      ? [
          toMenuItem(brandItem, {
            id: "brand-identity",
            description: "Identidade visual da plataforma",
          }),
        ]
      : [];

    const sections: SidebarMenuSection[] = [];

    if (companiesItems.length > 0) {
      sections.push({
        id: "companies",
        label: t("nav.companies"),
        icon: FiUsers,
        href: companiesBase?.href ?? usersBase?.href ?? "/admin/clients",
        description: "Empresas, usuários e permissões",
        items: companiesItems,
      });
    }

    if (operationsItems.length > 0) {
      sections.push({
        id: "operations",
        label: t("nav.operations"),
        icon: FiGrid,
        href: operationsItems[0]?.href,
        description: "Leitura executiva e execução operacional",
        items: operationsItems,
      });
    }

    if (supportItems.length > 0) {
      sections.push({
        id: "support",
        label: t("nav.support"),
        icon: FiColumns,
        href: supportItems[0]?.href,
        description: "Chamados, solicitações e auditoria",
        items: supportItems,
      });
    }

    if (assistantItems.length > 0) {
      sections.push({
        id: "assistant",
        label: t("nav.brain"),
        icon: FiCpu,
        href: assistantItems[0]?.href,
        description: "Brain e conversas",
        items: assistantItems,
      });
    }

    if (brandItems.length > 0) {
      sections.push({
        id: "brand",
        label: t("nav.brandIdentity"),
        icon: FiCompass,
        href: brandItems[0]?.href,
        description: "Identidade visual da plataforma",
        items: brandItems,
      });
    }

    return sections;
  }, [
    canUseAdminClientTools,
    findVisibleNavItem,
    moduleNavigation,
    t,
  ]);

  const actionLookup = useMemo(() => {
    const map = new Map<string, SidebarMenuItem>();
    const visit = (item: SidebarMenuItem) => {
      if (item.href) map.set(item.href, item);
      item.children?.forEach(visit);
    };
    desktopSections.forEach((section) => section.items.forEach(visit));
    return map;
  }, [desktopSections]);

  const favoriteNavigation = useMemo<SidebarMenuItem[]>(
    () =>
      favoriteHrefs
        .map((href) => actionLookup.get(href))
        .filter((item): item is SidebarMenuItem => Boolean(item)),
    [favoriteHrefs, actionLookup],
  );

  function renderMenuRow(item: SidebarMenuItem, depth = 0) {
    const isActive = item.href ? isHrefActive(item.href, pathname, searchQuery) : false;
    const rowActive = isActive || Boolean(item.children?.some((child) => isMenuItemActive(child)));
    const isFavorite = item.href ? favoriteHrefs.includes(item.href) : false;
    const hasChildren = Boolean(item.children?.length);

    return (
      <div key={item.id} className={`group/menu-item relative ${depth > 0 ? "pl-1" : ""}`}>
        <Link
          href={item.href ?? "#"}
          prefetch={false}
          className={`relative flex items-start gap-3 rounded-2xl border px-3 py-3 pr-16 text-left transition ${
            rowActive
              ? "border-white/20 bg-white/14 text-white shadow-[0_14px_30px_rgba(1,24,72,0.24)]"
              : "border-white/10 bg-white/6 text-white/88 hover:border-white/18 hover:bg-white/10 hover:text-white"
          }`}
          onMouseEnter={() => item.href && prefetchHref(item.href)}
          onFocus={() => item.href && prefetchHref(item.href)}
          onClick={() => onClose?.()}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border transition ${
              rowActive
                ? "border-white/16 bg-white/14 text-white"
                : "border-white/10 bg-white/8 text-white/86 group-hover/menu-item:border-white/18 group-hover/menu-item:bg-white/12 group-hover/menu-item:text-white"
            }`}
          >
            <item.icon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-5">{item.label}</div>
            {item.description ? <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-white/64">{item.description}</div> : null}
          </div>
        </Link>

        {item.href ? (
          <button
            type="button"
            onClick={() => toggleFavorite(item.href!)}
            className={`absolute right-9 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition ${
              isFavorite ? "text-amber-300 opacity-100" : "text-white/36 opacity-85 hover:text-white"
            }`}
            aria-label={isFavorite ? `Remover ${item.label} dos favoritos` : `Adicionar ${item.label} aos favoritos`}
            title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          >
            <FiBookmark className={isFavorite ? "fill-current" : ""} size={14} />
          </button>
        ) : null}

        {hasChildren ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/52">
            <FiChevronRight size={14} />
          </span>
        ) : null}

        {hasChildren ? (
          <div className="pointer-events-none invisible absolute left-full top-0 z-50 ml-3 w-[18.5rem] opacity-0 transition duration-150 group-hover/menu-item:pointer-events-auto group-hover/menu-item:visible group-hover/menu-item:opacity-100 group-focus-within/menu-item:pointer-events-auto group-focus-within/menu-item:visible group-focus-within/menu-item:opacity-100">
            <div className="sidebar-shell-theme rounded-[26px] border border-white/12 p-3 shadow-[0_24px_70px_rgba(1,24,72,0.32)] backdrop-blur-2xl">
              <div className="border-b border-white/10 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/56">Submenu</p>
                <div className="mt-1 text-lg font-bold text-white">{item.label}</div>
                {item.description ? <p className="mt-1 text-sm leading-6 text-white/68">{item.description}</p> : null}
              </div>
              <div className="mt-3 space-y-2">
                {item.children?.map((child) => renderMenuRow(child, depth + 1))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderPanel(title: string, description: string, items: SidebarMenuItem[]) {
    return (
      <div className="sidebar-shell-theme w-[20rem] rounded-[28px] border border-white/12 p-3 text-white shadow-[0_26px_80px_rgba(1,24,72,0.34)] backdrop-blur-2xl">
        <div className="border-b border-white/10 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">{title}</p>
          <p className="mt-1 text-sm leading-6 text-white/72">{description}</p>
        </div>
        <div className="mt-3 space-y-2">{items.map((item) => renderMenuRow(item))}</div>
      </div>
    );
  }

  function renderFlatLinks(items: Array<Pick<NavItem, "label" | "href" | "icon">>, isMobile = false) {
    return items.map((item) => {
      const isActive = isHrefActive(item.href, pathname, searchQuery);
      const isFavorite = favoriteHrefs.includes(item.href);

      return (
        <div key={item.href} className="group/item relative flex items-center">
          <Link
            href={item.href}
            prefetch={false}
            className={`group/link relative flex h-10 w-full min-w-0 items-center overflow-hidden rounded-xl text-sm font-semibold transition-all duration-200 ${
              isMobile ? "justify-start gap-3 px-3" : "justify-start gap-3 px-3"
            } ${
              isActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
                : "sidebar-link-state-idle text-white/76 hover:bg-white/8 hover:text-white"
            }`}
            onMouseEnter={() => prefetchHref(item.href)}
            onFocus={() => prefetchHref(item.href)}
            onClick={isMobile && onClose ? () => onClose() : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-(--tc-accent,#ef0001) transition-all ${
                isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
              }`}
            />
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200 backdrop-blur-sm ${
                isActive
                  ? "sidebar-icon-state-active border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.28)]"
                  : "sidebar-icon-state-idle border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
              }`}
            >
              <item.icon size={17} />
            </div>
            <span className="sidebar-label flex-1 overflow-hidden pr-8 text-left leading-snug truncate">{item.label}</span>
          </Link>
          <button
            type="button"
            onClick={() => toggleFavorite(item.href)}
            className={`absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
              isFavorite ? "text-amber-300 opacity-100" : "text-white/40 opacity-85 hover:text-white"
            }`}
            aria-label={isFavorite ? `Remover ${item.label} dos favoritos` : `Adicionar ${item.label} aos favoritos`}
            title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
          >
            <FiBookmark className={isFavorite ? "fill-current" : ""} size={14} />
          </button>
        </div>
      );
    });
  }

  const DesktopNav = (
    <aside
      className="sidebar-shell sidebar-shell-theme hidden fixed left-0 top-0 z-40 h-screen overflow-visible border-r text-white backdrop-blur-2xl lg:flex"
      suppressHydrationWarning
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
    >
      <div className="flex h-full w-full flex-col px-3 py-4">
        <div className="flex items-center justify-center pb-4">
          <Link href={logoHref} className="sidebar-logo flex items-center justify-center">
            <div className="sidebar-logo-mark sidebar-logo-mark-theme relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border backdrop-blur">
              <span
                className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(255,255,255,0.18),transparent_56%)]"
                aria-hidden
              />
              <Image
                src={logoSrc}
                alt="Logo"
                width={48}
                height={48}
                className="sidebar-logo-image sidebar-logo-full pointer-events-none select-none object-contain p-1"
              />
              <svg
                viewBox="0 0 64 64"
                aria-hidden="true"
                className="sidebar-logo-icon absolute inset-0 m-auto h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="32" cy="32" r="26" />
                <path d="M24 40l16-16" />
                <path d="M22 46h20" />
              </svg>
            </div>
            <div className="sidebar-brand hidden">
              <span className="sidebar-brand-kicker">Testing Company</span>
              <span className="sidebar-brand-title">Quality Control</span>
            </div>
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="sidebar-nav-caption hidden px-1 text-xs uppercase tracking-[0.18em] text-white/55">
              Navegacao
            </div>
            <div className="space-y-2">
              {desktopSections.map((section) => (
                <div key={section.id} className="group/root relative">
                  <Link
                    href={section.href ?? "/"}
                    prefetch={false}
                    className={`flex h-12 w-12 items-center justify-center rounded-[18px] border transition ${
                      section.items.some((item) => isMenuItemActive(item))
                        ? "border-white/18 bg-white/16 text-white shadow-[0_14px_28px_rgba(1,24,72,0.3)]"
                        : "border-white/10 bg-white/8 text-white/86 hover:border-white/20 hover:bg-white/12 hover:text-white"
                    }`}
                    title={section.label}
                    aria-label={section.label}
                    onMouseEnter={() => section.href && prefetchHref(section.href)}
                    onFocus={() => section.href && prefetchHref(section.href)}
                  >
                    <section.icon size={17} />
                  </Link>

                  <div className="pointer-events-none invisible absolute left-full top-0 z-50 ml-3 w-[20rem] opacity-0 transition duration-150 group-hover/root:pointer-events-auto group-hover/root:visible group-hover/root:opacity-100 group-focus-within/root:pointer-events-auto group-focus-within/root:visible group-focus-within/root:opacity-100">
                    {renderPanel(section.label, section.description, section.items)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="group/root relative">
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/8 text-white/86 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
                title={t("nav.favorites")}
                aria-label={t("nav.favorites")}
              >
                <FiBookmark size={17} />
              </button>

              <div className="pointer-events-none invisible absolute bottom-0 left-full z-50 ml-3 max-h-[calc(100vh-2rem)] w-[20rem] overflow-y-auto opacity-0 transition duration-150 group-hover/root:pointer-events-auto group-hover/root:visible group-hover/root:opacity-100 group-focus-within/root:pointer-events-auto group-focus-within/root:visible group-focus-within/root:opacity-100">
                <div className="sidebar-shell-theme rounded-[28px] border border-white/12 p-3 text-white shadow-[0_26px_80px_rgba(1,24,72,0.34)] backdrop-blur-2xl">
                  <div className="border-b border-white/10 pb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">{t("nav.favorites")}</p>
                    <p className="mt-1 text-sm leading-6 text-white/72">Atalhos salvos para abrir em poucos cliques.</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {favoriteNavigation.length > 0 ? (
                      favoriteNavigation.map((item) => renderMenuRow(item))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm text-white/64">
                        Nenhum favorito salvo ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sidebar-footer hidden">
              <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
              <div className="sidebar-footer-note pt-2 text-[0.78rem] font-light italic tracking-[0.02em] text-white/46">
                <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                  Testing Company Platform
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );

  const MobileNav =
    mobileOpen &&
    onClose && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden dark:bg-black/60" onClick={onClose}>
        <aside
          id={mobilePanelId}
          suppressHydrationWarning
          data-app-role={appRole ?? ""}
          data-active-client={activeClientSlug ?? ""}
          data-is-global-admin={isGlobalAdmin ? "1" : "0"}
          className="sidebar-mobile-theme flex h-full w-72 flex-col border-r text-white backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-white/10 p-4 relative">
            <Link href={logoHref} className="flex items-center gap-3" onClick={onClose}>
              <div className="sidebar-logo-mark-theme relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border">
                <Image
                  src={logoSrc}
                  alt="Logo"
                  width={48}
                  height={48}
                  className="sidebar-logo-image sidebar-logo-full pointer-events-none select-none object-contain p-1"
                />
                <svg
                  viewBox="0 0 64 64"
                  aria-hidden="true"
                  className="sidebar-logo-icon absolute inset-0 m-auto h-7 w-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="32" cy="32" r="26" />
                  <path d="M24 40l16-16" />
                  <path d="M22 46h20" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="sidebar-brand-kicker text-[11px] uppercase tracking-[0.22em] text-white/58">Testing Company</span>
                <span className="sidebar-brand-title text-sm font-semibold tracking-wide text-white">Quality Control</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 p-3">
              {favoriteNavigation.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-white/8 bg-white/5 p-2">
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{t("nav.favorites")}</p>
                  {renderFlatLinks(favoriteNavigation)}
                </div>
              ) : null}
              <div className="space-y-2">{renderFlatLinks(visibleNavigation)}</div>
            </div>
          </nav>

          <div className="sidebar-footer shrink-0 p-3">
            <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
            <div className="sidebar-footer-note pt-2 text-[0.78rem] font-light italic tracking-[0.02em] text-white/46">
              <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                Testing Company Platform
              </a>
            </div>
          </div>
        </aside>
      </div>
    );

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}
