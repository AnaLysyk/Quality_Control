"use client";

import Image from "next/image";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useClientContext } from "@/context/ClientContext";
import { useI18n } from "@/hooks/useI18n";
import { hasFailedImageSrc, markFailedImageSrc } from "@/lib/failedImageSrc";
import { shortenCompanyPathname, shouldUseShortCompanyRoutes } from "@/lib/companyRoutes";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import {
  resolveFixedProfileKind,
  type FixedProfileKind,
} from "@/lib/fixedProfilePresentation";
import { AppShellCoverSlotProvider } from "./AppShellCoverSlotContext";
import MainWrapper from "./MainWrapper";
import Sidebar from "./Sidebar";
import {
  DeferredChatButton,
  DeferredNotesButton,
  DeferredNotificationsButton,
  DeferredProfileButton,
  DeferredTicketsButton,
  ThemeToggleButton,
} from "./LazyShellTools";

interface AppShellProps {
  children: ReactNode;
}

type ShellIdentity = {
  kicker: string;
  title: string;
  note: string;
  badge: string;
  profileLabel: string;
  coverClassName: string;
  logoSrc: string | null;
  logoAlt: string;
  logoFallbackText: string;
};

type ViewerProfileKind = FixedProfileKind;

type CompanyBrand = {
  name: string;
  slug: string;
  logoUrl: string | null;
};

const APP_SHELL_COPY = {
  "pt-BR": {
    qualityControl: "Quality Control",
    sections: {
      home: "Home",
      dashboard: "Dashboard",
      metrics: "Metricas",
      apps: "Aplicacoes",
      runs: "Runs",
      defects: "Defeitos",
      support: "Suporte",
      testPlans: "Planos de teste",
      profile: "Perfil",
      settings: "Configuracoes",
      commandCenter: "Command Center",
      requests: "Solicitacoes",
      documents: "Documentos",
      users: "Usuarios",
      companies: "Empresas",
      brandIdentity: "Identidade visual",
    },
    notes: {
      dashboard: "Leitura operacional da empresa, com sinais de execucao, risco e desempenho.",
      runs: "Acompanhe as execucoes manuais e integradas com contexto claro e leitura rapida.",
      apps: "Catalogo visual das aplicacoes monitoradas, integracoes conectadas e projetos vinculados.",
      defects: "Triagem dos defeitos e pontos de atencao que precisam de resposta do time.",
      support: "Painel unificado de suporte para abrir tickets, acompanhar comentarios e consultar o andamento.",
      testPlans: "Panorama dos planos, campanhas e vinculos com as aplicacoes da empresa.",
      profile: "Cadastro institucional, identidade visual, usuarios e configuracoes do contexto atual.",
      home: "Entrada institucional da empresa, com contexto salvo, aplicacoes e navegacao principal.",
      commandCenter: "Visao executiva do ambiente administrativo, com acesso rapido aos modulos centrais.",
      default: "Contexto visual da pagina com a assinatura da Testing Company e leitura imediata do modulo.",
    },
    badges: {
      platform: "Plataforma",
      company: "Empresa",
    },
    aria: {
      openMenu: "Abrir menu",
      pageCover: "Capa da pagina {title}",
      companyLogo: "Logo da empresa {name}",
      companyIdentity: "Identidade da empresa {name}",
      platformLogo: "Logo Testing Company",
    },
    kickers: {
      platform: "Testing Company",
      admin: "Testing Company Admin",
      company: "Empresa {name}",
      companyProfile: "Perfil empresa • {name}",
      companyUser: "Usuario da empresa • {name}",
      leader: "Lider TC • Testing Company",
      support: "Suporte tecnico • Testing Company",
      tcUser: "Usuario TC • Testing Company",
    },
    profiles: {
      empresa: "Empresa",
      company_user: "Usuario da empresa",
      testing_company_user: "Usuario TC",
      leader_tc: "Lider TC",
      technical_support: "Suporte tecnico",
    },
  },
  "en-US": {
    qualityControl: "Quality Control",
    sections: {
      home: "Home",
      dashboard: "Dashboard",
      metrics: "Metrics",
      apps: "Applications",
      runs: "Runs",
      defects: "Defects",
      support: "Support",
      testPlans: "Test plans",
      profile: "Profile",
      settings: "Settings",
      commandCenter: "Command Center",
      requests: "Requests",
      documents: "Documents",
      users: "Users",
      companies: "Companies",
      brandIdentity: "Brand identity",
    },
    notes: {
      dashboard: "Operational company view with execution signals, risk, and performance.",
      runs: "Track manual and integrated executions with clear context and quick reading.",
      apps: "Visual catalog of monitored applications, connected integrations, and linked projects.",
      defects: "Defect triage and attention points that need a team response.",
      support: "Unified support panel to open tickets, follow comments, and track progress.",
      testPlans: "Overview of plans, campaigns, and links to the company's applications.",
      profile: "Institutional profile, visual identity, users, and settings for the current context.",
      home: "Company entry view with saved context, applications, and primary navigation.",
      commandCenter: "Executive view of the admin environment, with quick access to core modules.",
      default: "Page context with Testing Company identity and immediate module reading.",
    },
    badges: {
      platform: "Platform",
      company: "Company",
    },
    aria: {
      openMenu: "Open menu",
      pageCover: "Page cover {title}",
      companyLogo: "Company logo {name}",
      companyIdentity: "Company identity {name}",
      platformLogo: "Testing Company logo",
    },
    kickers: {
      platform: "Testing Company",
      admin: "Testing Company Admin",
      company: "Company {name}",
      companyProfile: "Company profile • {name}",
      companyUser: "Company user • {name}",
      leader: "TC lead • Testing Company",
      support: "Technical support • Testing Company",
      tcUser: "TC user • Testing Company",
    },
    profiles: {
      empresa: "Company",
      company_user: "Company user",
      testing_company_user: "TC user",
      leader_tc: "TC lead",
      technical_support: "Technical support",
    },
  },
} as const;

