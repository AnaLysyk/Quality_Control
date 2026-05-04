"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
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
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
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

type MobileMenuPanel =
  | { kind: "root" }
  | { kind: "section"; sectionId: string }
  | { kind: "submenu"; sectionId: string; itemId: string }
  | { kind: "favorites" };

type SidebarProps = {
  pathname: string;
  mobileOpen?: boolean;
  onClose?: () => void;
  mobilePanelId?: string;
};

type ParsedSidebarCompanyRoute = {
  kind: "internal" | "leader_tc" | "technical_support" | "empresa" | "company_user" | "testing_company_user";
  targetSlug: string;
  route: string;
  prefixSlug: string | null;
};

type FlyoutViewport = {
  width: number;
  height: number;
};

type FlyoutPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  side: "left" | "right";
};

type FlyoutAnchor = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const SIDEBAR_RESERVED_APP_ROOTS = new Set([
  "500",
  "admin",
  "api",
  "automacoes",
  "login",
  "settings",
  "me",
  "profile",
  "home",
  "empresas",
  "dashboard",
  "runs",
  "release",
  "requests",
  "docs",
  "documentos",
  "chamados",
  "meus-chamados",
  "clients",
  "clients-list",
  "integrations",
  "issues",
  "metrics",
  "brand-identity",
  "applications-hub",
  "applications-panel",
  "painel-releases-manuais",
  "painel-releases-manuais-autenticado",
  "kanban-it",
  "health",
  "chat",
  "operacao",
  "operacoes",
  "suporte",
  "lider-tc",
  "user-tc",
]);

const SIDEBAR_COMPANY_SECTION_ROOTS = new Set([
  "home",
  "dashboard",
  "metrics",
  "aplicacoes",
  "aplica\u00e7\u00f5es",
  "planos-de-teste",
  "runs",
  "defeitos",
  "chamados",
  "docs",
  "documentos",
  "perfil",
  "profile",
  "admin",
  "releases",
]);

const SMART_FLYOUT_EDGE_MARGIN = 12;
const SMART_FLYOUT_GAP = 10;
const SMART_ROOT_FLYOUT_WIDTH_RATIO = 0.26;
const SMART_ROOT_FLYOUT_MIN_WIDTH = 260;
const SMART_ROOT_FLYOUT_MAX_WIDTH = 360;
const SMART_ROOT_FLYOUT_HEIGHT_RATIO = 0.76;
const SMART_ROOT_FLYOUT_MIN_HEIGHT = 300;
const SMART_ROOT_FLYOUT_MAX_HEIGHT = 720;
const SMART_SUB_FLYOUT_WIDTH_RATIO = 0.24;
const SMART_SUB_FLYOUT_MIN_WIDTH = 240;
const SMART_SUB_FLYOUT_MAX_WIDTH = 324;
const SMART_SUB_FLYOUT_HEIGHT_RATIO = 0.68;
const SMART_SUB_FLYOUT_MIN_HEIGHT = 240;
const SMART_SUB_FLYOUT_MAX_HEIGHT = 620;
const SMART_FLYOUT_CLOSE_DELAY = 260;
const SMART_SIDEBAR_EXPANDED_WIDTH = 304;

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

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitPathname(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => safeDecodeSegment(part));
}

function isReservedAppRoot(segment?: string | null) {
  return SIDEBAR_RESERVED_APP_ROOTS.has((segment ?? "").trim().toLowerCase());
}

function isCompanySectionRoot(segment?: string | null) {
  return SIDEBAR_COMPANY_SECTION_ROOTS.has((segment ?? "").trim().toLowerCase());
}

function parseSidebarCompanyRoutePathname(pathname: string): ParsedSidebarCompanyRoute | null {
  const parts = splitPathname(pathname);
  if (parts.length === 0) return null;

  if (parts[0]?.toLowerCase() === "empresas" && parts[1]) {
    return {
      kind: "internal",
      targetSlug: parts[1],
      route: parts.slice(2).join("/") || "home",
      prefixSlug: null,
    };
  }

  const prefix = (parts[0] ?? "").trim().toLowerCase();
  if ((prefix === "lider-tc" || prefix === "suporte" || prefix === "user-tc") && parts[1]) {
    const kind =
      prefix === "lider-tc"
        ? "leader_tc"
        : prefix === "suporte"
          ? "technical_support"
          : "testing_company_user";
    return {
      kind,
      targetSlug: parts[1],
      route: parts.slice(2).join("/") || "home",
      prefixSlug: parts[0],
    };
  }

  if (isReservedAppRoot(parts[0])) return null;

  if (parts.length === 1) {
    return {
      kind: "empresa",
      targetSlug: parts[0],
      route: "home",
      prefixSlug: null,
    };
  }

  if (isCompanySectionRoot(parts[1])) {
    return {
      kind: "empresa",
      targetSlug: parts[0],
      route: parts.slice(1).join("/") || "home",
      prefixSlug: null,
    };
  }

  if (!isReservedAppRoot(parts[1])) {
    return {
      kind: "company_user",
      targetSlug: parts[1],
      route: parts.slice(2).join("/") || "home",
      prefixSlug: parts[0],
    };
  }

  return null;
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

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function readViewportSize(): FlyoutViewport {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth ?? 0),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight ?? 0),
  };
}

function computeFlyoutDimensions(
  viewport: FlyoutViewport,
  options: {
    widthRatio: number;
    minWidth: number;
    maxWidth: number;
    heightRatio: number;
    minHeight: number;
    maxHeight: number;
  },
) {
  const widthLimit = Math.max(options.minWidth, viewport.width - SMART_FLYOUT_EDGE_MARGIN * 2);
  const heightLimit = Math.max(options.minHeight, viewport.height - SMART_FLYOUT_EDGE_MARGIN * 2);
  return {
    width: clampNumber(Math.round(viewport.width * options.widthRatio), options.minWidth, Math.min(options.maxWidth, widthLimit)),
    maxHeight: clampNumber(
      Math.round(viewport.height * options.heightRatio),
      options.minHeight,
      Math.min(options.maxHeight, heightLimit),
    ),
  };
}

