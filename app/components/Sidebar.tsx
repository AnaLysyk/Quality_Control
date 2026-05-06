"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiClipboard,
  FiCode,
  FiCompass,
  FiColumns,
  FiChevronRight,
  FiBookmark,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHash,
  FiHome,
  FiList,
  FiShield,
  FiCpu,
  FiUserPlus,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { useI18n } from "@/hooks/useI18n";
import { useClientContext } from "@/context/ClientContext";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";

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

type MobileMenuPanel =
  | { kind: "root" }
  | { kind: "submenu"; itemId: string }
  | { kind: "favorites" };

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

export default function Sidebar({ pathname, mobileOpen = false, onClose, mobilePanelId }: SidebarProps) {
  const router = useRouter();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const { user, loading, visibility } = usePermissionAccess();
  const logoSrc = useMemo(() => {
    const dbLogo = typeof user?.companyLogoUrl === "string" ? user.companyLogoUrl.trim() : "";
    if (dbLogo) return dbLogo;
    if (menuLogoEnv) return menuLogoEnv;
    return "/images/tc.png";
  }, [user?.companyLogoUrl]);
  const { activeClientSlug } = useClientContext();
  const { t } = useI18n();
  const rootFlyoutRef = useRef<HTMLDivElement>(null);
  const submenuFlyoutRef = useRef<HTMLDivElement>(null);
  const rootTriggerRefs = useRef(new Map<string, HTMLAnchorElement>());
  const favoritesTriggerRef = useRef<HTMLButtonElement>(null);
  const closeFlyoutTimerRef = useRef<number | null>(null);
  const navListRef = useRef<HTMLDivElement>(null);

  const clearFlyoutCloseTimer = useCallback(() => {
    if (closeFlyoutTimerRef.current === null) return;
    window.clearTimeout(closeFlyoutTimerRef.current);
    closeFlyoutTimerRef.current = null;
  }, []);

  const closeSmartFlyouts = useCallback(() => {
    clearFlyoutCloseTimer();
    setActiveFlyoutId(null);
    setActiveSubmenuId(null);
    setRootFlyoutPlacement(null);
    setSubFlyoutPlacement(null);
  }, [clearFlyoutCloseTimer]);

  const scheduleSmartFlyoutClose = useCallback(() => {
    clearFlyoutCloseTimer();
    closeFlyoutTimerRef.current = window.setTimeout(() => {
      closeSmartFlyouts();
    }, SMART_FLYOUT_CLOSE_DELAY);
  }, [clearFlyoutCloseTimer, closeSmartFlyouts]);

  const openSmartFlyout = useCallback(
    (id: string) => {
      clearFlyoutCloseTimer();
      setActiveFlyoutId(id);
      setActiveSubmenuId(null);
      setRootFlyoutPlacement(null);
      setSubFlyoutPlacement(null);
    },
    [clearFlyoutCloseTimer],
  );

  const openSmartSubmenu = useCallback(
    (id: string | null) => {
      clearFlyoutCloseTimer();
      setActiveSubmenuId(id);
      setSubFlyoutPlacement(null);
    },
    [clearFlyoutCloseTimer],
  );

  const bumpFlyoutRevision = useCallback(() => {
    setFlyoutRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!favoritesHydratedRef.current) return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteHrefs));
    } catch {
      /* ignore */
    }
  }, [favoriteHrefs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setFavoriteHrefs(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
    } catch {
      setFavoriteHrefs([]);
    }
    favoritesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewport = () => {
      setViewport(readViewportSize());
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!activeFlyoutId || typeof window === "undefined") return undefined;
    const resizeTimer = window.setTimeout(() => {
      bumpFlyoutRevision();
    }, 220);
    return () => window.clearTimeout(resizeTimer);
  }, [activeFlyoutId, bumpFlyoutRevision]);

  useEffect(() => {
    closeSmartFlyouts();
  }, [pathname, closeSmartFlyouts]);

  useEffect(() => {
    setMobileMenuPanel({ kind: "root" });
  }, [pathname, mobileOpen]);

  useEffect(() => {
    if (!activeFlyoutId) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSmartFlyouts();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (rootFlyoutRef.current?.contains(target)) return;
      if (submenuFlyoutRef.current?.contains(target)) return;
      if (favoritesTriggerRef.current?.contains(target)) return;
      for (const trigger of rootTriggerRefs.current.values()) {
        if (trigger.contains(target)) return;
      }

      closeSmartFlyouts();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [activeFlyoutId, closeSmartFlyouts]);

  useEffect(() => {
    return () => {
      if (closeFlyoutTimerRef.current === null) return;
      window.clearTimeout(closeFlyoutTimerRef.current);
    };
  }, []);

  const legacyUser = (user ?? null) as unknown as { is_global_admin?: boolean } | null;
  const parsedCompanyRoute = useMemo(() => parseSidebarCompanyRoutePathname(pathname), [pathname]);
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
      clientSlug: typeof user?.clientSlug === "string" ? user.clientSlug : activeClientSlug ?? null,
    }),
    [activeClientSlug, isGlobalAdmin, user],
  );

  const adminCompanyHref = useMemo(() => {
    if (activeClientSlug) return `/empresas/${activeClientSlug}`;
    return "/empresas";
  }, [activeClientSlug]);

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
    { label: t("nav.runs"), icon: FiList, href: "/admin/runs" },
    { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
    { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
    { label: t("nav.support"), icon: FiColumns, href: "/admin/support" },
    { label: t("nav.management"), icon: FiShield, href: "/admin/users/permissions" },
    { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
    { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    { label: "Brain", icon: FiCpu, href: "/admin/brain" },
  ], [t]);

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
            { label: t("nav.runs"), icon: FiList, href: buildCompanyPathForAccess(companySlug, "runs", companyRouteInput) },
            { label: t("nav.defects"), icon: FiAlertTriangle, href: buildCompanyPathForAccess(companySlug, "defeitos", companyRouteInput) },
            { label: t("nav.support"), icon: FiColumns, href: buildCompanyPathForAccess(companySlug, "chamados", companyRouteInput) },
          ]
        : [],
    [companyRouteInput, companySlug, t]
  );

  const navigation = useMemo(() => {
    if (loading) return [];
    if (!user) return publicNav;
    // Company-scoped paths take priority for all roles
    const isOnCompanyPage =
      pathname.startsWith("/empresas/") ||
      /^\/(suporte|lider-tc|user-tc)\/[^/]+/.test(pathname);
    if (isOnCompanyPage && companyNav.length) return companyNav;
    if (appRole === "admin") return adminNav;
    if (appRole === "technical_support") return supportNav;
    // testing_company_user not in company context → runs goes to /runs hub
    if (appRole === "user" && companyNav.length && !isInstitutionalCompany) {
      return companyNav.map((item) =>
        /\/runs$/.test(item.href) ? { ...item, href: "/runs" } : item,
      );
    }
    if (companyNav.length) return companyNav;
    return publicNav;
  }, [loading, user, appRole, adminNav, supportNav, companyNav, publicNav, pathname, isInstitutionalCompany]);

  function resolveModuleFromHref(href: string) {
    if (href === "/admin/users/permissions") return "permissions";
    if (href === "/admin/chamados") return "support";
    if (href === "/meus-chamados") return "support";
    if (href === "/admin/support" || href === "/kanban-it") return "support";
    if (href === "/empresas" || href === "/admin/clients") return "applications";
    if (href === "/admin/dashboard") return "dashboard";
    if (href === "/admin/runs") return "runs";
    if (href === "/runs") return null; // hub — bypass permission check
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

  const visibleNavigation = useMemo(
    () =>
      navigation
        .filter((item) => !item.roles || (appRole ? item.roles.includes(appRole) : false))
        .filter((item) => {
          const moduleId = resolveModuleFromHref(item.href);
          if (!moduleId) return true;
          const isCompanyScopedLink = /^\/empresas\/[^/]+\//.test(item.href);
          if (isCompanyScopedLink && ["runs", "releases", "defects", "support"].includes(moduleId)) {
            return true;
          }
          const moduleId = resolveSidebarModuleFromHref(item.href);
          if (!moduleId) return true;
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

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`group/link relative flex items-center h-11 w-full rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden min-w-0 sidebar-link ${
              isMobile
                ? "px-3 justify-start gap-3"
                : "px-3 justify-start gap-3"
            } ${
              isActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 shadow-[0_14px_30px_rgba(1,24,72,0.3)] text-white"
                : "sidebar-link-state-idle text-white/74 hover:bg-white/8 hover:text-white"
            }`}
          />
          <div
            className={`sidebar-icon-state-idle ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200 ${
              rowActive
                ? "sidebar-icon-state-active border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.22)]"
                : "border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
            }`}
          >
            <item.icon size={16} />
          </div>
          <div className="min-w-0 flex-1 px-3">
            <div className="text-sm font-semibold leading-5">{item.label}</div>
            {item.description ? <div className="mt-0.5 line-clamp-2 text-xs leading-5 opacity-70">{item.description}</div> : null}
          </div>
        </Link>

        {item.href ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleFavorite(item.href!);
            }}
            className={`absolute right-9 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition ${
              isFavorite
                ? "border-[rgba(239,0,1,0.72)] bg-(--tc-accent,#ef0001) text-white shadow-[0_8px_18px_rgba(239,0,1,0.2)]"
                : "border-transparent text-current opacity-40 hover:border-white/10 hover:bg-white/8 hover:opacity-100"
            }`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Desfixar ${item.label}` : `Fixar ${item.label}`}
            title={isFavorite ? "Desfixar atalho" : "Fixar atalho"}
          >
            <FiBookmark className={isFavorite ? "fill-current" : ""} size={14} />
          </button>
        ) : null}

        {hasChildren ? (
          <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-55 transition-transform ${canOpenSubmenu && activeSubmenuId === item.id ? "rotate-90 opacity-100" : ""}`}>
            <FiChevronRight size={14} />
          </span>
        ) : null}
      </div>
    );
  }

  function renderFlyoutPanel(
    title: string,
    description: string,
    items: SidebarMenuItem[],
    options?: { emptyLabel?: string; panelRef?: RefObject<HTMLDivElement | null>; placement?: FlyoutPlacement | null },
  ) {
    const placement = options?.placement ?? null;
    if (!placement) return null;

    return (
      <FlyoutPanel
        ref={options?.panelRef ?? undefined}
        placement={placement}
        onMouseEnter={clearFlyoutCloseTimer}
        onMouseLeave={scheduleSmartFlyoutClose}
        onFocusCapture={clearFlyoutCloseTimer}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            scheduleSmartFlyoutClose();
          }
        }}
      >
        <div className="border-b border-white/10 px-4 pb-3 pt-4">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          <p className="mt-1 text-xs leading-5 opacity-70">{description}</p>
        </div>
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-3" onScroll={bumpFlyoutRevision}>
          {items.length > 0 ? (
            items.map((item) => renderMenuRow(item))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm opacity-70">
              {options?.emptyLabel ?? "Nenhuma opção disponível."}
            </div>
          )}
        </div>
      </FlyoutPanel>
    );
  }

  function renderMobileItemRow(
    item: SidebarMenuItem,
    options: { allowDrilldown?: boolean; showFavoriteToggle?: boolean },
  ) {
    const href = item.href ?? null;
    const isActive = item.href ? isHrefActive(item.href, pathname, searchQuery) : false;
    const rowActive = isActive || Boolean(item.children?.some((child) => isMenuItemActive(child)));
    const canDrill = Boolean(options.allowDrilldown && item.children?.length);
    const showFavoriteToggle = Boolean(options.showFavoriteToggle);
    const reservedPadding = showFavoriteToggle ? (canDrill && href ? "pr-20" : "pr-16") : canDrill && href ? "pr-12" : "pr-4";

    return (
      <div key={item.id} className="group/mobile-item relative flex items-center">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className={`group/link relative flex h-12 w-full min-w-0 items-center overflow-hidden rounded-2xl ${reservedPadding} text-sm font-semibold transition-all duration-200 ${
              rowActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
                : "sidebar-link-state-idle text-white/86 hover:bg-white/8 hover:text-white"
            }`}
            onMouseEnter={() => prefetchHref(href)}
            onFocus={() => prefetchHref(href)}
            onClick={onClose ? () => onClose() : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-(--tc-accent,#ef0001) transition-all ${
                isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
              }`}
            />
            <div
              className={`ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200 backdrop-blur-sm ${
                isActive
                  ? "sidebar-icon-state-active border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.28)]"
                  : "sidebar-icon-state-idle border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
              }`}
            >
              <item.icon size={17} />
            </div>
            <span className="sidebar-label flex-1 overflow-hidden px-3 text-left leading-snug truncate">{item.label}</span>
          </Link>
        ) : (
          <button
            type="button"
            className={`group/link relative flex h-12 w-full min-w-0 items-center overflow-hidden rounded-2xl pr-4 text-sm font-semibold transition-all duration-200 ${
              rowActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
                : "sidebar-link-state-idle text-white/86 hover:bg-white/8 hover:text-white"
            }`}
            onClick={() => {
              setMobileMenuPanel({ kind: "submenu", itemId: item.id });
            }}
          >
            <div
              className={`ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200 backdrop-blur-sm ${
                rowActive
                  ? "sidebar-icon-state-active border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.28)]"
                  : "sidebar-icon-state-idle border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
              }`}
            >
              <item.icon size={17} />
            </div>
            <span className="sidebar-label flex-1 overflow-hidden px-3 text-left leading-snug truncate">{item.label}</span>
            <span className="pointer-events-none pr-3 text-white/52">
              <FiChevronRight size={14} />
            </span>
          </button>
        )}

        {href && showFavoriteToggle ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleFavorite(href);
            }}
            className={`absolute right-9 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border transition ${
              favoriteHrefs.includes(href)
                ? "border-[rgba(239,0,1,0.72)] bg-(--tc-accent,#ef0001) text-white shadow-[0_8px_18px_rgba(239,0,1,0.2)]"
                : "border-transparent text-current opacity-50 hover:border-white/10 hover:bg-white/8 hover:opacity-100"
            }`}
            aria-pressed={favoriteHrefs.includes(href)}
            aria-label={favoriteHrefs.includes(href) ? `Desfixar ${item.label}` : `Fixar ${item.label}`}
            title={favoriteHrefs.includes(href) ? "Desfixar atalho" : "Fixar atalho"}
          >
            <FiBookmark className={favoriteHrefs.includes(href) ? "fill-current" : ""} size={14} />
          </button>
        ) : null}

        {canDrill && href ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMobileMenuPanel({ kind: "submenu", itemId: item.id });
            }}
            className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-current opacity-55 transition hover:bg-white/6 hover:opacity-90 focus-visible:opacity-90"
            aria-label={`Abrir opções de ${item.label}`}
            title="Abrir submenu"
          >
            <FiChevronRight size={14} />
          </button>
        ) : null}
      </div>
    );
  }

  function renderDesktopNavigationItem(item: SidebarMenuItem) {
    const isActive = isMenuItemActive(item);
    const hasChildren = Boolean(item.children?.length);
    const isOpen = activeFlyoutId === item.id;
    const isHighlighted = activeFlyoutId ? isOpen : isActive;

    return (
      <div key={item.id} className="relative">
        <Link
          href={item.href ?? "#"}
          prefetch={false}
          ref={(node) => {
            if (node) {
              rootTriggerRefs.current.set(item.id, node);
              return;
            }
            rootTriggerRefs.current.delete(item.id);
          }}
          className={`sidebar-link group/link relative flex min-w-0 items-center overflow-hidden rounded-[18px] transition-all duration-200 ${
            isHighlighted
              ? "sidebar-link-state-active bg-white/14 text-white shadow-[0_14px_28px_rgba(1,24,72,0.26)]"
              : "sidebar-link-state-idle text-white/86 hover:bg-white/9 hover:text-white"
          }`}
          title={item.label}
          aria-label={item.label}
          aria-haspopup={hasChildren ? "menu" : undefined}
          aria-expanded={hasChildren ? isOpen : undefined}
          onMouseEnter={() => {
            if (item.href) prefetchHref(item.href);
            if (hasChildren) {
              openSmartFlyout(item.id);
            } else {
              closeSmartFlyouts();
            }
          }}
          onMouseLeave={hasChildren ? scheduleSmartFlyoutClose : undefined}
          onFocus={() => {
            if (item.href) prefetchHref(item.href);
            if (hasChildren) {
              openSmartFlyout(item.id);
            } else {
              closeSmartFlyouts();
            }
          }}
          onBlur={hasChildren ? scheduleSmartFlyoutClose : undefined}
          onClick={() => onClose?.()}
        >
          <span
            aria-hidden
            className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-(--tc-accent,#ef0001) transition-all ${
              isHighlighted ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`sidebar-menu-icon ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border transition-all duration-200 ${
              isHighlighted
                ? "sidebar-icon-state-active border-white/18 bg-white/16 text-white shadow-[0_12px_24px_rgba(1,24,72,0.22)]"
                : "sidebar-icon-state-idle border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
            }`}
          >
            <item.icon size={17} />
          </div>
          <div className="sidebar-label min-w-0 flex-1 px-3 py-1.5">
            <div className="text-sm font-semibold leading-5">{item.label}</div>
          </div>
          {hasChildren ? (
            <div className="sidebar-label shrink-0 pr-2 opacity-52 transition group-hover/link:opacity-90">
              <FiChevronRight size={15} />
            </div>
          ) : null}
        </Link>
      </div>
    );
  }

  const isFavoritesOpen = activeFlyoutId === "favorites";

  const DesktopNav = (
    <aside
      className="sidebar-shell sidebar-shell-theme hidden fixed left-0 top-0 z-40 h-screen overflow-hidden border-r text-white flex-col backdrop-blur-2xl lg:flex"
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
      data-flyout-open={activeFlyoutId ? "1" : "0"}
    >
      <div className="flex items-center px-3 py-4 border-b border-white/8 relative">
        <Link
          href={logoHref}
          className="flex items-center gap-3 transition-all duration-200 justify-start w-full px-2 sidebar-logo"
        >
          <div className="sidebar-logo-mark sidebar-logo-mark-theme relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border backdrop-blur">
            <span
              className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(255,255,255,0.18),transparent_56%)]"
              aria-hidden
            />
            <Image
              src={logoSrc}
              alt="Logo"
              width={48}
              height={48}
              className="object-contain p-1 pointer-events-none select-none sidebar-logo-image sidebar-logo-full"
            />
            <svg
              viewBox="0 0 64 64"
              aria-hidden="true"
              className="absolute inset-0 m-auto h-7 w-7 text-white sidebar-logo-icon"
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
          <div className="flex flex-col leading-tight transition duration-200 whitespace-nowrap sidebar-brand">
            <span className="sidebar-brand-kicker text-[11px] uppercase tracking-[0.24em] text-white/58">Testing Company</span>
            <span className="sidebar-brand-title text-base font-semibold tracking-[0.02em] text-white">Quality Control</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 px-3 py-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center px-1">
              <p className="sidebar-nav-caption text-xs uppercase tracking-[0.18em] text-white/55 transition duration-150 sidebar-divider">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-white/12 sidebar-divider-line" aria-hidden />
            </div>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer shrink-0 px-4 py-4">
        <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
        <div className="sidebar-footer-note pt-3 text-[0.82rem] font-light italic tracking-[0.02em] text-white/46">
          <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
            Testing Company Platform
          </a>
        </div>
      </div>

    </aside>
  );

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const DesktopFlyouts =
    portalTarget && activeFlyoutId && rootFlyoutPlacement
      ? createPortal(
          <>
            {renderFlyoutPanel(
              activeFlyoutTitle,
              activeFlyoutDescription,
              activeFlyoutItems,
              {
                emptyLabel:
                  activeFlyoutId === "favorites" ? "Nenhum favorito salvo ainda." : "Nenhuma opção disponível.",
                panelRef: rootFlyoutRef,
                placement: rootFlyoutPlacement,
              },
            )}
            {activeSubmenuItem && activeSubmenuItems.length > 0 && subFlyoutPlacement
              ? renderFlyoutPanel(
                  activeSubmenuItem.label,
                  activeSubmenuItem.description ?? "Opções disponíveis nesta área.",
                  activeSubmenuItems,
                  {
                    emptyLabel: "Nenhuma opção disponível.",
                    panelRef: submenuFlyoutRef,
                    placement: subFlyoutPlacement,
                  },
                )
              : null}
          </>,
          portalTarget,
        )
      : null;

  const MobileNav =
    mobileOpen &&
    onClose && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden dark:bg-black/60" onClick={onClose}>
        <aside
          id={mobilePanelId}
          data-app-role={appRole ?? ""}
          data-active-client={activeClientSlug ?? ""}
          data-is-global-admin={isGlobalAdmin ? "1" : "0"}
          className="sidebar-mobile-theme flex h-full w-72 text-white flex-col border-r backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-white/10 p-4 relative">
            <Link href={logoHref} className="flex items-center gap-3" onClick={onClose}>
              <div className="sidebar-logo-mark-theme relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border">
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

          <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll">
            <div className="flex-1 px-3 py-4 space-y-6">
              <div className="space-y-2">
                <p className="sidebar-nav-caption px-1 text-xs uppercase tracking-[0.18em] text-white/52">Navegacao</p>
                <div className="space-y-2">{renderNavLinks(true)}</div>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer shrink-0 p-4">
            <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
            <div className="sidebar-footer-note pt-3 text-[0.82rem] font-light italic tracking-[0.02em] text-white/46">
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
      {DesktopFlyouts}
      {MobileNav}
    </>
  );
}