type AppShellCopy = (typeof APP_SHELL_COPY)[Locale];

function humanizeSegment(value: string) {
  const normalized = decodeURIComponent(value || "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!normalized) return "Quality Control";
  if (normalized === "chamados" || normalized === "meus chamados") return "Suporte";

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function replaceName(template: string, name: string) {
  return template.replace("{name}", name);
}

function normalizeSectionKey(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "aplicacoes") return "apps";
  if (normalized === "defeitos") return "defects";
  if (normalized === "suporte" || normalized === "chamados" || normalized === "meus chamados" || normalized === "support") return "support";
  if (normalized === "planos de teste" || normalized === "planos-de-teste") return "testPlans";
  if (normalized === "perfil" || normalized === "profile") return "profile";
  if (normalized === "configuracoes" || normalized === "settings") return "settings";
  if (normalized === "command center") return "commandCenter";
  if (normalized === "metricas" || normalized === "metrics") return "metrics";
  if (normalized === "usuarios" || normalized === "users") return "users";
  if (normalized === "documentos" || normalized === "documents") return "documents";
  if (normalized === "solicitacoes" || normalized === "requests") return "requests";
  if (normalized === "empresas" || normalized === "companies") return "companies";
  if (normalized === "identidade visual" || normalized === "brand identity" || normalized === "brand-identity") return "brandIdentity";
  if (normalized === "home" || normalized === "dashboard" || normalized === "runs") return normalized as "home" | "dashboard" | "runs";
  return null;
}

function resolveSectionLabel(section: string, copy: AppShellCopy) {
  const key = normalizeSectionKey(section);
  return key ? copy.sections[key] : section;
}

function resolveSectionNote(section: string, copy: AppShellCopy) {
  const key = normalizeSectionKey(section);
  if (!key) return copy.notes.default;
  const notes = copy.notes as Record<string, string>;
  return notes[key] ?? copy.notes.default;
}

function resolveShortCompanyIdentity(
  pathname: string,
  copy: AppShellCopy,
): Omit<ShellIdentity, "profileLabel" | "coverClassName" | "logoSrc" | "logoAlt" | "logoFallbackText"> | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const rootSegment = parts[0] ?? "";
  const knownRoots = new Set([
    "admin",
    "api",
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
  ]);

  if (knownRoots.has(rootSegment)) return null;

  const rawSection = humanizeSegment(parts[1] ?? "home");
  const section = resolveSectionLabel(rawSection, copy);

  return {
    kicker: replaceName(copy.kickers.company, humanizeSegment(rootSegment)),
    title: normalizeSectionKey(rawSection) === "home" ? humanizeSegment(rootSegment) : section,
    note: resolveSectionNote(rawSection, copy),
    badge: parts[1] ? section : copy.badges.company,
  };
}

