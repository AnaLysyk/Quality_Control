"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef } from "react";
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
  
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useI18n } from "@/hooks/useI18n";
import { useClientContext } from "@/context/ClientContext";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";
const debugSidebar = process.env.NEXT_PUBLIC_DEBUG_SIDEBAR === "true";

type AppRole = "admin" | "client" | "user" | "it_dev";

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
};

export default function Sidebar({ pathname, mobileOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const logoSrc = useMemo(() => (menuLogoEnv ? menuLogoEnv : "/images/tc.png"), []);
  const { user, loading, visibility } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();
  const { t } = useI18n();

  

  const legacyUser = (user ?? null) as unknown as { is_global_admin?: boolean } | null;

  const normalizedRole = typeof user?.role === "string" ? user.role.toLowerCase() : null;
  const isGlobalAdmin =
    user?.isGlobalAdmin === true ||
    legacyUser?.is_global_admin === true ||
    normalizedRole === "admin" ||
    normalizedRole === "global_admin";

  const appRole = useMemo<AppRole | null>(() => {
    if (!user) return null;
    const role = (user.role ?? "").toLowerCase();
    if (["it_dev", "itdev", "developer", "dev"].includes(role)) return "it_dev";
    if (isGlobalAdmin) return "admin";
    if (["client_owner", "client_manager", "client_admin", "company", "company_admin"].includes(role)) return "client";
    if (["client_member", "client_user", "user"].includes(role)) return "user";
    return "user";
  }, [user, isGlobalAdmin]);

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
    return activeClientSlug ?? user?.clientSlug ?? null;
  }, [pathname, activeClientSlug, user?.clientSlug, isGlobalAdmin]);

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
    if (isGlobalAdmin) return "/admin/home";
    if (companySlug) return buildCompanyPathForAccess(companySlug, "home", companyRouteInput);
    return "/";
  }, [isGlobalAdmin, companySlug, companyRouteInput]);

  const publicNav: NavItem[] = useMemo(
    () => [
      { label: t("nav.home"), icon: FiHome, href: "/" },
      { label: t("nav.companies"), icon: FiUsers, href: "/empresas" },
      { label: "Identidade Visual", icon: FiCompass, href: "/brand-identity" },
    ],
    [t]
  );

  const adminNav: NavItem[] = useMemo(() => {
    const companyTarget = activeClientSlug ? adminCompanyHref : "/empresas";
    const items: NavItem[] = [
      { label: t("nav.dashboard"), icon: FiCompass, href: "/admin/home" },
      { label: t("nav.metrics"), icon: FiBarChart2, href: "/admin/test-metric" },
      { label: "Runs", icon: FiList, href: "/admin/runs" },
      { label: "Defeitos", icon: FiAlertTriangle, href: "/admin/defeitos" },
      { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
    ];

    if (activeClientSlug) {
      items.push(
        { label: t("nav.apps"), icon: FiBriefcase, href: `${companyTarget}/aplicacoes` },
        { label: t("nav.runs"), icon: FiList, href: `${companyTarget}/runs` },
        { label: t("nav.defects"), icon: FiAlertTriangle, href: `${companyTarget}/defeitos` },
      );
    }

    items.push(
      { label: "Suporte", icon: FiColumns, href: "/admin/support" },
      { label: "Gestão", icon: FiShield, href: "/admin/users/permissions" },
      { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
      { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    );

    return items;
  }, [t, activeClientSlug, adminCompanyHref]);

  const itDevNav: NavItem[] = useMemo(() => {
    return adminNav.filter((item) => item.href !== "/admin/home" || item.label === t("nav.dashboard"));
  }, [adminNav, t]);

  const companyNav: NavItem[] = useMemo(
    () =>
      companySlug
        ? [
            { label: t("nav.home"), icon: FiHome, href: buildCompanyPathForAccess(companySlug, "home", companyRouteInput) },
            { label: t("nav.dashboard"), icon: FiGrid, href: buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput) },
            { label: t("nav.metrics"), icon: FiBarChart2, href: buildCompanyPathForAccess(companySlug, "metrics", companyRouteInput) },
            { label: t("nav.apps"), icon: FiBriefcase, href: buildCompanyPathForAccess(companySlug, "aplicacoes", companyRouteInput) },
            { label: t("nav.testPlans"), icon: FiClipboard, href: buildCompanyPathForAccess(companySlug, "planos-de-teste", companyRouteInput) },
            { label: t("nav.runs"), icon: FiList, href: buildCompanyPathForAccess(companySlug, "runs", companyRouteInput) },
            { label: t("nav.defects"), icon: FiAlertTriangle, href: buildCompanyPathForAccess(companySlug, "defeitos", companyRouteInput) },
            { label: "Suporte", icon: FiColumns, href: buildCompanyPathForAccess(companySlug, "chamados", companyRouteInput) },
          ]
        : [],
    [companyRouteInput, companySlug, t]
  );

  const navigation = useMemo(() => {
    if (loading) return [];
    if (!user) return publicNav;
    // If the current path is inside a company, prefer the company navigation
    if (pathname.startsWith("/empresas/") && companyNav.length) return companyNav;
    if (appRole === "admin") return adminNav;
    if (appRole === "it_dev") return itDevNav;
    if (companyNav.length) return companyNav;
    return publicNav;
  }, [loading, user, appRole, adminNav, itDevNav, companyNav, publicNav, pathname]);

  function resolveModuleFromHref(href: string) {
    if (href === "/admin/users/permissions") return "permissions";
    if (href === "/admin/chamados") return "support";
    if (href === "/meus-chamados") return "support";
    if (href === "/admin/support" || href === "/kanban-it") return "support";
    if (href === "/empresas" || href === "/admin/clients") return "applications";
    if (href === "/admin/home") return "dashboard";
    if (href === "/admin/runs") return "runs";
    if (href === "/admin/defeitos") return "defects";
    if (href === "/admin/access-requests") return "access_requests";
    if (href === "/admin/audit-logs") return "audit";
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

  const renderNavLinks = (isMobile = false) =>
    visibleNavigation.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
                ? "bg-white/12 ring-1 ring-white/16 shadow-[0_14px_30px_rgba(1,24,72,0.3)] text-white"
                : "text-white/74 hover:bg-white/8 hover:text-white"
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
              className={`flex items-center justify-center w-11 h-11 rounded-[14px] border transition-all duration-200 shrink-0 backdrop-blur-sm sidebar-icon ${
                isActive
                  ? "border-white/16 bg-white/14 text-white shadow-[0_12px_26px_rgba(1,24,72,0.28)]"
                  : "border-white/10 bg-white/6 text-white/84 group-hover/link:border-white/18 group-hover/link:bg-white/10 group-hover/link:text-white"
              }`}
            >
              <item.icon size={20} />
            </div>
            <span className="inline-flex whitespace-normal text-left leading-snug flex-1 overflow-hidden pl-3 sidebar-label">
              {item.label}
            </span>
          </Link>
        );
      });

  const DesktopNav = (
    <aside
      className="hidden lg:flex fixed left-0 top-0 z-40 h-screen overflow-hidden border-r border-white/10 text-white flex-col bg-[linear-gradient(180deg,rgba(1,24,72,0.98)_0%,rgba(6,27,82,0.97)_52%,rgba(87,8,25,0.95)_100%)] shadow-[0_28px_80px_rgba(1,24,72,0.34)] backdrop-blur-2xl sidebar-shell"
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
    >
      <div className="flex items-center px-3 py-4 border-b border-white/8 relative">
        <Link
          href={logoHref}
          className="flex items-center gap-3 transition-all duration-200 justify-start w-full px-2 sidebar-logo"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-white/14 bg-white/10 backdrop-blur sidebar-logo-mark">
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
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/58">Testing Company</span>
            <span className="text-base font-semibold tracking-[0.02em] text-white">Quality Control</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 px-3 py-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55 transition duration-150 sidebar-divider">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-white/12 sidebar-divider-line" aria-hidden />
            </div>
            <div className="space-y-3">{renderNavLinks()}</div>
          </div>
        </div>
      </nav>

    </aside>
  );

  const MobileNav =
    mobileOpen &&
    onClose && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden dark:bg-black/60" onClick={onClose}>
        <aside
          data-app-role={appRole ?? ""}
          data-active-client={activeClientSlug ?? ""}
          data-is-global-admin={isGlobalAdmin ? "1" : "0"}
          className="flex h-full w-72 text-white flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(1,24,72,0.98)_0%,rgba(6,27,82,0.97)_52%,rgba(87,8,25,0.95)_100%)] shadow-[0_24px_60px_rgba(1,24,72,0.34)] backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 p-4 border-b border-white/10 relative">
            <Link href={logoHref} className="flex items-center gap-3" onClick={onClose}>
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-white/14 bg-white/10">
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
                <span className="text-[11px] uppercase tracking-[0.22em] text-white/58">Testing Company</span>
                <span className="text-sm font-semibold tracking-wide text-white">Quality Control</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll">
            <div className="flex-1 px-3 py-4 space-y-6">
              <div className="space-y-2">
                <p className="px-1 text-xs uppercase tracking-[0.18em] text-white/52">Navegacao</p>
                <div className="space-y-2">{renderNavLinks(true)}</div>
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="text-sm text-white/46">Testing Company Platform</div>
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
