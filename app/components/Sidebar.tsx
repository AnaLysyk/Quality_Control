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
  FiGrid,
  FiHome,
  FiLayers,
  FiList,
  FiPlusCircle,
  FiShield,
  FiUser,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { useClientContext } from "@/context/ClientContext";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";

type AppRole = "admin" | "client" | "user";

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
    if (["client_owner", "client_manager", "client_admin"].includes(role)) return "client";
    if (["client_member", "client_user", "user"].includes(role)) return "user";
    return "user";
  }, [user, isGlobalAdmin]);

  const companySlug = useMemo(() => {
    const match = pathname.match(/^\/empresas\/([^/]+)/);
    return match?.[1] ?? activeClientSlug ?? user?.clientSlug ?? null;
  }, [pathname, activeClientSlug, user?.clientSlug]);

  const publicNav: NavItem[] = useMemo(
    () => [
      { label: t("nav.home"), icon: FiHome, href: "/" },
      { label: t("nav.dashboard"), icon: FiGrid, href: "/dashboard" },
      { label: t("nav.metrics"), icon: FiBarChart2, href: "/metricas" },
      { label: t("nav.newRun"), icon: FiPlusCircle, href: "/admin/runs", roles: ["admin", "client", "user"] },
    ],
    [t]
  );

  const adminNav: NavItem[] = useMemo(
    () => [
      { label: t("nav.dashboard"), icon: FiGrid, href: "/dashboard" },
      { label: t("nav.metrics"), icon: FiBarChart2, href: "/metricas" },
      { label: t("nav.adminPanel"), icon: FiCompass, href: "/admin/home" },
      { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
      { label: t("nav.runsManagement"), icon: FiLayers, href: "/admin/runs" },
      { label: t("nav.defects"), icon: FiShield, href: "/admin/defeitos" },
      { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
      { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    ],
    [t]
  );

  const companyNav: NavItem[] = useMemo(
    () =>
      companySlug
        ? [
            { label: t("nav.profile"), icon: FiUser, href: `/empresas/${companySlug}/home` },
            { label: t("nav.dashboard"), icon: FiGrid, href: `/empresas/${companySlug}/dashboard` },
            { label: t("nav.metrics"), icon: FiBarChart2, href: `/empresas/${companySlug}/metricas` },
            { label: t("nav.apps"), icon: FiBriefcase, href: `/empresas/${companySlug}/aplicacoes` },
            { label: t("nav.testPlans"), icon: FiClipboard, href: `/empresas/${companySlug}/planos-de-teste` },
            { label: t("nav.runs"), icon: FiList, href: `/empresas/${companySlug}/runs` },
            { label: t("nav.defects"), icon: FiAlertTriangle, href: `/empresas/${companySlug}/defeitos` },
            { label: t("nav.runsManagement"), icon: FiLayers, href: "/admin/runs", roles: ["admin", "client", "user"] },
          ]
        : [],
    [companySlug, t]
  );

  const navigation = useMemo(() => {
    if (!user) return publicNav;
    if (appRole === "admin" && !companySlug) return adminNav;
    if (companyNav.length) return companyNav;
    return appRole === "admin" ? adminNav : publicNav;
  }, [user, appRole, companySlug, adminNav, companyNav, publicNav]);

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
            className={`group/link relative flex items-center h-11 w-full rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden min-w-0 ${
              isMobile
                ? "px-3 justify-start gap-3"
                : "lg:px-0 lg:justify-center lg:gap-0 lg:group-hover/sidebar:px-3 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3"
            } ${
              isActive
                ? "bg-slate-100 ring-1 ring-[#4e8df5]/40 shadow-[0_10px_24px_rgba(78,141,245,0.18)] text-slate-900 dark:bg-white/10 dark:ring-[#4e8df5]/50 dark:shadow-[0_12px_30px_rgba(78,141,245,0.35)] dark:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/7 dark:hover:text-white"
            }`}
            onClick={isMobile && onClose ? onClose : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-[#4e8df5] transition-all ${
                isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
              }`}
            />
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-[14px] border transition-all duration-200 shrink-0 backdrop-blur-sm ${
                isActive
                  ? "border-[#4e8df5]/50 bg-[#4e8df5]/10 text-[#2563eb] shadow-[0_10px_22px_rgba(78,141,245,0.2)] dark:border-[#4e8df5]/60 dark:bg-[#4e8df5]/12 dark:text-[#4e8df5] dark:shadow-[0_12px_28px_rgba(78,141,245,0.25)]"
                  : "border-slate-200 bg-white text-[#2563eb] group-hover/link:border-[#4e8df5]/35 group-hover/link:bg-slate-100 dark:border-white/12 dark:bg-white/6 dark:text-[#4e8df5] dark:group-hover/link:bg-white/10"
              }`}
            >
              <item.icon size={20} />
            </div>
            <span className="hidden lg:inline-flex whitespace-normal text-left leading-snug flex-1 overflow-hidden max-w-0 opacity-0 transition-all duration-200 pl-0 lg:group-hover/sidebar:pl-3 lg:group-hover/sidebar:max-w-40 lg:group-hover/sidebar:opacity-100">
              {item.label}
            </span>
          </Link>
        );
      });

  const DesktopNav = (
    <aside
      className="group/sidebar hidden lg:flex fixed left-0 top-0 z-40 h-screen w-21 hover:w-65 overflow-hidden border-r border-slate-200 text-slate-900 flex-col bg-white backdrop-blur-2xl shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-[width] duration-200 ease-out dark:border-white/10 dark:text-white dark:bg-[linear-gradient(180deg,#03123b_0%,#051a52_60%,#03123b_100%)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center px-2 py-3 border-b border-slate-200/70 dark:border-white/5 relative">
        <Link
          href="/"
          className="flex items-center gap-0 lg:group-hover/sidebar:gap-3 transition-all duration-200 justify-center lg:group-hover/sidebar:justify-start w-full"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <span
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(78,141,245,0.15),transparent_55%)]"
              aria-hidden
            />
            <Image
              src={logoSrc}
              alt="Logo"
              width={48}
              height={48}
              className="object-cover pointer-events-none select-none"
            />
          </div>
          <div className="flex flex-col leading-tight opacity-0 lg:group-hover/sidebar:opacity-100 transition duration-200 whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/55">Painel QA</span>
            <span className="text-base font-semibold tracking-wide text-slate-900 dark:text-white">Testing Metric</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 px-3 py-6 space-y-6">
          <div className="flex items-center justify-center opacity-100 lg:opacity-100 lg:group-hover/sidebar:opacity-0 transition-all duration-200 -mt-1">
            <Link
              href="/"
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] hover:border-[#4e8df5]/40 hover:shadow-[0_10px_22px_rgba(78,141,245,0.18)] transition-all duration-200 dark:border-white/12 dark:bg-white/5 dark:shadow-[0_10px_22px_rgba(0,0,0,0.25)] dark:hover:border-[#4e8df5]/50 dark:hover:shadow-[0_12px_26px_rgba(78,141,245,0.22)]"
            >
              <Image
                src={logoSrc}
                alt="Logo TC"
                width={32}
                height={32}
                className="object-contain pointer-events-none select-none"
              />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center px-1">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-white/55 opacity-0 lg:group-hover/sidebar:opacity-100 transition duration-150">
                Navegacao
              </p>
              <span className="h-px flex-1 ml-3 bg-slate-200 dark:bg-white/15" aria-hidden />
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
          className="flex h-full w-72 bg-white text-slate-900 flex-col border-r border-slate-200 shadow-[0_12px_28px_rgba(15,23,42,0.16)] dark:bg-linear-to-b dark:from-[#0b1021]/95 dark:via-[#0f1830]/92 dark:to-[#0b1021]/95 dark:text-white dark:border-white/10 dark:shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-white/10 relative">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
              <Image
                src={logoSrc}
                alt="Logo"
                width={48}
                height={48}
                className="object-cover pointer-events-none select-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">Painel QA</span>
              <span className="text-sm font-semibold tracking-wide text-[#2563eb] dark:text-[#4e8df5]">Testing Metric</span>
            </div>
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