function resolveShellIdentity(
  pathname: string,
  copy: AppShellCopy,
): Omit<ShellIdentity, "profileLabel" | "coverClassName" | "logoSrc" | "logoAlt" | "logoFallbackText"> {
  if (!pathname || pathname === "/") {
    return {
      kicker: copy.kickers.platform,
      title: copy.qualityControl,
      note: copy.notes.default,
      badge: copy.badges.platform,
    };
  }

  const shortCompanyIdentity = resolveShortCompanyIdentity(pathname, copy);
  if (shortCompanyIdentity) {
    return shortCompanyIdentity;
  }

  if (pathname.startsWith("/admin")) {
    const section = pathname.split("/").filter(Boolean)[1] ?? "home";
    const normalizedSection = resolveSectionLabel(humanizeSegment(section === "home" ? "command center" : section), copy);
    return {
      kicker: copy.kickers.admin,
      title: normalizedSection,
      note: resolveSectionNote(section === "home" ? "command center" : section, copy),
      badge: normalizedSection,
    };
  }

  if (pathname.startsWith("/empresas/")) {
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[1] ?? "empresa";
    const section = parts[2] ?? "home";
    const normalizedSection = resolveSectionLabel(humanizeSegment(section), copy);

    return {
      kicker: replaceName(copy.kickers.company, humanizeSegment(slug)),
      title: normalizeSectionKey(section) === "home" ? humanizeSegment(slug) : normalizedSection,
      note: resolveSectionNote(section, copy),
      badge: normalizedSection,
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      kicker: copy.kickers.platform,
      title: copy.sections.settings,
      note: copy.notes.profile,
      badge: copy.sections.settings,
    };
  }

  if (pathname.startsWith("/meus-chamados") || pathname.startsWith("/chamados")) {
    return {
      kicker: copy.kickers.platform,
      title: copy.sections.support,
      note: copy.notes.support,
      badge: copy.sections.support,
    };
  }

  if (pathname.startsWith("/runs")) {
    return {
      kicker: copy.kickers.platform,
      title: copy.sections.runs,
      note: resolveSectionNote("runs", copy),
      badge: copy.sections.runs,
    };
  }

  const rawFallbackTitle = humanizeSegment(pathname.split("/").filter(Boolean).at(-1) ?? copy.qualityControl);
  const fallbackTitle = resolveSectionLabel(rawFallbackTitle, copy);
  return {
    kicker: copy.kickers.platform,
    title: fallbackTitle,
    note: resolveSectionNote(rawFallbackTitle, copy),
    badge: fallbackTitle,
  };
}

function normalizeViewerProfileKind(input: {
  permissionRole?: string | null;
  role?: string | null;
  companyRole?: string | null;
  clientSlug?: string | null;
  companyCount?: number;
}): ViewerProfileKind {
  return resolveFixedProfileKind({
    permissionRole: input.permissionRole,
    role: input.role,
    companyRole: input.companyRole,
    clientSlug: input.clientSlug,
    companyCount: input.companyCount,
  });
}

function profileLabel(profileKind: ViewerProfileKind, copy: AppShellCopy) {
  return copy.profiles[profileKind];
}

function profileCoverClassName(profileKind: ViewerProfileKind) {
  if (profileKind === "empresa") return "app-page-cover--empresa";
  if (profileKind === "company_user") return "app-page-cover--company-user";
  if (profileKind === "leader_tc") return "app-page-cover--leader-tc";
  if (profileKind === "technical_support") return "app-page-cover--technical-support";
  return "app-page-cover--testing-company-user";
}

function profileKicker(profileKind: ViewerProfileKind, company: CompanyBrand | null, copy: AppShellCopy) {
  if (profileKind === "empresa") return replaceName(copy.kickers.companyProfile, company?.name ?? copy.badges.company);
  if (profileKind === "company_user") return replaceName(copy.kickers.companyUser, company?.name ?? copy.badges.company);
  if (profileKind === "leader_tc") return copy.kickers.leader;
  if (profileKind === "technical_support") return copy.kickers.support;
  return copy.kickers.tcUser;
}

function buildLogoFallbackText(label: string) {
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const compact = (parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]) : [label.slice(0, 2)]).join("");
  const normalized = compact.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return normalized || "TC";
}