function computeRootFlyoutPlacement(anchor: FlyoutAnchor, viewport: FlyoutViewport): FlyoutPlacement {
  const dimensions = computeFlyoutDimensions(viewport, {
    widthRatio: SMART_ROOT_FLYOUT_WIDTH_RATIO,
    minWidth: SMART_ROOT_FLYOUT_MIN_WIDTH,
    maxWidth: SMART_ROOT_FLYOUT_MAX_WIDTH,
    heightRatio: SMART_ROOT_FLYOUT_HEIGHT_RATIO,
    minHeight: SMART_ROOT_FLYOUT_MIN_HEIGHT,
    maxHeight: SMART_ROOT_FLYOUT_MAX_HEIGHT,
  });

  const preferredLeft = Math.max(anchor.right, SMART_SIDEBAR_EXPANDED_WIDTH) + SMART_FLYOUT_GAP;
  const maxLeft = Math.max(SMART_FLYOUT_EDGE_MARGIN, viewport.width - SMART_FLYOUT_EDGE_MARGIN - dimensions.width);
  const left = clampNumber(preferredLeft, SMART_FLYOUT_EDGE_MARGIN, maxLeft);
  const side = left === preferredLeft ? "right" : "left";
  const topLimit = Math.max(SMART_FLYOUT_EDGE_MARGIN, viewport.height - SMART_FLYOUT_EDGE_MARGIN - dimensions.maxHeight);
  const top = clampNumber(anchor.top - 8, SMART_FLYOUT_EDGE_MARGIN, topLimit);

  return {
    left,
    top,
    width: dimensions.width,
    maxHeight: dimensions.maxHeight,
    side,
  };
}

function computeSubFlyoutPlacement(anchor: FlyoutAnchor, viewport: FlyoutViewport, rootRect: FlyoutAnchor): FlyoutPlacement {
  const dimensions = computeFlyoutDimensions(viewport, {
    widthRatio: SMART_SUB_FLYOUT_WIDTH_RATIO,
    minWidth: SMART_SUB_FLYOUT_MIN_WIDTH,
    maxWidth: SMART_SUB_FLYOUT_MAX_WIDTH,
    heightRatio: SMART_SUB_FLYOUT_HEIGHT_RATIO,
    minHeight: SMART_SUB_FLYOUT_MIN_HEIGHT,
    maxHeight: SMART_SUB_FLYOUT_MAX_HEIGHT,
  });

  const rightLeft = rootRect.right + SMART_FLYOUT_GAP;
  const rightFits = rightLeft + dimensions.width <= viewport.width - SMART_FLYOUT_EDGE_MARGIN;
  const leftLeft = rootRect.left - SMART_FLYOUT_GAP - dimensions.width;
  const leftFits = leftLeft >= SMART_FLYOUT_EDGE_MARGIN;

  let side: "left" | "right" = "right";
  let left = rightLeft;
  if (rightFits) {
    side = "right";
    left = rightLeft;
  } else if (leftFits) {
    side = "left";
    left = leftLeft;
  } else {
    left = clampNumber(rightLeft, SMART_FLYOUT_EDGE_MARGIN, Math.max(SMART_FLYOUT_EDGE_MARGIN, viewport.width - SMART_FLYOUT_EDGE_MARGIN - dimensions.width));
    side = left === rightLeft ? "right" : "left";
  }

  const topLimit = Math.max(SMART_FLYOUT_EDGE_MARGIN, viewport.height - SMART_FLYOUT_EDGE_MARGIN - dimensions.maxHeight);
  const top = clampNumber(anchor.top - 8, SMART_FLYOUT_EDGE_MARGIN, topLimit);

  return {
    left,
    top,
    width: dimensions.width,
    maxHeight: dimensions.maxHeight,
    side,
  };
}

