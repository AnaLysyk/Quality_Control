"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
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
  FiMessageSquare,
  
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { useClientContext } from "@/context/ClientContext";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";

type AppRole = "admin" | "client" | "user" | "it_dev";

type NavItem = {
  label: string;
  icon: typeof FiHome;
  href: string;
  roles?: AppRole[];
};

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const logoSrc = useMemo(() => (menuLogoEnv ? menuLogoEnv : "/images/tc.png"), []);
  const pathname = usePathname() || "";
  const { user } = useAuthUser();
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
    if (isGlobalAdmin) return "admin";
    const role = (user.role ?? "").toLowerCase();
    if (["it_dev", "itdev", "developer", "dev"].includes(role)) return "it_dev";
    if (["client_owner", "client_manager", "client_admin"].includes(role)) return "client";
    if (["client_member", "client_user", "user"].includes(role)) return "user";
    return "user";
  }, [user, isGlobalAdmin]);

  try {
    // debug: expose context used by tests
    console.debug("[SIDEBAR] debug", { user, activeClientSlug, isGlobalAdmin, appRole, pathname });
  } catch {}

  const companySlug = useMemo(() => {
    const match = pathname.match(/^\/empresas\/([^/]+)/);
    if (match?.[1]) return match[1];
    if (isGlobalAdmin) return activeClientSlug ?? null;
    return activeClientSlug ?? user?.clientSlug ?? null;
  }, [pathname, activeClientSlug, user?.clientSlug, isGlobalAdmin]);

  const adminCompanyHref = useMemo(() => {
    if (activeClientSlug) return `/empresas/${activeClientSlug}`;
    return "/empresas";
  }, [activeClientSlug]);

  const logoHref = useMemo(() => {
    if (isGlobalAdmin) return "/admin/home";
    if (companySlug) return `/empresas/${companySlug}/home`;
    return "/";
  }, [isGlobalAdmin, companySlug]);

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
      { label: t("nav.adminPanel"), icon: FiCompass, href: "/admin/home" },
      { label: t("nav.metrics"), icon: FiBarChart2, href: "/admin/test-metric" },
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
      { label: "Chamados", icon: FiMessageSquare, href: "/admin/chamados" },
      { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
      { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    );

    return items;
  }, [t, activeClientSlug, adminCompanyHref]);

  const itDevNav: NavItem[] = useMemo(
    () => [
      { label: "Chamados", icon: FiColumns, href: "/kanban-it" },
    ],
    []
  );

  const companyNav: NavItem[] = useMemo(
    () =>
      companySlug
        ? [
            { label: t("nav.home"), icon: FiHome, href: `/empresas/${companySlug}/home` },
            { label: t("nav.dashboard"), icon: FiGrid, href: `/empresas/${companySlug}/dashboard` },
            { label: t("nav.metrics"), icon: FiBarChart2, href: `/empresas/${companySlug}/metrics` },
            { label: t("nav.apps"), icon: FiBriefcase, href: `/empresas/${companySlug}/aplicacoes` },
            { label: t("nav.testPlans"), icon: FiClipboard, href: `/empresas/${companySlug}/planos-de-teste` },
            { label: t("nav.runs"), icon: FiList, href: `/empresas/${companySlug}/runs` },
            { label: t("nav.defects"), icon: FiAlertTriangle, href: `/empresas/${companySlug}/defeitos` },
            { label: "Chamados", icon: FiMessageSquare, href: "/meus-chamados", roles: ["client", "user", "admin"] },
          ]
        : [],
    [companySlug, t]
  );

  const navigation = useMemo(() => {
    if (!user) return publicNav;
    // If the current path is inside a company, prefer the company navigation
    if (pathname.startsWith("/empresas/") && companyNav.length) return companyNav;
    if (appRole === "admin") return adminNav;
    if (appRole === "it_dev") return itDevNav;
    if (companyNav.length) return companyNav;
    return publicNav;
  }, [user, appRole, adminNav, itDevNav, companyNav, publicNav, pathname]);

  const renderNavLinks = (isMobile = false) =>
    navigation
      .filter((item) => !item.roles || (appRole ? item.roles.includes(appRole) : false))
      .map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.label}
            href={item.href}
            prefetch={false}
            className={`group/link relative flex items-center h-11 w-full rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden min-w-0 sidebar-link ${
              isMobile
                ? "px-3 justify-start gap-3"
                : "px-3 justify-start gap-3"
            } ${
              isActive
                ? "bg-[--tc-surface-2] ring-1 ring-[--tc-primary]/40 shadow-[0_10px_24px_rgba(78,141,245,0.18)] text-[--tc-text] dark:bg-[--tc-surface-dark]/10 dark:ring-[--tc-primary]/50 dark:shadow-[0_12px_30px_rgba(78,141,245,0.35)] dark:text-[--tc-text-inverse]"
                : "text-[--tc-text-muted] hover:bg-[--tc-surface-2] hover:text-[--tc-text] dark:text-[--tc-text-inverse]/80 dark:hover:bg-[--tc-surface-dark]/7 dark:hover:text-[--tc-text-inverse]"
            }`}
            onClick={isMobile && onClose ? onClose : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-[--tc-primary] transition-all ${
                isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
              }`}
            />
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-[14px] border transition-all duration-200 shrink-0 backdrop-blur-sm sidebar-icon ${
                isActive
                  ? "border-[--tc-primary]/50 bg-[--tc-primary]/10 text-[--tc-primary] shadow-[0_10px_22px_rgba(78,141,245,0.2)] dark:border-[--tc-primary]/60 dark:bg-[--tc-primary]/12 dark:text-[--tc-primary] dark:shadow-[0_12px_28px_rgba(78,141,245,0.25)]"
                  : "border-[--tc-border] bg-[--tc-surface] text-[--tc-primary] group-hover/link:border-[--tc-primary]/35 group-hover/link:bg-[--tc-surface-2] dark:border-[--tc-border]/12 dark:bg-[--tc-surface-dark]/6 dark:text-[--tc-primary] dark:group-hover/link:bg-[--tc-surface-dark]/10"
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
      className="hidden lg:flex fixed left-0 top-0 z-40 h-screen overflow-hidden border-r border-slate-200 text-slate-900 flex-col bg-white/70 backdrop-blur-2xl shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:border-white/10 dark:text-white dark:bg-[linear-gradient(180deg,#03123b_0%,#051a52_60%,#03123b_100%)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)] sidebar-shell"
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
    >
      <div className="flex items-center px-2 py-3 border-b border-slate-200/70 dark:border-white/5 relative">
        <Link
          href={logoHref}
          prefetch={false}
          className="flex items-center gap-3 transition-all duration-200 justify-start w-full px-2 sidebar-logo"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 backdrop-blur dark:border-white/10 dark:bg-white/5 sidebar-logo-mark">
            <span
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(78,141,245,0.15),transparent_55%)]"
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
              className="absolute inset-0 m-auto h-7 w-7 text-slate-900 dark:text-white sidebar-logo-icon"
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
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/55">Plataforma</span>
            <span className="text-base font-semibold tracking-wide text-slate-900 dark:text-white">Quality Control</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 px-3 py-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/55 transition duration-150 sidebar-divider">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-slate-200 dark:bg-white/15 sidebar-divider-line" aria-hidden />
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
          className="flex h-full w-72 bg-white text-slate-900 flex-col border-r border-slate-200 shadow-[0_12px_28px_rgba(15,23,42,0.16)] dark:bg-linear-to-b dark:from-[#0b1021]/95 dark:via-[#0f1830]/92 dark:to-[#0b1021]/95 dark:text-white dark:border-white/10 dark:shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-white/10 relative">
            <Link href={logoHref} prefetch={false} className="flex items-center gap-3" onClick={onClose}>
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
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
                  className="absolute inset-0 m-auto h-7 w-7 text-slate-900 dark:text-white sidebar-logo-icon"
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
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">Plataforma</span>
                <span className="text-sm font-semibold tracking-wide text-[#2563eb] dark:text-[#4e8df5]">Quality Control</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll">
            <div className="flex-1 px-3 py-4 space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/45 px-1">Navegacao</p>
                <div className="space-y-2">{renderNavLinks(true)}</div>
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-white/10">
            <div className="text-sm text-slate-500 dark:text-white/50">...</div>
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