function profileLogo(
  profileKind: ViewerProfileKind,
  company: CompanyBrand | null,
  routeCompanySlug: string | null,
  copy: AppShellCopy,
) {
  const companyLabel = company?.name ?? (routeCompanySlug ? humanizeSegment(routeCompanySlug) : copy.badges.company);
  const shouldUseCompanyLogo = (profileKind === "empresa" || profileKind === "company_user") && Boolean(company?.logoUrl);
  if (shouldUseCompanyLogo && company) {
    return {
      logoSrc: company.logoUrl ?? "/images/tc.png",
      logoAlt: replaceName(copy.aria.companyLogo, company.name),
      logoFallbackText: buildLogoFallbackText(company.name),
    };
  }
  if (profileKind === "empresa" || profileKind === "company_user") {
    return {
      logoSrc: null,
      logoAlt: replaceName(copy.aria.companyIdentity, companyLabel),
      logoFallbackText: buildLogoFallbackText(companyLabel),
    };
  }
  return {
    logoSrc: "/images/tc.png",
    logoAlt: copy.aria.platformLogo,
    logoFallbackText: "TC",
  };
}

function resolveRouteCompanySlug(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "empresas" && parts[1]) return decodeURIComponent(parts[1]);

  const knownRoots = new Set([
    "admin",
    "api",
    "login",
    "settings",
    "me",
    "profile",
    "home",
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
    "empresas",
  ]);

  const rootSegment = parts[0] ?? "";
  if (!rootSegment || knownRoots.has(rootSegment)) return null;
  return decodeURIComponent(rootSegment);
}

