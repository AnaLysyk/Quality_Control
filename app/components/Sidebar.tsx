"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import {
  FiBarChart2,
  FiBriefcase,
  FiColumns,
  FiCompass,
  FiGrid,
  FiHome,
  FiList,
  FiShield,
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

type AppRole = "admin" | "client" | "user" | "technical_support";

type NavItem = {
  label: string;
  href: string;
  icon: typeof FiHome;
};

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ pathname, mobileOpen = false, onClose, mobilePanelId }: SidebarProps) {
  const { user, loading } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();
  const { t } = useI18n();

  const normalizedRole =
    normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null);

  const isGlobalAdmin =
    user?.isGlobalAdmin === true ||
    (user as { is_global_admin?: boolean } | null)?.is_global_admin === true ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC;

  const appRole = useMemo<AppRole | null>(() => {
    if (!user) return null;
    if (normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "technical_support";
    if (isGlobalAdmin) return "admin";
    if (isInstitutionalCompanyAccount(user)) return "client";
    if (normalizedRole === SYSTEM_ROLES.EMPRESA || normalizedRole === SYSTEM_ROLES.COMPANY_USER) return "client";
    return "user";
  }, [isGlobalAdmin, normalizedRole, user]);

  const logoSrc = useMemo(() => {
    const dbLogo = typeof user?.companyLogoUrl === "string" ? user.companyLogoUrl.trim() : "";
    if (dbLogo) return dbLogo;
    if (menuLogoEnv) return menuLogoEnv;
    return "/images/tc.png";
  }, [user?.companyLogoUrl]);

  const companySlug = useMemo(() => {
    if (activeClientSlug) return activeClientSlug;
    if (typeof user?.clientSlug === "string" && user.clientSlug.trim()) return user.clientSlug.trim();
    if (typeof user?.primaryCompanySlug === "string" && user.primaryCompanySlug.trim()) return user.primaryCompanySlug.trim();
    return null;
  }, [activeClientSlug, user?.clientSlug, user?.primaryCompanySlug]);

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

  const navItems = useMemo<NavItem[]>(() => {
    if (loading) return [];

    if (!user) {
      return [
        { label: t("nav.home"), icon: FiHome, href: "/" },
        { label: t("nav.companies"), icon: FiUsers, href: "/empresas" },
      ];
    }

    if (appRole === "admin" || appRole === "technical_support") {
      return [
        { label: t("nav.dashboard"), icon: FiCompass, href: "/admin/dashboard" },
        { label: t("nav.metrics"), icon: FiBarChart2, href: "/admin/test-metric" },
        { label: t("nav.runs"), icon: FiList, href: "/admin/runs" },
        { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
        { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
        { label: t("nav.support"), icon: FiColumns, href: "/admin/support" },
        { label: t("nav.management"), icon: FiShield, href: "/admin/users/permissions" },
        { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
      ];
    }

    if (companySlug) {
      return [
        { label: t("nav.home"), icon: FiHome, href: buildCompanyPathForAccess(companySlug, "home", companyRouteInput) },
        { label: t("nav.dashboard"), icon: FiGrid, href: buildCompanyPathForAccess(companySlug, "dashboard", companyRouteInput) },
        { label: t("nav.metrics"), icon: FiBarChart2, href: buildCompanyPathForAccess(companySlug, "metrics", companyRouteInput) },
        { label: t("nav.apps"), icon: FiBriefcase, href: buildCompanyPathForAccess(companySlug, "aplicacoes", companyRouteInput) },
        { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
        { label: t("nav.runs"), icon: FiList, href: appRole === "user" ? "/runs" : buildCompanyPathForAccess(companySlug, "runs", companyRouteInput) },
        { label: t("nav.support"), icon: FiColumns, href: buildCompanyPathForAccess(companySlug, "chamados", companyRouteInput) },
      ];
    }

    return [{ label: t("nav.home"), icon: FiHome, href: "/" }];
  }, [appRole, companyRouteInput, companySlug, loading, t, user]);

  const logoHref = isGlobalAdmin ? "/admin/dashboard" : companySlug ? buildCompanyPathForAccess(companySlug, "home", companyRouteInput) : "/";

  const sidebarBody = (
    <aside className="sidebar-theme text-white flex h-full w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,#011848_0%,#082457_42%,#3a1530_72%,#ef0001_100%)] backdrop-blur-xl">
      <div className="border-b border-white/10 p-4">
        <Link href={logoHref} className="flex items-center gap-3" onClick={onClose}>
          <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
            <Image src={logoSrc} alt="Logo" fill className="object-contain p-1" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">Testing Company</span>
            <span className="text-sm font-semibold text-white">Quality Control</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-white/16 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
                onClick={onClose}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{sidebarBody}</div>
      {mobileOpen && onClose ? (
        <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={onClose}>
          <div id={mobilePanelId} className="h-full" onClick={(event) => event.stopPropagation()}>
            {sidebarBody}
          </div>
        </div>
      ) : null}
    </>
  );
}
