"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
  const { clients, activeClient, activeClientSlug, setActiveClientSlug } = useClientContext();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [navSearch, setNavSearch] = useState("");

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

  const filteredCompanies = useMemo(() => {
    const query = normalizeSearch(companySearch.trim());
    if (!query) return clients;
    return clients.filter((client) => {
      const searchable = normalizeSearch(`${client.name} ${client.slug}`);
      return searchable.includes(query);
    });
  }, [clients, companySearch]);

  const visibleModules = useMemo(() => {
    const query = normalizeSearch(navSearch.trim());
    if (!query) return modules;
    return modules
      .map((mod) => {
        const moduleMatches = normalizeSearch(`${mod.label} ${mod.id}`).includes(query);
        const matchingItems = mod.items.filter((item) =>
          normalizeSearch(`${item.label} ${item.id} ${item.routeId ?? ""} ${item.group ?? ""}`).includes(query),
        );
        if (moduleMatches) return mod;
        if (matchingItems.length > 0) return { ...mod, items: matchingItems };
        return null;
      })
      .filter((mod): mod is (typeof modules)[number] => Boolean(mod));
  }, [modules, navSearch]);

  const sidebarBody = (
    <aside
      data-testid="sidebar-docs-shell"
      className={`sidebar-theme sidebar-docs-shell flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.02),0_16px_42px_rgba(15,23,42,0.08)] transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-18" : "w-72"
      }`}
    >
      <style jsx global>{`
        .sidebar-docs-shell :is(a, button, span, p, label, input, div) {
          color: inherit;
        }
        .sidebar-docs-shell :is(a, button) {
          color: #334155 !important;
        }
        .sidebar-docs-shell :is(a:hover, button:hover) {
          color: #0f172a !important;
        }
        .sidebar-docs-shell [class*="border-white"] {
          border-color: rgba(148, 163, 184, 0.28) !important;
        }
        .sidebar-docs-shell [class*="bg-white/10"],
        .sidebar-docs-shell [class*="bg-white/8"],
        .sidebar-docs-shell [class*="bg-white/14"],
        .sidebar-docs-shell [class*="bg-white/16"] {
          background-color: rgba(241, 245, 249, 0.9) !important;
        }
        .sidebar-docs-shell [class*="text-white/30"],
        .sidebar-docs-shell [class*="text-white/35"],
        .sidebar-docs-shell [class*="text-white/40"],
        .sidebar-docs-shell [class*="text-white/45"],
        .sidebar-docs-shell [class*="text-white/50"],
        .sidebar-docs-shell [class*="text-white/60"],
        .sidebar-docs-shell [class*="text-white/70"] {
          color: #64748b !important;
        }
      `}</style>
      <SidebarHeader
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        logoSrc={logoSrc}
        logoHref={logoHref}
        onClose={onClose}
      />

      {clients.length > 0 && !collapsed ? (
        <div className="relative px-3 pt-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Empresa
          </label>
          <button
            type="button"
            onClick={() => {
              setCompanyOpen((value) => !value);
              setCompanySearch("");
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-[12px] font-medium text-slate-800 outline-none transition hover:border-emerald-300 hover:bg-emerald-50"
            data-testid="sidebar-company-combobox"
          >
            <span className="min-w-0 flex-1 truncate">
              {activeClient?.name ?? "Selecionar empresa"}
            </span>
            <FiChevronDown
              size={13}
              className={`shrink-0 text-slate-400 transition-transform ${companyOpen ? "rotate-180" : ""}`}
            />
          </button>

          {companyOpen ? (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-200 p-2">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <FiSearch size={12} className="shrink-0 text-slate-400" />
                  <input
                    value={companySearch}
                    onChange={(event) => setCompanySearch(event.target.value)}
                    autoFocus
                    placeholder="Digite para buscar a empresa..."
                    className="w-full bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 outline-none"
                    data-testid="sidebar-company-search"
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto py-1 [scrollbar-width:thin]">
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.map((client) => {
                    const active = client.slug === activeClientSlug;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setActiveClientSlug(client.slug);
                          setCompanyOpen(false);
                          setCompanySearch("");
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50 ${
                          active ? "text-slate-950" : "text-slate-600"
                        }`}
                        data-testid={`sidebar-company-option-${client.slug}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold">{client.name}</span>
                          <span className="block truncate text-[10px] text-slate-400">/{client.slug}</span>
                        </span>
                        {active ? <FiCheck size={12} className="shrink-0 text-emerald-600" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                    Nenhuma empresa encontrada
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeClientSlug && (
        <div className="pt-2">
          <ProjectSelector collapsed={collapsed} showCompanySelector={false} />
          <div className="mx-3 border-t border-slate-200" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            {!collapsed && <div className="mx-4 mb-1 border-t border-slate-200" />}
            {collapsed && <div className="mx-2 my-1 border-t border-slate-200" />}
          </>
        )}

        {!collapsed && (
          <nav className="px-3 py-3" aria-label="Navegação principal">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Docs & Workspaces
            </p>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-sm">
              <FiSearch size={14} className="shrink-0 text-slate-400" />
              <input
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                placeholder="Buscar módulo, run, Brain..."
                className="w-full bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 outline-none"
                data-testid="sidebar-nav-search"
              />
            </div>
            <div className="space-y-0.5">
              {!loading &&
                visibleModules.map((mod) => (
                  <SidebarSection
                    key={mod.id}
                    mod={mod}
                    isActive={isModuleActive(mod)}
                    isItemActive={isItemActive}
                    open={openSections.has(mod.id) || Boolean(navSearch.trim())}
                    onToggle={() => toggleSection(mod.id)}
                    onClose={onClose}
                  />
                ))}
            </div>
            {!loading && visibleModules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                Nenhum módulo encontrado.
              </div>
            ) : null}
          </nav>
        )}

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
        <div className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden" onClick={onClose}>
          <div id={mobilePanelId} className="h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarBody}
          </div>
        </div>
      ) : null}
    </>
  );
}