export default function Sidebar({ pathname, mobileOpen = false, onClose, mobilePanelId }: SidebarProps) {
  const router = useRouter();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const [viewport, setViewport] = useState<FlyoutViewport>({ width: 0, height: 0 });
  const [activeFlyoutId, setActiveFlyoutId] = useState<string | null>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [rootFlyoutPlacement, setRootFlyoutPlacement] = useState<FlyoutPlacement | null>(null);
  const [subFlyoutPlacement, setSubFlyoutPlacement] = useState<FlyoutPlacement | null>(null);
  const [flyoutRevision, setFlyoutRevision] = useState(0);
  const [mobileMenuPanel, setMobileMenuPanel] = useState<MobileMenuPanel>({ kind: "root" });
  const [favoriteHrefs, setFavoriteHrefs] = useState<string[]>([]);
  const favoritesHydratedRef = useRef(false);
  const { user, loading, visibility, normalizedUser } = usePermissionAccess();
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
  const isOperationalProfile =
    normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC ||
    normalizedRole === SYSTEM_ROLES.TESTING_COMPANY_USER;
  const canUseAdminClientTools = isGlobalAdmin || hasAdminClientToolAccess(user);
  const useOperationsWorkspace = isOperationalProfile || isGlobalAdmin;
  const adminRunsMenuLabel = useOperationsWorkspace ? t("nav.operations") : t("nav.runsManagement");
  const adminRunsMenuHref = useOperationsWorkspace ? "/operacao" : "/admin/operacao";
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
    { label: adminRunsMenuLabel, icon: FiList, href: adminRunsMenuHref },
    { label: t("nav.companies"), icon: FiUsers, href: "/admin/clients" },
    { label: t("nav.users"), icon: FiUsers, href: "/admin/users?tab=company" },
    { label: t("nav.automations"), icon: FiZap, href: "/automacoes" },
    { label: t("nav.support"), icon: FiColumns, href: "/admin/support" },
    { label: t("nav.management"), icon: FiShield, href: "/admin/users/permissions" },
    { label: t("nav.accessRequests"), icon: FiUserPlus, href: "/admin/access-requests" },
    { label: t("nav.auditLogs"), icon: FiBell, href: "/admin/audit-logs" },
    { label: "Brain", icon: FiCpu, href: "/admin/brain" },
    { label: "Conversas", icon: FiMessageSquare, href: "/chat" },
  ], [t, adminRunsMenuHref, adminRunsMenuLabel]);

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
    const privilegedCompanyNav = companyNav.filter((item) => {
      const { path } = normalizeHref(item.href);
      return !/\/home$/.test(path);
    });
    const scopedCompanyNav =
      appRole === "admin" || appRole === "technical_support" ? privilegedCompanyNav : companyNav;
    if (isSupportScopedRoute && supportNav.length) return supportNav;
    if (isCompanyScopedRoute && scopedCompanyNav.length) return scopedCompanyNav;
    if (appRole === "admin") return adminNav;
    if (appRole === "technical_support") return supportNav;
    // testing_company_user not in company context → runs goes to /operacao hub
    if (appRole === "user" && scopedCompanyNav.length && !isInstitutionalCompany) {
      return scopedCompanyNav.map((item) =>
        /\/runs$/.test(item.href) ? { ...item, href: "/operacao" } : item,
      );
    }
    if (scopedCompanyNav.length) return scopedCompanyNav;
    return publicNav;
  }, [loading, user, appRole, adminNav, supportNav, companyNav, publicNav, pathname, isInstitutionalCompany, parsedCompanyRoute]);

  const visibleNavigation = useMemo(
    () =>
      navigation
        .filter((item) => !item.roles || (appRole ? item.roles.includes(appRole) : false))
        .filter((item) => {
          if (item.href === "/admin/users/permissions" && (appRole === "admin" || appRole === "technical_support")) {
            return true;
          }
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

    for (const item of moduleNavigation.get("applications") ?? []) {
      companiesItems.push(
        toMenuItem(item, {
          description: "Aplicações da empresa",
        }),
      );
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
            label: "Líder TC",
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
      ...(moduleNavigation.get("applications") ?? []).map((item) =>
        toMenuItem(item, { description: "Aplicações da empresa" }),
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
      ...(findVisibleNavItem("/runs")
        ? [toMenuItem(findVisibleNavItem("/runs")!, { id: "operations-hub", description: "Central operacional" })]
        : []),
      ...(findVisibleNavItem("/operacao")
        ? [toMenuItem(findVisibleNavItem("/operacao")!, { id: "operations-legacy-hub", description: "Atalho legado" })]
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

  const desktopNavigationItems = useMemo<SidebarMenuItem[]>(() => {
    const uniqueByHref = (items: SidebarMenuItem[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = item.href ?? item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const normalizeQueryString = (query: string) => new URLSearchParams(query).toString();

    const isSameMenuHref = (leftHref?: string, rightHref?: string) => {
      if (!leftHref || !rightHref) return false;
      const left = normalizeHref(leftHref);
      const right = normalizeHref(rightHref);
      return left.path === right.path && normalizeQueryString(left.query) === normalizeQueryString(right.query);
    };

    const menuHrefKey = (href?: string) => {
      if (!href) return "";
      const { path, query } = normalizeHref(href);
      return `${path}?${normalizeQueryString(query)}`;
    };

    const topLevelMenuHrefs = new Set(visibleNavigation.map((item) => menuHrefKey(item.href)));

    const removeMainMenuLinks = (items: SidebarMenuItem[]): SidebarMenuItem[] =>
      uniqueByHref(items)
        .filter((child) => !child.href || !topLevelMenuHrefs.has(menuHrefKey(child.href)))
        .map((child) => ({
          ...child,
          children: child.children ? removeMainMenuLinks(child.children) : child.children,
        }));

    const removeSelfLinks = (parentHref: string, items: SidebarMenuItem[]) =>
      removeMainMenuLinks(uniqueByHref(items).filter((child) => !isSameMenuHref(parentHref, child.href)));

    const withQuery = (href: string, params: Record<string, string | number | boolean>) => {
      const [path, rawQuery = ""] = href.split("?");
      const search = new URLSearchParams(rawQuery);
      Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
      const query = search.toString();
      return query ? `${path}?${query}` : path;
    };

    const buildCompanySiblingHref = (href: string, section: string) => {
      const { path } = normalizeHref(href);
      const match = path.match(/^\/empresas\/([^/]+)/);
      if (!match) return null;
      return `/empresas/${match[1]}/${section}`;
    };

    const buildOperationHref = (href: string, module: string) => {
      const { path, query } = normalizeHref(href);
      const params = new URLSearchParams(query || searchQuery);
      params.set("module", module);
      const basePath = path === "/admin/operacao" ? "/admin/operacao" : "/operacao";
      const nextQuery = params.toString();
      return nextQuery ? `${basePath}?${nextQuery}` : basePath;
    };

    const describeNavItem = (item: NavItem) => {
      const { path } = normalizeHref(item.href);
      if (path === "/" || path === "/admin/home" || /\/home$/.test(path)) return "Entrada principal";
      if (path === "/admin/dashboard" || /\/dashboard$/.test(path)) return "Painel executivo";
      if (path === "/admin/test-metric" || path === "/metrics" || /\/metrics$/.test(path)) return "Indicadores";
      if (path === "/operacao" || path === "/admin/operacao" || /\/runs$/.test(path)) return "Execuções";
      if (path === "/admin/clients" || path === "/empresas" || /\/aplicacoes$/.test(path)) return "Aplicações";
      if (path === "/admin/users") return "Usuários";
      if (/\/planos-de-teste$/.test(path)) return "Planos de teste";
      if (path === "/automacoes") return "Automações";
      if (path === "/admin/support" || path === "/meus-chamados" || /\/chamados$/.test(path)) return "Suporte";
      if (path === "/admin/users/permissions") return "Permissões";
      if (path === "/admin/access-requests") return "Solicitações";
      if (path === "/admin/audit-logs") return "Auditoria";
      if (path === "/admin/brain") return "Brain";
      if (path === "/chat") return "Conversas";
      return "Acesso rápido";
    };

    const buildChildren = (item: NavItem): SidebarMenuItem[] => {
      const { path } = normalizeHref(item.href);
      const companyDashboard = buildCompanySiblingHref(item.href, "dashboard");
      const companyMetrics = buildCompanySiblingHref(item.href, "metrics");
      const companyApps = buildCompanySiblingHref(item.href, "aplicacoes");
      const companyTestPlans = buildCompanySiblingHref(item.href, "planos-de-teste");
      const companyRuns = buildCompanySiblingHref(item.href, "runs");
      const companyDefects = buildCompanySiblingHref(item.href, "defeitos");

      if (path === "/" || path === "/admin/home" || /\/home$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir tela inicial" },
          ...(companyDashboard ? [{ id: `${item.href}:dashboard`, label: t("nav.dashboard"), icon: FiGrid, href: companyDashboard, description: "Painel da empresa" }] : []),
          ...(companyApps ? [{ id: `${item.href}:apps`, label: t("nav.apps"), icon: FiBriefcase, href: companyApps, description: "Aplicações da empresa" }] : []),
          ...(path === "/admin/home"
            ? [
                { id: `${item.href}:admin-dashboard`, label: t("nav.dashboard"), icon: FiCompass, href: "/admin/dashboard", description: "Painel executivo" },
                { id: `${item.href}:admin-operation`, label: "Operação", icon: FiList, href: "/admin/operacao?module=dashboard", description: "Workspace operacional" },
                { id: `${item.href}:admin-users`, label: t("nav.users"), icon: FiUsers, href: "/admin/users?tab=company", description: "Gestão de usuários" },
              ]
            : []),
        ]);
      }

      if (path === "/admin/dashboard" || /\/dashboard$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir dashboard" },
          ...(companyMetrics ? [{ id: `${item.href}:metrics`, label: t("nav.metrics"), icon: FiBarChart2, href: companyMetrics, description: "Indicadores" }] : []),
          ...(companyRuns ? [{ id: `${item.href}:runs`, label: companyRunsMenuLabel, icon: FiList, href: companyRuns, description: "Runs" }] : []),
          ...(path === "/admin/dashboard" ? [{ id: `${item.href}:admin-metrics`, label: t("nav.metrics"), icon: FiBarChart2, href: "/admin/test-metric", description: "Indicadores globais" }] : []),
        ]);
      }

      if (path === "/admin/test-metric" || path === "/metrics" || /\/metrics$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir indicadores" },
          ...(companyDashboard ? [{ id: `${item.href}:dashboard`, label: t("nav.dashboard"), icon: FiGrid, href: companyDashboard, description: "Voltar ao dashboard" }] : []),
          ...(path === "/admin/test-metric" ? [{ id: `${item.href}:admin-dashboard`, label: t("nav.dashboard"), icon: FiCompass, href: "/admin/dashboard", description: "Painel executivo" }] : []),
        ]);
      }

      if (path === "/operacao" || path === "/admin/operacao" || /\/runs$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir módulo" },
          { id: `${item.href}:op-dashboard`, label: t("nav.dashboard"), icon: FiGrid, href: buildOperationHref(item.href, "dashboard"), description: "Resumo operacional" },
          { id: `${item.href}:op-runs`, label: t("nav.operations"), icon: FiList, href: buildOperationHref(item.href, "runs"), description: "Runs e execuções" },
          { id: `${item.href}:op-apps`, label: t("nav.apps"), icon: FiBriefcase, href: buildOperationHref(item.href, "applications"), description: "Aplicações" },
          { id: `${item.href}:op-test-plans`, label: t("nav.testPlans"), icon: FiClipboard, href: buildOperationHref(item.href, "test-plans"), description: "Planos de teste" },
          { id: `${item.href}:op-defects`, label: t("nav.defects"), icon: FiAlertTriangle, href: buildOperationHref(item.href, "defects"), description: "Defeitos" },
          { id: `${item.href}:op-support`, label: t("nav.support"), icon: FiColumns, href: buildOperationHref(item.href, "support"), description: "Chamados" },
          ...(companyApps ? [{ id: `${item.href}:company-apps`, label: t("nav.apps"), icon: FiBriefcase, href: companyApps, description: "Tela da empresa" }] : []),
          ...(companyTestPlans ? [{ id: `${item.href}:company-plans`, label: t("nav.testPlans"), icon: FiClipboard, href: companyTestPlans, description: "Tela da empresa" }] : []),
          ...(companyDefects ? [{ id: `${item.href}:company-defects`, label: t("nav.defects"), icon: FiAlertTriangle, href: companyDefects, description: "Tela da empresa" }] : []),
        ]);
      }

      if (path === "/admin/clients" || path === "/empresas" || /\/aplicacoes$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir aplicações" },
          ...(companyDashboard ? [{ id: `${item.href}:dashboard`, label: t("nav.dashboard"), icon: FiGrid, href: companyDashboard, description: "Dashboard da empresa" }] : []),
          ...(companyRuns ? [{ id: `${item.href}:runs`, label: companyRunsMenuLabel, icon: FiList, href: companyRuns, description: "Runs da empresa" }] : []),
          ...(companyTestPlans ? [{ id: `${item.href}:plans`, label: t("nav.testPlans"), icon: FiClipboard, href: companyTestPlans, description: "Planos de teste" }] : []),
          ...(canUseAdminClientTools ? [{ id: `${item.href}:create`, label: "Criar empresa", icon: FiPlus, href: "/admin/clients?create=1", description: "Abrir cadastro" }] : []),
        ]);
      }

      if (path === "/admin/test-plans" || /\/planos-de-teste$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir planos" },
          ...(companyApps ? [{ id: `${item.href}:apps`, label: t("nav.apps"), icon: FiBriefcase, href: companyApps, description: "Aplicações" }] : []),
          ...(companyRuns ? [{ id: `${item.href}:runs`, label: companyRunsMenuLabel, icon: FiList, href: companyRuns, description: "Runs" }] : []),
          ...(path === "/admin/test-plans"
            ? [
                { id: `${item.href}:admin-apps`, label: t("nav.apps"), icon: FiBriefcase, href: "/admin/clients", description: "Aplicações e empresas" },
                { id: `${item.href}:admin-runs`, label: companyRunsMenuLabel, icon: FiList, href: "/admin/operacao?module=runs", description: "Runs relacionadas" },
              ]
            : []),
        ]);
      }

      if (path === "/automacoes") {
        return [
          { id: "automations-open", label: t("nav.automations"), icon: FiZap, href: "/automacoes", description: "Abrir automações" },
          { id: "automations-flows", label: "Fluxos", icon: FiZap, href: "/automacoes/fluxos", description: "Fluxos e automações" },
          { id: "automations-executions", label: "Execuções", icon: FiZap, href: "/automacoes/execucoes", description: "Runs técnicas" },
          { id: "automations-scripts", label: "Scripts", icon: FiClipboard, href: "/automacoes/scripts", description: "Scripts e artefatos" },
          { id: "automations-cases", label: "Casos", icon: FiList, href: "/automacoes/casos", description: "Casos automatizados" },
          { id: "automations-files", label: "Arquivos", icon: FiBriefcase, href: "/automacoes/arquivos", description: "Arquivos e evidências" },
          { id: "automations-logs", label: "Logs", icon: FiBell, href: "/automacoes/logs", description: "Logs técnicos" },
        ];
      }

      if (/\/defeitos$/.test(path) || path === "/admin/defeitos") {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir defeitos" },
          ...(companyRuns ? [{ id: `${item.href}:runs`, label: companyRunsMenuLabel, icon: FiList, href: companyRuns, description: "Runs relacionadas" }] : []),
          ...(companyDefects ? [{ id: `${item.href}:kanban`, label: "Kanban de defeitos", icon: FiColumns, href: `${companyDefects}/kanban`, description: "Triagem visual" }] : []),
          ...(path === "/admin/defeitos"
            ? [
                { id: `${item.href}:open-items`, label: "Abertos", icon: FiAlertTriangle, href: "/admin/defeitos?status=open", description: "Defeitos em aberto" },
                { id: `${item.href}:risk`, label: "Em risco", icon: FiBell, href: "/admin/defeitos?status=risk", description: "Itens que pedem atenção" },
              ]
            : []),
        ]);
      }

      if (path === "/admin/users") {
        return [
          { id: "users-company", label: "Empresa e usuários", icon: FiUsers, href: "/admin/users?tab=company", description: "Usuários vinculados" },
          { id: "users-testing", label: "Usuários TC", icon: FiUser, href: "/admin/users?tab=testing", description: "Time Testing Company" },
          { id: "users-admin", label: "Líder TC", icon: FiShield, href: "/admin/users?tab=admin", description: "Perfis administrativos" },
          { id: "users-support", label: "Suporte técnico", icon: FiTool, href: "/admin/users?tab=support", description: "Equipe de suporte" },
          ...(canUseAdminClientTools ? [{ id: "users-create", label: "Criar usuário", icon: FiUserPlus, href: "/admin/users?tab=company&create=1", description: "Novo usuário" }] : []),
        ];
      }

      if (path === "/admin/support" || path === "/meus-chamados" || /\/chamados$/.test(path)) {
        return uniqueByHref([
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir suporte" },
          { id: `${item.href}:my`, label: "Meus chamados", icon: FiMessageSquare, href: "/meus-chamados", description: "Chamados do seu escopo" },
          { id: `${item.href}:create`, label: "Criar chamado", icon: FiPlus, href: withQuery(item.href, { create: 1 }), description: "Abrir solicitação" },
          ...(companyRuns ? [{ id: `${item.href}:runs`, label: companyRunsMenuLabel, icon: FiList, href: companyRuns, description: "Runs da empresa" }] : []),
        ]);
      }

      if (path === "/admin/users/permissions") {
        return [
          { id: "permissions-search-user", label: "Selecionar usuário", icon: FiCompass, href: "/admin/users/permissions?focus=users", description: "Buscar usuário para revisar permissões" },
          { id: "permissions-active", label: "Permissões ativas", icon: FiShield, href: "/admin/users/permissions?panel=active", description: "Ver permissões efetivas do perfil" },
          { id: "permissions-modules", label: "Módulos e ações", icon: FiGrid, href: "/admin/users/permissions?section=modules", description: "Editar acessos por módulo" },
          ...(canUseAdminClientTools ? [{ id: "permissions-create-user", label: "Criar usuário global", icon: FiUserPlus, href: "/admin/users/permissions?action=create-user", description: "Cadastrar usuário administrativo" }] : []),
        ];
      }

      if (path === "/admin/brain") {
        return [
          { id: "brain-search-nodes", label: "Buscar nós", icon: FiCompass, href: "/admin/brain?focus=search", description: "Encontrar conhecimento no grafo" },
          { id: "brain-create-node", label: "Criar nó", icon: FiPlus, href: "/admin/brain?tab=create-node", description: "Adicionar conhecimento manualmente" },
          { id: "brain-sync", label: "Sincronizar grafo", icon: FiZap, href: "/admin/brain?action=sync", description: "Atualizar nós e relações" },
          { id: "brain-overview", label: "Visão global", icon: FiGrid, href: "/admin/brain?view=graph", description: "Voltar ao mapa principal" },
        ];
      }

      if (path === "/chat") {
        return [
          { id: "chat-open", label: "Conversas", icon: FiMessageSquare, href: "/chat", description: "Abrir conversas" },
          { id: "chat-search", label: "Buscar", icon: FiCompass, href: "/chat?search=1", description: "Buscar histórico" },
          { id: "chat-favorites", label: "Mensagens salvas", icon: FiBookmark, href: "/chat?view=favorites", description: "Abrir favoritos da conversa" },
        ];
      }

      if (path === "/admin/access-requests" || path === "/admin/audit-logs") {
        return [
          { id: `${item.href}:open`, label: item.label, icon: item.icon, href: item.href, description: "Abrir tela" },
          ...(path === "/admin/access-requests"
            ? [
                { id: `${item.href}:pending`, label: "Pendentes", icon: FiUserPlus, href: "/admin/access-requests?status=pending", description: "Solicitações aguardando análise" },
                { id: `${item.href}:approved`, label: "Aprovadas", icon: FiShield, href: "/admin/access-requests?status=approved", description: "Solicitações aprovadas" },
              ]
            : [
                { id: `${item.href}:changes`, label: "Alterações", icon: FiBell, href: "/admin/audit-logs?scope=changes", description: "Eventos recentes" },
                { id: `${item.href}:access`, label: "Acessos", icon: FiUsers, href: "/admin/audit-logs?scope=access", description: "Entradas e permissões" },
              ]),
        ];
      }

      return [];
    };

    return visibleNavigation.map((item) =>
      toMenuItem(item, {
        id: item.href,
        description: describeNavItem(item),
        children: removeSelfLinks(item.href, buildChildren(item)),
      }),
    );
  }, [canUseAdminClientTools, companyRunsMenuLabel, searchQuery, t, visibleNavigation]);

  const actionLookup = useMemo(() => {
    const map = new Map<string, SidebarMenuItem>();
    const visit = (item: SidebarMenuItem) => {
      if (item.href) map.set(item.href, item);
      item.children?.forEach(visit);
    };
    desktopNavigationItems.forEach(visit);
    return map;
  }, [desktopNavigationItems]);

  const favoriteNavigation = useMemo<SidebarMenuItem[]>(
    () =>
      favoriteHrefs
        .map((href) => actionLookup.get(href))
        .filter((item): item is SidebarMenuItem => Boolean(item)),
    [favoriteHrefs, actionLookup],
  );

  const activeFlyoutItem = useMemo(() => {
    if (!activeFlyoutId || activeFlyoutId === "favorites") return null;
    return desktopNavigationItems.find((item) => item.id === activeFlyoutId) ?? null;
  }, [activeFlyoutId, desktopNavigationItems]);

  const activeFlyoutItems = useMemo(() => {
    if (activeFlyoutId === "favorites") return favoriteNavigation;
    return activeFlyoutItem?.children ?? [];
  }, [activeFlyoutId, activeFlyoutItem, favoriteNavigation]);

  const activeFlyoutTitle = activeFlyoutId === "favorites" ? t("nav.favorites") : activeFlyoutItem?.label ?? "";
  const activeFlyoutDescription =
    activeFlyoutId === "favorites"
      ? "Atalhos salvos para abrir em poucos cliques."
      : activeFlyoutItem?.description ?? "Ações rápidas desta tela.";
  const activeSubmenuItem = useMemo(
    () => activeFlyoutItems.find((item) => item.id === activeSubmenuId) ?? null,
    [activeFlyoutItems, activeSubmenuId],
  );
  const activeSubmenuItems = activeSubmenuItem?.children ?? [];
  const mobileCurrentSection =
    mobileMenuPanel.kind === "section" || mobileMenuPanel.kind === "submenu"
      ? desktopSections.find((section) => section.id === mobileMenuPanel.sectionId) ?? null
      : null;
  const mobileCurrentSectionItems = mobileCurrentSection?.items ?? [];
  const mobileCurrentSubmenuItem =
    mobileMenuPanel.kind === "submenu"
      ? mobileCurrentSectionItems.find((item) => item.id === mobileMenuPanel.itemId) ?? null
      : null;
  const mobileCurrentItems =
    mobileMenuPanel.kind === "root"
      ? desktopSections
      : mobileMenuPanel.kind === "favorites"
        ? favoriteNavigation
        : mobileMenuPanel.kind === "submenu"
          ? mobileCurrentSubmenuItem?.children ?? []
          : mobileCurrentSectionItems;
  const mobilePanelTitle =
    mobileMenuPanel.kind === "root"
      ? "Menu inteligente"
      : mobileMenuPanel.kind === "favorites"
        ? t("nav.favorites")
        : mobileMenuPanel.kind === "submenu"
          ? mobileCurrentSubmenuItem?.label ?? mobileCurrentSection?.label ?? "Menu"
          : mobileCurrentSection?.label ?? "Menu";
  const mobilePanelDescription =
    mobileMenuPanel.kind === "root"
      ? "Escolha uma área para abrir as funções da plataforma."
      : mobileMenuPanel.kind === "favorites"
        ? "Atalhos salvos para abrir em poucos cliques."
        : mobileMenuPanel.kind === "submenu"
          ? mobileCurrentSubmenuItem?.description ?? "Opções disponíveis nesta área."
          : mobileCurrentSection?.description ?? "Opções disponíveis nesta área.";
  const mobileBackLabel =
    mobileMenuPanel.kind === "submenu" && mobileCurrentSection
      ? `Voltar para ${mobileCurrentSection.label}`
      : "Voltar";

  useLayoutEffect(() => {
    if (!activeFlyoutId || viewport.width <= 0 || viewport.height <= 0) {
      setRootFlyoutPlacement(null);
      return;
    }

    const trigger =
      activeFlyoutId === "favorites" ? favoritesTriggerRef.current : rootTriggerRefs.current.get(activeFlyoutId) ?? null;

    if (!trigger) {
      setRootFlyoutPlacement(null);
      return;
    }

    setRootFlyoutPlacement(computeRootFlyoutPlacement(trigger.getBoundingClientRect(), viewport));
  }, [activeFlyoutId, viewport, flyoutRevision]);

  useLayoutEffect(() => {
    if (!activeSubmenuId || !rootFlyoutPlacement || viewport.width <= 0 || viewport.height <= 0) {
      setSubFlyoutPlacement(null);
      return;
    }

    const rootRect = rootFlyoutRef.current?.getBoundingClientRect();
    const submenuTrigger = rootFlyoutRef.current?.querySelector<HTMLElement>(`[data-submenu-id="${activeSubmenuId}"]`);

    if (!rootRect || !submenuTrigger) {
      setSubFlyoutPlacement(null);
      return;
    }

    setSubFlyoutPlacement(
      computeSubFlyoutPlacement(
        submenuTrigger.getBoundingClientRect(),
        viewport,
        {
          top: rootRect.top,
          left: rootRect.left,
          right: rootRect.right,
          bottom: rootRect.bottom,
          width: rootRect.width,
          height: rootRect.height,
        },
      ),
    );
  }, [activeSubmenuId, rootFlyoutPlacement, viewport, flyoutRevision]);

  function renderMenuRow(item: SidebarMenuItem, depth = 0) {
    const isActive = item.href ? isHrefActive(item.href, pathname, searchQuery) : false;
    const rowActive = isActive || Boolean(item.children?.some((child) => isMenuItemActive(child)));
    const isFavorite = item.href ? favoriteHrefs.includes(item.href) : false;
    const hasChildren = Boolean(item.children?.length);
    const canOpenSubmenu = depth === 0 && hasChildren;

    const handleRowEnter = () => {
      if (item.href) prefetchHref(item.href);
      if (!item.children?.length) {
        if (depth === 0) openSmartSubmenu(null);
        return;
      }
      if (canOpenSubmenu) openSmartSubmenu(item.id);
    };

    const handleRowFocus = () => {
      if (item.href) prefetchHref(item.href);
      if (!item.children?.length) {
        if (depth === 0) openSmartSubmenu(null);
        return;
      }
      if (canOpenSubmenu) openSmartSubmenu(item.id);
    };

    return (
      <div
        key={item.id}
        data-submenu-id={canOpenSubmenu ? item.id : undefined}
        className={`group/menu-item relative ${depth > 0 ? "pl-1" : ""}`}
        onMouseEnter={handleRowEnter}
        onFocusCapture={handleRowFocus}
      >
        <Link
          href={item.href ?? "#"}
          prefetch={false}
          className={`group/link relative flex items-start gap-3 overflow-hidden rounded-2xl pr-16 text-left transition-all duration-200 ${
            rowActive
              ? "sidebar-link-state-active bg-white/12 text-white shadow-[0_14px_30px_rgba(1,24,72,0.24)]"
              : "sidebar-link-state-idle text-white/86 hover:bg-white/8 hover:text-white"
          }`}
          onClick={() => {
            closeSmartFlyouts();
            onClose?.();
          }}
        >
          <span
            aria-hidden
            className={`absolute left-1 top-2 bottom-2 w-0.75 rounded-full bg-(--tc-accent,#ef0001) transition-all ${
              isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-60"
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

    const style: CSSProperties = {
      top: placement.top,
      left: placement.left,
      width: placement.width,
      maxHeight: placement.maxHeight,
      zIndex: 120,
    };

    return (
      <div
        ref={options?.panelRef ?? undefined}
        style={style}
        className="sidebar-shell-theme fixed flex flex-col overflow-hidden rounded-[28px] border border-white/12 shadow-[0_26px_80px_rgba(1,24,72,0.34)] backdrop-blur-2xl"
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
      </div>
    );
  }

  function renderSmartFavoriteToggle(item: SidebarMenuItem, tone: "desktop" | "mobile" = "desktop") {
    if (!item.href) return null;
    const isFavorite = favoriteHrefs.includes(item.href);

    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavorite(item.href!);
        }}
        className={`inline-flex ${tone === "mobile" ? "h-8 w-8" : "h-7 w-7"} items-center justify-center rounded-full border transition ${
          tone === "mobile"
            ? isFavorite
              ? "border-[rgba(239,0,1,0.72)] bg-(--tc-accent,#ef0001) text-white shadow-[0_8px_18px_rgba(239,0,1,0.2)]"
              : "border-transparent text-current opacity-50 hover:border-white/10 hover:bg-white/8 hover:opacity-100"
            : isFavorite
              ? "border-[rgba(239,0,1,0.72)] bg-(--tc-accent,#ef0001) text-white shadow-[0_8px_18px_rgba(239,0,1,0.2)]"
              : "border-transparent text-current opacity-40 hover:border-white/10 hover:bg-white/8 hover:opacity-100"
        }`}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Desfixar ${item.label}` : `Fixar ${item.label}`}
        title={isFavorite ? "Desfixar atalho" : "Fixar atalho"}
      >
        <FiBookmark className={isFavorite ? "fill-current" : ""} size={14} />
      </button>
    );
  }

  function renderMobileSectionRow(section: SidebarMenuSection) {
    const isActive = Boolean(section.href && isHrefActive(section.href, pathname, searchQuery)) || section.items.some((item) => isMenuItemActive(item));

    return (
      <div key={section.id} className="group/mobile-item relative flex items-center">
        <button
          type="button"
          className={`group/link relative flex h-12 w-full min-w-0 items-center overflow-hidden rounded-2xl pr-20 text-sm font-semibold transition-all duration-200 ${
            isActive
              ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
              : "sidebar-link-state-idle text-white/76 hover:bg-white/8 hover:text-white"
          }`}
          onClick={() => setMobileMenuPanel({ kind: "section", sectionId: section.id })}
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
            <section.icon size={17} />
          </div>
          <span className="sidebar-label flex-1 overflow-hidden px-3 text-left leading-snug truncate">{section.label}</span>
          <span className="pointer-events-none pr-3 text-white/52">
            <FiChevronRight size={14} />
          </span>
        </button>
        <div className="absolute right-9 top-1/2 -translate-y-1/2">
          {renderSmartFavoriteToggle(
            {
              id: section.id,
              label: section.label,
              icon: section.icon,
              href: section.href,
              description: section.description,
              children: section.items,
            },
            "mobile",
          )}
        </div>
      </div>
    );
  }

  function renderMobileItemRow(
    item: SidebarMenuItem,
    options: { sectionId: string; allowDrilldown?: boolean },
  ) {
    const href = item.href ?? null;
    const isActive = item.href ? isHrefActive(item.href, pathname, searchQuery) : false;
    const rowActive = isActive || Boolean(item.children?.some((child) => isMenuItemActive(child)));
    const canDrill = Boolean(options.allowDrilldown && item.children?.length);

    return (
      <div key={item.id} className="group/mobile-item relative flex items-center">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className={`group/link relative flex h-12 w-full min-w-0 items-center overflow-hidden rounded-2xl pr-20 text-sm font-semibold transition-all duration-200 ${
              rowActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
                : "sidebar-link-state-idle text-white/76 hover:bg-white/8 hover:text-white"
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
            className={`group/link relative flex h-12 w-full min-w-0 items-center overflow-hidden rounded-2xl pr-20 text-sm font-semibold transition-all duration-200 ${
              rowActive
                ? "sidebar-link-state-active bg-white/12 ring-1 ring-white/16 text-white shadow-[0_14px_30px_rgba(1,24,72,0.3)]"
                : "sidebar-link-state-idle text-white/76 hover:bg-white/8 hover:text-white"
            }`}
            onClick={() => {
              setMobileMenuPanel({ kind: "submenu", sectionId: options.sectionId, itemId: item.id });
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

        {href ? (
          <div className="absolute right-9 top-1/2 -translate-y-1/2">
            {renderSmartFavoriteToggle(item, "mobile")}
          </div>
        ) : null}

        {canDrill && href ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMobileMenuPanel({ kind: "submenu", sectionId: options.sectionId, itemId: item.id });
            }}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/72 transition hover:border-white/18 hover:bg-white/10 hover:text-white"
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
      className="sidebar-shell sidebar-shell-theme hidden fixed left-0 top-0 z-40 h-screen overflow-visible border-r backdrop-blur-2xl lg:flex"
      suppressHydrationWarning
      data-app-role={appRole ?? ""}
      data-active-client={activeClientSlug ?? ""}
      data-is-global-admin={isGlobalAdmin ? "1" : "0"}
      data-flyout-open={activeFlyoutId ? "1" : "0"}
    >
      <div className="flex h-full w-full flex-col px-3 py-3">
        <div className="pb-3">
          <Link href={logoHref} className="sidebar-logo flex items-center gap-3 rounded-[24px] px-2 py-2">
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
            <div className="sidebar-reveal sidebar-brand flex min-w-0 flex-col justify-center">
              <span className="sidebar-brand-title">Quality Control</span>
            </div>
          </Link>
        </div>

        <div className="mb-2 space-y-2">
          <button
            type="button"
            ref={favoritesTriggerRef}
            className={`sidebar-link group/link relative flex w-full min-w-0 items-center overflow-hidden rounded-[18px] text-left transition-all duration-200 ${
              isFavoritesOpen
                ? "sidebar-link-state-active bg-white/14 text-white shadow-[0_14px_28px_rgba(1,24,72,0.26)]"
                : "sidebar-link-state-idle text-white/86 hover:bg-white/8 hover:text-white"
            }`}
            title={t("nav.favorites")}
            aria-label={t("nav.favorites")}
            aria-haspopup="menu"
            aria-expanded={isFavoritesOpen}
            onMouseEnter={() => openSmartFlyout("favorites")}
            onMouseLeave={scheduleSmartFlyoutClose}
            onFocus={() => openSmartFlyout("favorites")}
            onBlur={scheduleSmartFlyoutClose}
          >
            <div className="sidebar-menu-icon ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-white/12 bg-(--tc-accent,#ef0001) text-white shadow-[0_10px_24px_rgba(239,0,1,0.18)]">
              <FiBookmark className="fill-current" size={16} />
            </div>
            <div className="sidebar-label min-w-0 flex-1 px-3 py-1.5">
              <div className="text-sm font-semibold leading-5">Favoritos</div>
            </div>
            <span className="sidebar-label mr-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/10 bg-white/8 px-2 text-[11px] font-semibold">
              {favoriteNavigation.length}
            </span>
          </button>
          <div className="sidebar-divider-line h-px w-full bg-white/10" aria-hidden />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <nav className="min-h-0 flex-1 overflow-visible pr-0">
            <div className="sidebar-nav-caption sidebar-label px-2 text-xs uppercase tracking-[0.18em] opacity-55">
              Navegação
            </div>
            <div
              className="sidebar-desktop-nav-list mt-1.5 flex flex-col gap-1"
              style={{ "--sidebar-item-count": desktopNavigationItems.length } as CSSProperties}
            >
              {desktopNavigationItems.map((item) => renderDesktopNavigationItem(item))}
            </div>
          </nav>

          <div className="mt-auto space-y-1 pt-1">
            <div className="sidebar-divider-line h-px w-full bg-white/10" aria-hidden />
            <div className="sidebar-footer pt-1">
              <div className="sidebar-footer-note text-[0.78rem] font-light italic tracking-[0.02em]">
                <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white/70">
                  Testing Company
                </a>
              </div>
            </div>
          </div>
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
            suppressHydrationWarning
            data-app-role={appRole ?? ""}
            data-active-client={activeClientSlug ?? ""}
            data-is-global-admin={isGlobalAdmin ? "1" : "0"}
          className="sidebar-mobile-theme flex h-full w-[min(18rem,calc(100vw-0.75rem))] max-w-[calc(100vw-0.75rem)] flex-col border-r text-white backdrop-blur-2xl"
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
              <div className="flex flex-col justify-center">
                <span className="sidebar-brand-title text-sm font-semibold tracking-wide text-white">Quality Control</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 p-3">
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-4 shadow-[0_18px_40px_rgba(1,24,72,0.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/52">Menu inteligente</p>
                    <h2 className="mt-1 text-lg font-bold leading-tight text-white">{mobilePanelTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-white/68">{mobilePanelDescription}</p>
                  </div>
                  {mobileMenuPanel.kind !== "root" ? (
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white/82 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
                      onClick={() => {
                        if (mobileMenuPanel.kind === "submenu") {
                          setMobileMenuPanel({ kind: "section", sectionId: mobileMenuPanel.sectionId });
                          return;
                        }
                        setMobileMenuPanel({ kind: "root" });
                      }}
                      aria-label={mobileBackLabel}
                      title={mobileBackLabel}
                    >
                      <FiChevronRight size={16} className="rotate-180" />
                    </button>
                  ) : null}
                </div>
              </div>

              {mobileMenuPanel.kind === "root" ? (
                <div className="space-y-2">
                  {favoriteNavigation.length > 0 ? (
                    <button
                      type="button"
                      className="group/mobile-item flex h-12 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 text-left text-sm font-semibold text-white/82 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                      onClick={() => setMobileMenuPanel({ kind: "favorites" })}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/8 text-white/84">
                        <FiBookmark size={17} />
                      </span>
                      <span className="flex-1">Favoritos</span>
                      <span className="rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/62">
                        {favoriteNavigation.length}
                      </span>
                      <FiChevronRight size={14} className="text-white/52" />
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm text-white/64">
                      Nenhum favorito salvo ainda.
                    </div>
                  )}

                  {desktopSections.map((section) => renderMobileSectionRow(section))}
                </div>
              ) : mobileMenuPanel.kind === "favorites" ? (
                <div className="space-y-2 rounded-2xl border border-white/8 bg-white/5 p-2">
                  {favoriteNavigation.length > 0 ? (
                    favoriteNavigation.map((item) => renderMobileItemRow(item, { sectionId: "favorites", allowDrilldown: false }))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm text-white/64">
                      Nenhum favorito salvo ainda.
                    </div>
                  )}
                </div>
              ) : mobileMenuPanel.kind === "section" ? (
                <div className="space-y-2">
                  {mobileCurrentItems.length > 0 ? (
                    mobileCurrentItems.map((item) =>
                      renderMobileItemRow(item, {
                        sectionId: mobileCurrentSection?.id ?? "",
                        allowDrilldown: true,
                      }),
                    )
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm text-white/64">
                      Nenhuma opção disponível.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {mobileCurrentItems.length > 0 ? (
                    mobileCurrentItems.map((item) =>
                      renderMobileItemRow(item, {
                        sectionId: mobileCurrentSection?.id ?? "",
                        allowDrilldown: false,
                      }),
                    )
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/14 bg-white/6 px-3 py-4 text-sm text-white/64">
                      Nenhuma opção disponível.
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          <div className="sidebar-footer shrink-0 p-3">
            <div className="sidebar-footer-divider h-px w-full bg-white/10" aria-hidden />
            <div className="sidebar-footer-note pt-2 text-[0.78rem] font-light italic tracking-[0.02em] text-white/46">
              <a href="https://www.testingcompany.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                Testing Company
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
