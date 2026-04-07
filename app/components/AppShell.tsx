"use client";

import Image from "next/image";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useClientContext } from "@/context/ClientContext";
import {
  getFixedProfileLabel,
  resolveFixedProfileKind,
  type FixedProfileKind,
} from "@/lib/fixedProfilePresentation";
import MainWrapper from "./MainWrapper";
import Sidebar from "./Sidebar";
import {
  DeferredChatButton,
  DeferredNotesButton,
  DeferredNotificationsButton,
  DeferredProfileButton,
  DeferredTicketsButton,
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

function humanizeSegment(value: string) {
  const normalized = decodeURIComponent(value || "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!normalized) return "Quality Control";

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveSectionNote(section: string) {
  switch (section) {
    case "dashboard":
      return "Leitura operacional da empresa, com sinais de execucao, risco e desempenho.";
    case "runs":
      return "Acompanhe as execucoes manuais e integradas com contexto claro e leitura rapida.";
    case "aplicacoes":
      return "Catalogo visual das aplicacoes monitoradas, integracoes conectadas e projetos vinculados.";
    case "defeitos":
      return "Triagem dos defeitos e pontos de atencao que precisam de resposta do time.";
    case "planos de teste":
      return "Panorama dos planos, campanhas e vinculos com as aplicacoes da empresa.";
    case "perfil":
    case "profile":
      return "Cadastro institucional, identidade visual, usuarios e configuracoes do contexto atual.";
    case "home":
      return "Entrada institucional da empresa, com contexto salvo, aplicacoes e navegacao principal.";
    case "command center":
      return "Visao executiva do ambiente administrativo, com acesso rapido aos modulos centrais.";
    default:
      return "Contexto visual da pagina com a assinatura da Testing Company e leitura imediata do modulo.";
  }
}

function resolveShortCompanyIdentity(pathname: string): Omit<ShellIdentity, "profileLabel" | "coverClassName" | "logoSrc" | "logoAlt" | "logoFallbackText"> | null {
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

  const section = humanizeSegment(parts[1] ?? "home");

  return {
    kicker: `Empresa ${humanizeSegment(rootSegment)}`,
    title: section === "Home" ? humanizeSegment(rootSegment) : section,
    note: resolveSectionNote(section.toLowerCase()),
    badge: parts[1] ? humanizeSegment(parts[1]) : "Empresa",
  };
}

function resolveShellIdentity(pathname: string): Omit<ShellIdentity, "profileLabel" | "coverClassName" | "logoSrc" | "logoAlt" | "logoFallbackText"> {
  if (!pathname || pathname === "/") {
    return {
      kicker: "Testing Company",
      title: "Quality Control",
      note: "Entrada principal da plataforma com identidade visual, contexto institucional e acesso aos modulos.",
      badge: "Plataforma",
    };
  }

  const shortCompanyIdentity = resolveShortCompanyIdentity(pathname);
  if (shortCompanyIdentity) {
    return shortCompanyIdentity;
  }

  if (pathname.startsWith("/admin")) {
    const section = pathname.split("/").filter(Boolean)[1] ?? "home";
    const normalizedSection = humanizeSegment(section === "home" ? "command center" : section);
    return {
      kicker: "Testing Company Admin",
      title: normalizedSection,
      note: resolveSectionNote(normalizedSection.toLowerCase()),
      badge: normalizedSection,
    };
  }

  if (pathname.startsWith("/empresas/")) {
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[1] ?? "empresa";
    const section = parts[2] ?? "home";
    const normalizedSection = humanizeSegment(section);

    return {
      kicker: `Empresa ${humanizeSegment(slug)}`,
      title: normalizedSection === "Home" ? humanizeSegment(slug) : normalizedSection,
      note: resolveSectionNote(normalizedSection.toLowerCase()),
      badge: normalizedSection,
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      kicker: "Testing Company",
      title: "Configuracoes",
      note: "Ajustes de perfil, preferencias e dados institucionais do ambiente atual.",
      badge: "Configuracoes",
    };
  }

  if (pathname.startsWith("/meus-chamados") || pathname.startsWith("/chamados")) {
    return {
      kicker: "Testing Company",
      title: "Suporte",
      note: "Acompanhe solicitacoes, responsaveis e prioridade com leitura direta para operacao.",
      badge: "Suporte",
    };
  }

  if (pathname.startsWith("/runs")) {
    return {
      kicker: "Testing Company",
      title: "Runs",
      note: resolveSectionNote("runs"),
      badge: "Runs",
    };
  }

  const fallbackTitle = humanizeSegment(pathname.split("/").filter(Boolean).at(-1) ?? "Quality Control");
  return {
    kicker: "Testing Company",
    title: fallbackTitle,
    note: resolveSectionNote(fallbackTitle.toLowerCase()),
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

function profileLabel(profileKind: ViewerProfileKind) {
  return getFixedProfileLabel(profileKind, { short: true });
}

function profileCoverClassName(profileKind: ViewerProfileKind) {
  if (profileKind === "empresa") return "app-page-cover--empresa";
  if (profileKind === "company_user") return "app-page-cover--company-user";
  if (profileKind === "leader_tc") return "app-page-cover--leader-tc";
  if (profileKind === "technical_support") return "app-page-cover--technical-support";
  return "app-page-cover--testing-company-user";
}

function profileKicker(profileKind: ViewerProfileKind, company: CompanyBrand | null) {
  if (profileKind === "empresa") return company ? `Perfil empresa • ${company.name}` : "Perfil empresa";
  if (profileKind === "company_user") return company ? `Usuario da empresa • ${company.name}` : "Usuario da empresa";
  if (profileKind === "leader_tc") return "Lider TC • Testing Company";
  if (profileKind === "technical_support") return "Suporte Tecnico • Testing Company";
  return "Usuario TC â€¢ Testing Company";
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

function profileLogo(profileKind: ViewerProfileKind, company: CompanyBrand | null, routeCompanySlug: string | null) {
  const companyLabel = company?.name ?? (routeCompanySlug ? humanizeSegment(routeCompanySlug) : "Empresa");
  const shouldUseCompanyLogo = (profileKind === "empresa" || profileKind === "company_user") && Boolean(company?.logoUrl);
  if (shouldUseCompanyLogo && company) {
    return {
      logoSrc: company.logoUrl ?? "/images/tc.png",
      logoAlt: `Logo da empresa ${company.name}`,
      logoFallbackText: buildLogoFallbackText(company.name),
    };
  }
  if (profileKind === "empresa" || profileKind === "company_user") {
    return {
      logoSrc: null,
      logoAlt: `Identidade da empresa ${companyLabel}`,
      logoFallbackText: buildLogoFallbackText(companyLabel),
    };
  }
  return {
    logoSrc: "/images/tc.png",
    logoAlt: "Logo Testing Company",
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

function shouldHideShellCover(pathname: string) {
  const hasAdminHeroCover = /^\/admin\/(?:home|test-metric|users|clients|support)(?:\/.*)?$/.test(pathname);
  return (
    pathname.startsWith("/settings/profile") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/kanban-it") ||
    hasAdminHeroCover
  );
}

function shouldUseNativeImageTag(src: string) {
  return src.startsWith("/api/s3/object?") || /^(https?:|data:|blob:)/i.test(src);
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const { user, companies } = useAuth();
  const { activeClient, activeClientSlug } = useClientContext();
  const isLoginRoute = pathname.startsWith("/login");
  const useMinimalShell = pathname.length === 0 || isLoginRoute;
  const isCompanyRoute = /^\/empresas\/[^/]+(?:\/.*)?$/.test(pathname);
  const isCompanyHomeRoute = /^\/empresas\/[^/]+\/home(?:\/.*)?$/.test(pathname);
  const isHomeRoute = pathname === "/" || pathname === "/home" || /\/home$/.test(pathname);
  const hideShellCover = shouldHideShellCover(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shellIdentity = useMemo(() => {
    const baseIdentity = resolveShellIdentity(pathname);
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
    const viewerProfile: ViewerProfileKind = isCompanyRoute ? "empresa" : resolvedViewerProfile;

    const { logoSrc, logoAlt, logoFallbackText } = profileLogo(viewerProfile, companyBrand, routeCompanySlug);
    const shouldCollapseCompanyKicker =
      baseIdentity.kicker.startsWith("Empresa ") &&
      companyBrand &&
      (viewerProfile === "empresa" || viewerProfile === "company_user");
    const shortProfileLabel = profileLabel(viewerProfile);

    return {
      ...baseIdentity,
      kicker: shouldCollapseCompanyKicker
        ? `${profileKicker(viewerProfile, companyBrand)}`
        : `${profileKicker(viewerProfile, companyBrand)} | ${baseIdentity.kicker}`,
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
  ]);

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

      <Sidebar pathname={pathname} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Botão de menu mobile/hamburguer */}
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={mobileOpen ? "true" : "false"}
        className={[
          "fixed top-3 left-3 z-50 rounded-2xl border border-white/14",
          "bg-[linear-gradient(135deg,rgba(1,24,72,0.96)_0%,rgba(10,47,122,0.94)_58%,rgba(239,0,1,0.88)_100%)]",
          "p-2.5 text-white shadow-[0_18px_40px_rgba(1,24,72,0.34)] backdrop-blur transition duration-200",
          "hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(1,24,72,0.4)]",
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
        <DeferredProfileButton />
      </div>

      <DeferredChatButton />

      <div className="flex flex-col min-h-screen app-main">
        <div className="app-stage flex-1 min-h-screen overflow-y-auto overflow-x-hidden">
          <MainWrapper
            pathname={pathname}
            beforeContent={hideShellCover ? null :
              <section className={`app-page-cover ${shellIdentity.coverClassName}`} aria-label={`Capa da pagina ${shellIdentity.title}`}>
                <div className="app-page-cover-grid">
                  <div className="app-page-cover-copy">
                    <div className="app-page-cover-brand">
                      <div className="app-page-cover-logo">
                        {shellIdentity.logoSrc ? (
                          shouldUseNativeImageTag(shellIdentity.logoSrc) ? (
                            <img
                              src={shellIdentity.logoSrc}
                              alt={shellIdentity.logoAlt}
                              width={72}
                              height={72}
                              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                              loading="eager"
                              decoding="async"
                            />
                          ) : (
                            <Image
                              src={shellIdentity.logoSrc}
                              alt={shellIdentity.logoAlt}
                              width={72}
                              height={72}
                              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                              priority
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
                </div>
              </section>
            }
          >
            {children}
          </MainWrapper>
        </div>
      </div>
    </div>
  );
}
