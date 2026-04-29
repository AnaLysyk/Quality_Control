"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiClipboard,
  FiCompass,
  FiColumns,
  FiGrid,
  FiHome,
  FiList,
  FiShield,
  FiCpu,
  FiBookOpen,
  FiMessageSquare,
  FiStar,
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

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

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
    const match = pathname.match(/^\/empresas\/([^/]+)/);
    if (match?.[1]) return match[1];
    if (isGlobalAdmin) return activeClientSlug ?? null;
    return activeClientSlug ?? normalizedUser.primaryCompanySlug ?? null;
  }, [pathname, activeClientSlug, normalizedUser.primaryCompanySlug, isGlobalAdmin]);

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
    { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
    { label: t("nav.support"), icon: FiColumns, href: "/admin/support" },
    { label: t("nav.management"), icon: FiShield, href: "/admin/users/permissions" },
    { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
    { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    { label: "Brain", icon: FiCpu, href: "/admin/brain" },
    { label: "Documentacao", icon: FiBookOpen, href: "/documentacao" },
    { label: "Conversas", icon: FiMessageSquare, href: "/conversas" },
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
            { label: "Documentacao", icon: FiBookOpen, href: "/documentacao" },
            { label: "Conversas", icon: FiMessageSquare, href: "/conversas" },
          ]
        : [],
    [companyRouteInput, companySlug, companyRunsMenuLabel, t]
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
    // testing_company_user not in company context → runs goes to /operacao hub
    if (appRole === "user" && companyNav.length && !isInstitutionalCompany) {
      return companyNav.map((item) =>
        /\/runs$/.test(item.href) ? { ...item, href: "/operacao" } : item,
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
    if (href === "/admin/operacao") return "runs";
    if (href === "/admin/runs") return "runs";
    if (href === "/operacao") return null; // hub — bypass permission check
    if (href === "/runs") return null; // legacy hub redirect
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
          return Boolean(visibility[moduleId]);
        }),
    [navigation, appRole, visibility],
  );

  function prefetchHref(href: string) {
    if (!href || href === pathname || prefetchedRoutesRef.current.has(href)) return;
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

  const favoriteNavigation = useMemo(
    () => favoriteHrefs
      .map((href) => visibleNavigation.find((item) => item.href === href))
      .filter((item): item is NavItem => Boolean(item)),
    [favoriteHrefs, visibleNavigation],
  );

  const renderNavLinks = (isMobile = false, items = visibleNavigation) =>
    items.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        const isFavorite = favoriteHrefs.includes(item.href);

        return (
          <div key={item.href} className="group/item relative flex items-center">
            <Link
              href={item.href}
              prefetch={false}
              className={`group/link relative flex items-center h-10 w-full rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden min-w-0 sidebar-link ${
              isMobile
                ? "px-3 justify-start gap-3"
                : "px-3 justify-start gap-3"
            } ${
              isActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 shadow-[0_14px_30px_rgba(1,24,72,0.3)] text-white"
                : "sidebar-link-state-idle text-white/74 hover:bg-white/8 hover:text-white"
            }`}
              onMouseEnter={() => prefetchHref(item.href)}
              onFocus={() => prefetchHref(item.href)}
              onClick={isMobile && onClose ? onClose : undefined}
            >
              <span
                aria-hidden
                className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-(--tc-accent,#ef0001) transition-all ${
                  isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
                }`}
              />
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-[14px] border transition-all duration-200 shrink-0 backdrop-blur-sm sidebar-icon ${
                  isActive
                    ? "sidebar-icon-state-active border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.28)]"
                    : "sidebar-icon-state-idle border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
                }`}
              >
                <item.icon size={17} />
              </div>
              <span className="sidebar-label flex-1 overflow-hidden pl-3 pr-8 text-left leading-snug truncate">
                {item.label}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => toggleFavorite(item.href)}
              className={`absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                isFavorite ? "text-yellow-300 opacity-100" : "text-white/40 opacity-0 group-hover/item:opacity-100 focus:opacity-100"
              }`}
              aria-label={isFavorite ? `Remover ${item.label} dos favoritos` : `Adicionar ${item.label} aos favoritos`}
              title={isFavorite ? "Remover dos favoritos" : "Favoritar"}
            >
              <FiStar className={isFavorite ? "fill-current" : ""} size={14} />
            </button>
          </div>
        );
      });

  const DesktopNav = (
    <aside
      className="sidebar-shell sidebar-shell-theme hidden fixed left-0 top-0 z-40 h-screen overflow-hidden border-r text-white flex-col backdrop-blur-2xl lg:flex"
      suppressHydrationWarning
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
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
        <div className="flex-1 px-3 py-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center px-1">
              <p className="sidebar-nav-caption text-xs uppercase tracking-[0.18em] text-white/55 transition duration-150 sidebar-divider">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-white/12 sidebar-divider-line" aria-hidden />
            </div>
            {favoriteNavigation.length > 0 ? (
              <div className="mb-3 space-y-2 rounded-2xl border border-white/8 bg-white/5 p-2">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Favoritos</p>
                {renderNavLinks(false, favoriteNavigation)}
              </div>
            ) : null}
            <div className="space-y-2">{renderNavLinks()}</div>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer shrink-0 px-4 py-3">
        <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
        <div className="sidebar-footer-note pt-2 text-[0.78rem] font-light italic tracking-[0.02em] text-white/46">
          <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
            Testing Company Platform
          </a>
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
          className="sidebar-mobile-theme flex h-full w-72 text-white flex-col border-r backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 p-4 border-b border-white/10 relative">
            <Link href={logoHref} className="flex items-center gap-3" onClick={onClose}>
              <div className="sidebar-logo-mark-theme relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border">
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
              <div className="flex flex-col">
                <span className="sidebar-brand-kicker text-[11px] uppercase tracking-[0.22em] text-white/58">Testing Company</span>
                <span className="sidebar-brand-title text-sm font-semibold tracking-wide text-white">Quality Control</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 px-3 py-3 space-y-3">
              <div className="space-y-2">
                <p className="sidebar-nav-caption px-1 text-xs uppercase tracking-[0.18em] text-white/52">Navegacao</p>
                {favoriteNavigation.length > 0 ? (
                  <div className="mb-3 space-y-2 rounded-2xl border border-white/8 bg-white/5 p-2">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Favoritos</p>
                    {renderNavLinks(true, favoriteNavigation)}
                  </div>
                ) : null}
                <div className="space-y-2">{renderNavLinks(true)}</div>
              </div>
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