function isSupportRoute(pathname: string) {
  if (
    pathname.startsWith("/kanban-it") ||
    pathname.startsWith("/meus-chamados") ||
    pathname.startsWith("/chamados") ||
    pathname.startsWith("/admin/support") ||
    pathname.startsWith("/admin/chamados")
  ) {
    return true;
  }

  if (/^\/empresas\/[^/]+\/chamados(?:\/.*)?$/.test(pathname)) {
    return true;
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.length >= 2 && parts[1] === "chamados" && resolveRouteCompanySlug(pathname) !== null;
}

function isCompanyDefectsRoute(pathname: string) {
  if (/^\/empresas\/[^/]+\/defeitos(?:\/.*)?$/.test(pathname)) {
    return true;
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.length >= 2 && parts[1] === "defeitos" && resolveRouteCompanySlug(pathname) !== null;
}

function isCompanyAppsRoute(pathname: string) {
  if (/^\/empresas\/[^/]+\/aplicacoes(?:\/.*)?$/.test(pathname)) {
    return true;
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.length >= 2 && parts[1] === "aplicacoes" && resolveRouteCompanySlug(pathname) !== null;
}

function shouldHideShellCover(pathname: string) {
  const hasAdminHeroCover = /^\/admin\/(?:home|test-metric|users|clients|support|access-requests)(?:\/.*)?$/.test(pathname);
  return (
    pathname.startsWith("/settings/profile") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/dashboard") ||
    isCompanyAppsRoute(pathname) ||
    isCompanyDefectsRoute(pathname) ||
    isSupportRoute(pathname) ||
    hasAdminHeroCover
  );
}

function shouldUseNativeImageTag(src: string) {
  return src.startsWith("/api/s3/object?") || /^(https?:|data:|blob:)/i.test(src);
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { language } = useI18n();
  const locale = normalizeLocale(language);
  const shellCopy = APP_SHELL_COPY[locale];
  const { user, companies } = useAuth();
  const { activeClient, activeClientSlug } = useClientContext();
  const isLoginRoute = pathname.startsWith("/login");
  const useMinimalShell = pathname.length === 0 || isLoginRoute;
  const isCompanyRoute = /^\/empresas\/[^/]+(?:\/.*)?$/.test(pathname);
  const isCompanyHomeRoute = /^\/empresas\/[^/]+\/home(?:\/.*)?$/.test(pathname);
  const isHomeRoute = pathname === "/" || pathname === "/home" || /\/home$/.test(pathname);
  const hideShellCover = shouldHideShellCover(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [coverSlotContent, setCoverSlotContent] = useState<ReactNode | null>(null);
  const [, setLogoFailureTick] = useState(0);
  const mobileSidebarId = "app-shell-mobile-sidebar";
  const mobileMenuA11y = {
    "aria-controls": mobileSidebarId,
    "aria-expanded": mobileOpen,
  } as const;
  const shellIdentity = useMemo(() => {
    const baseIdentity = resolveShellIdentity(pathname, shellCopy);
    const routeCompanySlug = resolveRouteCompanySlug(pathname);
    const preferredCompanySlug =
      routeCompanySlug ??
      activeClientSlug ??
      (typeof user?.clientSlug === "string" ? user.clientSlug : null) ??
      (typeof user?.defaultClientSlug === "string" ? user.defaultClientSlug : null) ??
      null;

    const routeMatchedCompany = preferredCompanySlug
      ? companies.find((company) => company.slug === preferredCompanySlug) ?? null
      : null;
    const canFallbackToActiveClient =
      !routeCompanySlug || (activeClient?.slug != null && activeClient.slug === routeCompanySlug);
    const resolvedCompany =
      routeMatchedCompany ??
      (canFallbackToActiveClient && activeClient
        ? {
            id: activeClient.id,
            name: activeClient.name,
            slug: activeClient.slug,
            logoUrl: activeClient.logoUrl ?? null,
          }
        : null);

    const companyBrand: CompanyBrand | null = resolvedCompany
      ? {
          name: resolvedCompany.name,
          slug: resolvedCompany.slug,
          logoUrl: typeof resolvedCompany.logoUrl === "string" ? resolvedCompany.logoUrl : null,
        }
      : null;

    const resolvedViewerProfile = normalizeViewerProfileKind({
      permissionRole: typeof user?.permissionRole === "string" ? user.permissionRole : null,
      role: typeof user?.role === "string" ? user.role : null,
      companyRole: typeof user?.companyRole === "string" ? user.companyRole : null,
      clientSlug: typeof user?.clientSlug === "string" ? user.clientSlug : null,
      companyCount: companies.length,
    });
    const viewerProfile: ViewerProfileKind =
      isCompanyRoute && (resolvedViewerProfile === "empresa" || resolvedViewerProfile === "company_user")
        ? "empresa"
        : resolvedViewerProfile;

    const { logoSrc, logoAlt, logoFallbackText } = profileLogo(viewerProfile, companyBrand, routeCompanySlug, shellCopy);
    const shouldCollapseCompanyKicker =
      baseIdentity.kicker.startsWith("Empresa ") &&
      companyBrand &&
      (viewerProfile === "empresa" || viewerProfile === "company_user");
    const shortProfileLabel = profileLabel(viewerProfile, shellCopy);

    return {
      ...baseIdentity,
      kicker: shouldCollapseCompanyKicker
        ? `${profileKicker(viewerProfile, companyBrand, shellCopy)}`
        : `${profileKicker(viewerProfile, companyBrand, shellCopy)} | ${baseIdentity.kicker}`,
      title:
        isCompanyHomeRoute && companyBrand
          ? companyBrand.name
          : isHomeRoute && !isCompanyRoute
            ? shortProfileLabel
            : baseIdentity.title,
      profileLabel: shortProfileLabel,
      coverClassName: profileCoverClassName(viewerProfile),
      logoSrc,
      logoAlt,
      logoFallbackText,
    };
  }, [
    pathname,
    isCompanyRoute,
    isCompanyHomeRoute,
    isHomeRoute,
    user,
    companies,
    activeClient,
    activeClientSlug,
    shellCopy,
  ]);

  const shellLogoSrc =
    typeof shellIdentity.logoSrc === "string" && shellIdentity.logoSrc.trim()
      ? shellIdentity.logoSrc.trim()
      : null;
  const resolvedShellLogoSrc =
    shellLogoSrc && !hasFailedImageSrc(shellLogoSrc) ? shellLogoSrc : null;

  function handleShellLogoError() {
    if (!shellLogoSrc) return;
    markFailedImageSrc(shellLogoSrc);
    setLogoFailureTick((current) => current + 1);
  }

  const prevPathRef = useRef(pathname);

  // Swipe/touch logic (deve estar dentro do componente)
  const touchStartX = useRef<number | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current !== null) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      if (deltaX > 40) {
        setMobileOpen(true);
        touchStartX.current = null;
      }
    }
  }
  function handleTouchEnd() {
    touchStartX.current = null;
  }

  useEffect(() => {
    if (!pathname.startsWith("/empresas/")) return;

    const nextPath = shortenCompanyPathname(pathname);
    if (!nextPath) return;

    const shouldCanonicalize = shouldUseShortCompanyRoutes({
      isGlobalAdmin: user?.isGlobalAdmin === true,
      permissionRole: typeof user?.permissionRole === "string" ? user.permissionRole : null,
      role: typeof user?.role === "string" ? user.role : null,
      companyRole: typeof user?.companyRole === "string" ? user.companyRole : null,
      userOrigin:
        typeof (user as { userOrigin?: string | null } | null)?.userOrigin === "string"
          ? (user as { userOrigin?: string | null }).userOrigin
          : typeof (user as { user_origin?: string | null } | null)?.user_origin === "string"
            ? (user as { user_origin?: string | null }).user_origin
            : null,
      companyCount: companies.length,
      clientSlug: typeof user?.clientSlug === "string" ? user.clientSlug : null,
    });

    if (!shouldCanonicalize || nextPath === pathname) return;
    router.replace(nextPath);
  }, [pathname, router, user, companies.length]);

  useEffect(() => {
    // Close mobile menu only when the route actually changes.
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    const frameId = window.requestAnimationFrame(() => setMobileOpen(false));
    return () => window.cancelAnimationFrame(frameId);
  }, [pathname]);

  if (useMinimalShell) {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-(--page-bg) text-(--page-text)">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-(--page-bg) text-(--page-text) app-shell">
      {/* Detector de hover na lateral esquerda para telas pequenas */}
      <div
        className={`fixed top-0 left-0 h-full w-16 z-40 menu-hover-area${mobileOpen ? ' menu-hover-area--disabled' : ''}`}
        onMouseEnter={() => setMobileOpen(true)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      <Sidebar
        pathname={pathname}
        mobileOpen={mobileOpen}
        mobilePanelId={mobileSidebarId}
        onClose={() => setMobileOpen(false)}
      />

      {/* Botão de menu mobile/hamburguer */}
      <button
        type="button"
        aria-label={shellCopy.aria.openMenu}
        {...mobileMenuA11y}
        className={[
          "app-shell-menu-toggle fixed top-3 left-3 z-50 rounded-2xl border",
          "p-2.5 text-white backdrop-blur transition duration-200",
          "hover:-translate-y-0.5",
          "sm:top-4 sm:left-4 lg:hidden",
          mobileOpen ? "pointer-events-none opacity-0" : ""
        ].join(" ")}
        onClick={() => setMobileOpen(true)}
        onMouseEnter={() => setMobileOpen(true)}
        onTouchStart={() => setMobileOpen(true)}
        onMouseLeave={() => setMobileOpen(false)}
      >
        <FiMenu size={20} />
      </button>

      <div className="fixed top-3 right-3 z-40 inline-flex w-fit items-center gap-1.5 sm:top-4 sm:right-4 sm:gap-2">
        <DeferredNotificationsButton />
        <DeferredTicketsButton />
        <DeferredNotesButton className="hidden shrink-0 sm:inline-flex" />
        <ThemeToggleButton />
        <DeferredProfileButton />
      </div>

      <DeferredChatButton />

      <div className="flex flex-col min-h-screen app-main">
        <div className="app-stage flex-1 min-h-screen overflow-y-auto overflow-x-hidden">
          <AppShellCoverSlotProvider setCoverSlot={setCoverSlotContent}>
            <MainWrapper
              pathname={pathname}
              beforeContent={hideShellCover ? null :
                <section
                  className={`app-page-cover ${shellIdentity.coverClassName}`}
                  aria-label={replaceName(shellCopy.aria.pageCover, shellIdentity.title)}
                >
                  <div className="app-page-cover-grid">
                    <div className="app-page-cover-row">
                      <div className="app-page-cover-copy">
                        <div className="app-page-cover-brand">
                          <div className="app-page-cover-logo">
                            {resolvedShellLogoSrc ? (
                              shouldUseNativeImageTag(resolvedShellLogoSrc) ? (
                                <img
                                  src={resolvedShellLogoSrc}
                                  alt={shellIdentity.logoAlt}
                                  width={72}
                                  height={72}
                                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                                  loading="eager"
                                  decoding="async"
                                  onError={handleShellLogoError}
                                />
                              ) : (
                                <Image
                                  src={resolvedShellLogoSrc}
                                  alt={shellIdentity.logoAlt}
                                  width={72}
                                  height={72}
                                  className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                                  priority
                                  onError={handleShellLogoError}
                                />
                              )
                            ) : (
                              <span className="text-lg font-bold tracking-[0.18em] text-white/90 sm:text-xl">
                                {shellIdentity.logoFallbackText}
                              </span>
                            )}
                          </div>
                          <div className="app-page-cover-brand-copy">
                            <div className="app-page-cover-title">{shellIdentity.title}</div>
                          </div>
                        </div>
                      </div>
                      {coverSlotContent ? <div className="app-page-cover-addon">{coverSlotContent}</div> : null}
                    </div>
                  </div>
                </section>
              }
            >
              {children}
            </MainWrapper>
          </AppShellCoverSlotProvider>
        </div>
      </div>
    </div>
  );
}
