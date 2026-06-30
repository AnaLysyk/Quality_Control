"use client";

import { useEffect, useMemo } from "react";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useClientContext } from "@/context/ClientContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { useSidebarState } from "@/hooks/navigation/useSidebarState";
import { useMenuLateral } from "@/features/menu-lateral/hooks/useMenuLateral";
import { useActiveNavigation } from "@/hooks/navigation/useActiveNavigation";
import { useFavorites } from "@/hooks/navigation/useFavorites";
import SidebarHeader from "./navigation/SidebarHeader";
import SidebarSection from "./navigation/SidebarSection";
import SidebarFlyout from "./navigation/SidebarFlyout";
import SidebarFavorites from "./navigation/SidebarFavorites";
import SidebarFooter from "./navigation/SidebarFooter";
import ProjectSelector from "./ProjectSelector";

const menuLogoEnv = process.env.NEXT_PUBLIC_MENU_LOGO || "";
const REMOVED_MODULE_IDS = new Set(["operations"]);

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

export default function Sidebar({ pathname, mobileOpen = false, onClose, mobilePanelId }: SidebarProps) {
  const { collapsed, toggleCollapsed, openSections, toggleSection, openSection } = useSidebarState();
  const { modules: navigationModules, loading, companySlug } = useMenuLateral();
  const modules = useMemo(
    () => navigationModules.filter((mod) => !REMOVED_MODULE_IDS.has(mod.id)),
    [navigationModules],
  );
  const { activeModuleId, isModuleActive, isItemActive } = useActiveNavigation(modules, pathname);
  const { favorites, removeFavorite } = useFavorites();
  const { user } = usePermissionAccess();
  const { activeClientSlug } = useClientContext();

  // Auto-open the active section when pathname changes
  useEffect(() => {
    if (activeModuleId) openSection(activeModuleId);
  }, [activeModuleId, openSection]);

  const dbLogo = typeof user?.companyLogoUrl === "string" ? user.companyLogoUrl.trim() : "";
  const logoSrc = dbLogo || menuLogoEnv || "/images/tc.png";

  const normalizedRole = useMemo(
    () =>
      normalizeLegacyRole(typeof user?.permissionRole === "string" ? user.permissionRole : null) ??
      normalizeLegacyRole(typeof user?.role === "string" ? user.role : null) ??
      normalizeLegacyRole(typeof user?.companyRole === "string" ? user.companyRole : null),
    [user],
  );

  const isGlobalAdmin =
    user?.isGlobalAdmin === true ||
    (user as { is_global_admin?: boolean } | null)?.is_global_admin === true ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC;

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

  const logoHref = useMemo(() => {
    if (isGlobalAdmin) return "/admin/dashboard";
    if (companySlug) return buildCompanyPathForAccess(companySlug, "home", companyRouteInput);
    return "/home";
  }, [isGlobalAdmin, companySlug, companyRouteInput]);

  const visibleFavoriteHrefs = useMemo(() => {
    const hrefs = new Set<string>();
    for (const mod of modules) {
      if (mod.href) hrefs.add(mod.href);
      for (const item of mod.items) {
        if (item.href) hrefs.add(item.href);
      }
    }
    return hrefs;
  }, [modules]);

  const visibleFavorites = useMemo(
    () => favorites.filter((favorite) => visibleFavoriteHrefs.has(favorite.href)),
    [favorites, visibleFavoriteHrefs],
  );

  const sidebarBody = (
    <aside
      className={`sidebar-theme text-white flex h-full flex-col border-r border-white/10 overflow-hidden bg-[linear-gradient(180deg,#011848_0%,#082457_42%,#3a1530_72%,#ef0001_100%)] backdrop-blur-xl transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-18" : "w-72"
      }`}
    >
      <SidebarHeader
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        logoSrc={logoSrc}
        logoHref={logoHref}
        onClose={onClose}
      />

      {/* Project selector — visible when a company is active */}
      {activeClientSlug && (
        <div className="pt-2">
          <ProjectSelector collapsed={collapsed} />
          <div className="mx-3 border-t border-white/10" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Favorites */}
        {visibleFavorites.length > 0 && (
          <>
            <div className="pt-3">
              <SidebarFavorites
                favorites={visibleFavorites}
                collapsed={collapsed}
                onRemove={removeFavorite}
                pathname={pathname}
                onClose={onClose}
              />
            </div>
            {!collapsed && <div className="mx-4 mb-1 border-t border-white/10" />}
            {collapsed && <div className="mx-2 my-1 border-t border-white/10" />}
          </>
        )}

        {/* Navigation — expanded */}
        {!collapsed && (
          <nav className="px-3 py-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Navegação
            </p>
            <div className="space-y-0.5">
              {!loading &&
                modules.map((mod) => (
                  <SidebarSection
                    key={mod.id}
                    mod={mod}
                    isActive={isModuleActive(mod)}
                    isItemActive={isItemActive}
                    open={openSections.has(mod.id)}
                    onToggle={() => toggleSection(mod.id)}
                    onClose={onClose}
                  />
                ))}
            </div>
          </nav>
        )}

        {/* Navigation — collapsed (flyout on hover) */}
        {collapsed && (
          <nav className="px-1.5 py-1">
            <div className="space-y-0.5">
              {!loading &&
                modules.map((mod) => (
                  <SidebarFlyout
                    key={mod.id}
                    mod={mod}
                    isActive={isModuleActive(mod)}
                    isItemActive={isItemActive}
                    onClose={onClose}
                  />
                ))}
            </div>
          </nav>
        )}
      </div>

      <SidebarFooter collapsed={collapsed} />
    </aside>
  );

  return (
    <>
      <div className="hidden h-full shrink-0 lg:block">{sidebarBody}</div>
      {mobileOpen && onClose ? (
        <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={onClose}>
          <div id={mobilePanelId} className="h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarBody}
          </div>
        </div>
      ) : null}
    </>
  );
}
