"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiCompass, FiLogOut, FiSettings } from "react-icons/fi";
import { useAuthUser, type AuthUser } from "@/hooks/useAuthUser";
import { hasCapability, type Capability } from "@/lib/permissions";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import Breadcrumb from "@/components/Breadcrumb";
import { useClientContext } from "@/context/ClientContext";
import { resolveActiveIdentity } from "@/lib/activeIdentity";

export default function DashboardClient() {
  const { user, loading: userLoading } = useAuthUser();
  const { activeClient } = useClientContext();
  const router = useRouter();
  const { metrics, loading: metricsLoading, error: metricsError } = useSystemMetrics();

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/login");
    }
  }, [userLoading, user, router]);

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        router.push("/login");
      }
    } catch {
      router.push("/login");
    }
  }

  if (userLoading) {
    return <div className="tc-empty-state min-h-80">Carregando painel.</div>;
  }

  if (!user) {
    return <div className="tc-empty-state min-h-80">Redirecionando para login.</div>;
  }

  const safeUser: Partial<AuthUser> = user ?? {};
  const capabilities = (Array.isArray(safeUser.capabilities) ? safeUser.capabilities : []) as Capability[];
  const isGlobalAdmin = safeUser.isGlobalAdmin === true || safeUser.globalRole === "global_admin";
  const normalizedRole = normalizeLegacyRole(
    typeof safeUser.permissionRole === "string" ? safeUser.permissionRole : null,
  ) ?? normalizeLegacyRole(typeof safeUser.role === "string" ? safeUser.role : null);
  const canViewSystemMetrics = isGlobalAdmin || normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const companySlug = typeof safeUser.companySlug === "string" ? safeUser.companySlug : null;
  const roleLabel = typeof safeUser.role === "string" && safeUser.role.trim() ? safeUser.role : "usuário";
  const activeIdentity = resolveActiveIdentity({ user: user ?? null, activeCompany: activeClient });
  const isCompanyIdentity = activeIdentity.kind === "company";
  const displayName = activeIdentity.displayName || safeUser.fullName?.trim() || safeUser.name || "Usuário";
  const displayUsername = activeIdentity.username || safeUser.username || safeUser.user || null;
  const displayAvatarUrl = activeIdentity.avatarUrl;
  const companyDisplayValue = isCompanyIdentity
    ? activeIdentity.companyName ?? companySlug ?? "Sem empresa"
    : companySlug ?? activeIdentity.companyName ?? "Sem empresa";
  const avatarFallback = (() => {
    const value = displayName.trim();
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return value.slice(0, 2).toUpperCase();
    return `${parts[0]?.slice(0, 1) ?? ""}${parts[parts.length - 1]?.slice(0, 1) ?? ""}`.toUpperCase();
  })();
  const companyHomeHref = companySlug ? `/empresas/${encodeURIComponent(companySlug)}/home` : "/empresas";
  const runsHref = companySlug ? `/empresas/${encodeURIComponent(companySlug)}/runs` : "/runs";

  const quickLinks = [
    {
      title: isCompanyIdentity ? "Perfil da empresa" : "Minha conta",
      description: isCompanyIdentity
        ? "Atualize os dados institucionais, login de acesso e integração da empresa."
        : "Atualize dados, senha e preferencias do usuário.",
      href: "/settings/profile",
      kicker: isCompanyIdentity ? "Empresa" : "Conta",
    },
    {
      title: "Solicitações",
      description: "Abra pedidos de troca de e-mail ou empresa.",
      href: "/requests",
      kicker: "Fluxo",
    },
    {
      title: "Contexto da empresa",
      description: "Acesse o painel principal do cliente ativo.",
      href: companyHomeHref,
      kicker: "Empresa",
    },
  ];

  if (hasCapability(capabilities, "run:read")) {
    quickLinks.push({
      title: "Runs",
      description: "Consulte execuções recentes e acompanhe resultados.",
      href: runsHref,
      kicker: "Qualidade",
    });
  }

  if (canViewSystemMetrics) {
    quickLinks.push({
      title: "Administração",
      description: "Abra o painel para empresas, usuários e gestao.",
      href: "/admin/dashboard",
      kicker: "Admin",
    });
    quickLinks.push({
      title: "Empresas",
      description: "Veja a base de empresas cadastradas na plataforma.",
      href: "/admin/clients",
      kicker: "Cadastro",
    });
  } else if (hasCapability(capabilities, "company:write")) {
    quickLinks.push({
      title: "Empresas",
      description: "Consulte a carteira de empresas com acesso permitido.",
      href: "/empresas",
      kicker: "Cadastro",
    });
  }

  const overviewCards = [
    {
      label: "Perfil",
      value: roleLabel,
      note: canViewSystemMetrics ? "Acesso administrativo ativo." : "Permissões conforme o contexto atual.",
    },
    {
      label: "Empresa",
      value: companyDisplayValue,
      note: companySlug ? "Contexto principal carregado na sessao." : "Sem vínculo ativo na sessao.",
    },
    {
      label: "Usuários",
      value: metrics && canViewSystemMetrics ? String(metrics.overview.totalUsers) : "--",
      note: "Base total visivel no painel.",
    },
    {
      label: "Runs 30d",
      value: metrics && canViewSystemMetrics ? String(metrics.overview.totalTestRuns) : "--",
      note: "Volume de execuções no periodo.",
    },
  ];

  const systemCards = metrics
    ? [
        { label: "Usuários", value: metrics.overview.totalUsers, note: "Contas cadastradas na plataforma." },
        { label: "Empresas", value: metrics.overview.totalCompanies, note: "Empresas com cadastro ativo." },
        { label: "Runs", value: metrics.overview.totalReleases, note: "Execuções registradas no sistema." },
        { label: "Testes 30d", value: metrics.overview.totalTestRuns, note: "Execuções consideradas no recorte." },
        { label: "Sessoes", value: metrics.overview.activeSessions, note: "Sessoes autenticadas ativas." },
      ]
    : [];

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="tc-page-shell py-4 sm:py-6">
        <Breadcrumb items={[{ label: "Painel" }]} />

        <section className="tc-hero-panel">
          <div className="tc-hero-grid">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/14 bg-white/10 text-lg font-bold tracking-[0.22em] text-white">
                  {displayAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    avatarFallback
                  )}
                </div>

                <div className="tc-hero-copy">
                  <p className="tc-hero-kicker">Painel inicial</p>
                  <h1 className="tc-hero-title">{isCompanyIdentity ? "Visão geral institucional" : "Visão geral do usuário"}</h1>
                  <p className="tc-hero-description">
                    {isCompanyIdentity
                      ? "Acesso institucional da empresa ativa, com foco no contexto da organização e não em um usuário individual."
                      : "Base inicial para navegar pela plataforma com o mesmo padrão visual das telas principais de administração."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                  {displayName}
                </span>
                {displayUsername ? (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                    {isCompanyIdentity ? `Login @${displayUsername}` : `@${displayUsername}`}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                  {safeUser.email ?? "Sem e-mail"}
                </span>
              </div>

              <div className="tc-hero-actions">
                <Link href="/settings/profile" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12">
                  <FiSettings size={14} />
                  Minha conta
                </Link>
                <button type="button" onClick={() => void handleLogout()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12">
                  <FiLogOut size={14} />
                  Sair
                </button>
              </div>
            </div>

            <div className="tc-hero-stat-grid">
              {overviewCards.map((card) => (
                <div key={card.label} className="tc-hero-stat">
                  <div className="tc-hero-stat-label">{card.label}</div>
                  <div className="tc-hero-stat-value">{card.value}</div>
                  <div className="tc-hero-stat-note">{card.note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {metricsError ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{metricsError}</div>
        ) : null}

        {canViewSystemMetrics ? (
          <section className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">Métricas do sistema</p>
                <h2 className="tc-panel-title">Panorama administrativo</h2>
                <p className="tc-panel-description">Leitura rápida dos principais números do sistema para o perfil global.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {metricsLoading && !metrics
                ? Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="tc-panel-muted min-h-30 animate-pulse" />
                  ))
                : systemCards.map((card) => (
                    <div key={card.label} className="tc-kv">
                      <div className="tc-kv-label">{card.label}</div>
                      <div className="tc-kv-value">{card.value}</div>
                      <div className="tc-kv-note">{card.note}</div>
                    </div>
                  ))}
            </div>

            {metrics ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="tc-panel-muted">
                  <div className="tc-kv-label">Aprovados</div>
                  <div className="tc-kv-value">{metrics.testStats.passed}</div>
                  <div className="tc-kv-note">Resultados aprovados no periodo.</div>
                </div>
                <div className="tc-panel-muted">
                  <div className="tc-kv-label">Falharam</div>
                  <div className="tc-kv-value">{metrics.testStats.failed}</div>
                  <div className="tc-kv-note">Casos com falha registrada.</div>
                </div>
                <div className="tc-panel-muted">
                  <div className="tc-kv-label">Bloqueados</div>
                  <div className="tc-kv-value">{metrics.testStats.blocked}</div>
                  <div className="tc-kv-note">Execuções impedidas por dependencia.</div>
                </div>
                <div className="tc-panel-muted">
                  <div className="tc-kv-label">Não executados</div>
                  <div className="tc-kv-value">{metrics.testStats.skipped}</div>
                  <div className="tc-kv-note">Itens fora da execução no recorte.</div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="tc-panel">
          <div className="tc-panel-header">
            <div>
              <p className="tc-panel-kicker">Ações</p>
              <h2 className="tc-panel-title">Navegacao principal</h2>
              <p className="tc-panel-description">Entradas principais do sistema em cards mais limpos e consistentes com o resto do produto.</p>
            </div>
            <FiCompass size={20} className="text-(--tc-text-muted,#6b7280)" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickLinks.map((item) => (
              <Link key={`${item.kicker}-${item.title}`} href={item.href} className="tc-link-card">
                <span className="tc-link-kicker">{item.kicker}</span>
                <span className="tc-link-title">{item.title}</span>
                <span className="tc-link-text">{item.description}</span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--tc-accent,#ef0001)">
                  Abrir
                  <FiArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
