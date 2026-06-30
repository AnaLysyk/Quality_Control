"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiDatabase,
  FiLayers,
  FiLogOut,
  FiSettings,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useAuthUser, type AuthUser } from "@/hooks/useAuthUser";
import { hasCapability, type Capability } from "@/lib/permissions";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import Breadcrumb from "@/components/Breadcrumb";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useClientContext } from "@/context/ClientContext";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { resolveActiveIdentity } from "@/lib/activeIdentity";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

type CompanyRisk = "critical" | "warning" | "stable" | "empty";

type CompanyQuality = {
  id: string;
  slug: string;
  name: string;
  status: string;
  runs: number;
  projects: number;
  qaseProjects: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  totalTests: number;
  passRate: number;
  openDefects: number;
  risk: CompanyRisk;
  lastActivityAt: string | null;
};

type SystemMetrics = {
  overview: {
    totalUsers: number;
    totalCompanies: number;
    totalReleases: number;
    totalTestRuns: number;
    activeSessions: number;
  };
  testStats: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
  };
  releaseStats: {
    draft: number;
    published: number;
    archived: number;
  };
  companyQuality?: CompanyQuality[];
  consultingStats?: {
    averagePassRate: number;
    criticalCompanies: number;
    attentionCompanies: number;
    stableCompanies: number;
    companiesWithoutRuns: number;
    openDefects: number;
    totalProjects: number;
    qaseProjects: number;
  };
  lastUpdated?: string;
};

function formatNumber(value: unknown) {
  const numberValue = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR").format(numberValue);
}

function formatPercent(value: unknown) {
  const numberValue = Math.round(Number(value) || 0);
  return `${numberValue}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function riskMeta(risk: CompanyRisk) {
  if (risk === "critical") {
    return {
      label: "Crítico",
      className: "border-red-200 bg-red-50 text-red-700",
      bar: "bg-red-500",
      description: "precisa de atuação consultiva",
    };
  }
  if (risk === "warning") {
    return {
      label: "Atenção",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      bar: "bg-amber-500",
      description: "acompanhar evolução",
    };
  }
  if (risk === "stable") {
    return {
      label: "Estável",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      bar: "bg-emerald-500",
      description: "qualidade controlada",
    };
  }
  return {
    label: "Sem dados",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    bar: "bg-slate-300",
    description: "sem execução registrada",
  };
}

export default function DashboardClient() {
  const { user, loading: userLoading } = useAuthUser();
  const { activeClient, activeClientSlug } = useClientContext();
  const router = useRouter();
  const { metrics, loading: metricsLoading, error: metricsError } = useSystemMetrics();
  const metricsData = (metrics ?? null) as SystemMetrics | null;

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

  const safeUser: Partial<AuthUser> = user ?? {};
  const capabilities = (Array.isArray(safeUser.capabilities) ? safeUser.capabilities : []) as Capability[];
  const permissionRole = typeof safeUser.permissionRole === "string" ? safeUser.permissionRole : null;
  const role = typeof safeUser.role === "string" ? safeUser.role : null;
  const companyRole = typeof safeUser.companyRole === "string" ? safeUser.companyRole : null;
  const userOrigin =
    typeof (safeUser as { userOrigin?: string | null }).userOrigin === "string"
      ? (safeUser as { userOrigin?: string | null }).userOrigin ?? null
      : typeof (safeUser as { user_origin?: string | null }).user_origin === "string"
        ? (safeUser as { user_origin?: string | null }).user_origin ?? null
        : null;
  const isGlobalAdmin = safeUser.isGlobalAdmin === true || safeUser.globalRole === "global_admin";
  const normalizedRole =
    normalizeLegacyRole(permissionRole) ??
    normalizeLegacyRole(role) ??
    normalizeLegacyRole(companyRole);
  const canViewLeaderDashboard =
    isGlobalAdmin ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC ||
    normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const scopedCompanySlug =
    activeClientSlug ??
    activeClient?.slug ??
    (typeof safeUser.companySlug === "string" && safeUser.companySlug.trim() ? safeUser.companySlug.trim() : null) ??
    (typeof (safeUser as { clientSlug?: string | null }).clientSlug === "string" &&
    (safeUser as { clientSlug?: string | null }).clientSlug?.trim()
      ? (safeUser as { clientSlug?: string | null }).clientSlug!.trim()
      : null);
  const companySlug = scopedCompanySlug;
  const canViewSystemMetrics = canViewLeaderDashboard;
  const roleLabel = typeof safeUser.role === "string" && safeUser.role.trim() ? safeUser.role : "usuário";
  const activeIdentity = resolveActiveIdentity({ user: user ?? null, activeCompany: activeClient });
  const isCompanyIdentity = activeIdentity.kind === "company";
  const displayName = activeIdentity.displayName || safeUser.fullName?.trim() || safeUser.name || "Usuário";
  const displayUsername = activeIdentity.username || safeUser.username || safeUser.user || null;
  const displayAvatarUrl = activeIdentity.avatarUrl;
  const companyDisplayValue = isCompanyIdentity
    ? activeIdentity.companyName ?? companySlug ?? "Sem empresa"
    : companySlug ?? activeIdentity.companyName ?? "Portfólio TC";
  const avatarFallback = (() => {
    const value = displayName.trim();
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return value.slice(0, 2).toUpperCase();
    return `${parts[0]?.slice(0, 1) ?? ""}${parts[parts.length - 1]?.slice(0, 1) ?? ""}`.toUpperCase();
  })();
  const companyHomeHref = companySlug ? `/empresas/${encodeURIComponent(companySlug)}/home` : "/empresas";
  const runsHref = companySlug ? `/empresas/${encodeURIComponent(companySlug)}/runs` : "/runs";

  useEffect(() => {
    if (userLoading || !user || canViewLeaderDashboard) return;

    const targetHref = scopedCompanySlug
      ? buildCompanyPathForAccess(scopedCompanySlug, "dashboard", {
          isGlobalAdmin,
          permissionRole,
          role,
          companyRole,
          userOrigin,
          clientSlug: scopedCompanySlug,
        })
      : "/empresas";

    router.replace(targetHref);
  }, [
    canViewLeaderDashboard,
    companyRole,
    isGlobalAdmin,
    permissionRole,
    role,
    router,
    scopedCompanySlug,
    user,
    userLoading,
    userOrigin,
  ]);

  const companyQuality = Array.isArray(metricsData?.companyQuality) ? metricsData.companyQuality : [];
  const consultingStats = metricsData?.consultingStats ?? {
    averagePassRate: 0,
    criticalCompanies: 0,
    attentionCompanies: 0,
    stableCompanies: 0,
    companiesWithoutRuns: 0,
    openDefects: 0,
    totalProjects: 0,
    qaseProjects: 0,
  };
  const priorityCompanies = companyQuality.slice(0, 5);
  const criticalCompanies = companyQuality.filter((company) => company.risk === "critical");
  const attentionCompanies = companyQuality.filter((company) => company.risk === "warning");
  const stableCompanies = companyQuality.filter((company) => company.risk === "stable");
  const emptyCompanies = companyQuality.filter((company) => company.risk === "empty");
  const totalTests = metricsData?.testStats.total ?? 0;
  const passRate = totalTests > 0 ? Math.round(((metricsData?.testStats.passed ?? 0) / totalTests) * 100) : 0;

  const quickLinks = [
    {
      title: "Empresas atendidas",
      description: "Abra a carteira de empresas e acompanhe o contexto de cada cliente.",
      href: "/admin/clients",
      kicker: "Carteira",
    },
    {
      title: "Solicitações",
      description: "Revise pedidos de acesso, ajustes e entrada de novos clientes.",
      href: "/requests",
      kicker: "Operação",
    },
    {
      title: "Gestão de Perfis",
      description: "Valide a regra fixa de visibilidade por perfil e módulo.",
      href: "/admin/users/permissions",
      kicker: "Governança",
    },
    {
      title: "Audit Logs",
      description: "Consulte eventos técnicos e rastros importantes da plataforma.",
      href: "/admin/audit-logs",
      kicker: "Auditoria",
    },
    {
      title: "Mapa do Sistema",
      description: "Use o Brain para entender módulos, rotas e dependências do produto.",
      href: "/admin/sistema/mapa",
      kicker: "Brain",
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

  if (!canViewSystemMetrics && hasCapability(capabilities, "company:write")) {
    quickLinks.push({
      title: "Empresas",
      description: "Consulte a carteira de empresas com acesso permitido.",
      href: "/empresas",
      kicker: "Cadastro",
    });
  }

  const overviewCards = [
    {
      label: "Empresas",
      value: metricsData && canViewSystemMetrics ? formatNumber(metricsData.overview.totalCompanies) : "--",
      note: "clientes acompanhados pela Testing Company.",
    },
    {
      label: "Saúde média",
      value: metricsData && canViewSystemMetrics ? formatPercent(consultingStats.averagePassRate || passRate) : "--",
      note: "pass rate médio no portfólio consultivo.",
    },
    {
      label: "Empresas críticas",
      value: metricsData && canViewSystemMetrics ? formatNumber(consultingStats.criticalCompanies) : "--",
      note: "precisam de priorização da consultoria.",
    },
    {
      label: "Projetos",
      value: metricsData && canViewSystemMetrics ? formatNumber(consultingStats.totalProjects) : "--",
      note: "operações/projetos sob controle de qualidade.",
    },
    {
      label: "Defeitos abertos",
      value: metricsData && canViewSystemMetrics ? formatNumber(consultingStats.openDefects) : "--",
      note: "risco ativo distribuído entre empresas.",
    },
    {
      label: "Qase",
      value: metricsData && canViewSystemMetrics ? formatNumber(consultingStats.qaseProjects) : "--",
      note: "projetos integrados ou configurados.",
    },
  ];

  const systemCards = metricsData
    ? [
        { label: "Usuários", value: metricsData.overview.totalUsers, note: "Contas cadastradas na plataforma." },
        { label: "Empresas", value: metricsData.overview.totalCompanies, note: "Empresas na carteira TC." },
        { label: "Runs", value: metricsData.overview.totalReleases, note: "Execuções registradas no sistema." },
        { label: "Testes", value: metricsData.testStats.total, note: "Casos computados nos ciclos." },
        { label: "Sessões", value: metricsData.overview.activeSessions, note: "Sessões autenticadas ativas." },
      ]
    : [];

  const dashboardContext = useDashboardContext({
    user: user ?? undefined,
    companies: companyQuality.map((company) => ({ slug: company.slug, name: company.name })).slice(0, 8),
    fixedCompanySlug: null,
    labels: {
      companyLabel: "Testing Company",
      periodLabel: canViewSystemMetrics ? "Gestão consultiva" : null,
    },
  });
  const dashboardFilters = useDashboardFilters({
    chips: [roleLabel, "Testing Company", canViewSystemMetrics ? "Qualidade por empresa" : null],
  });

  if (userLoading) {
    return <div className="tc-empty-state min-h-80">Carregando painel.</div>;
  }

  if (!user) {
    return <div className="tc-empty-state min-h-80">Redirecionando para login.</div>;
  }

  if (!canViewLeaderDashboard) {
    return <div className="tc-empty-state min-h-80">Redirecionando para o dashboard da empresa.</div>;
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="tc-page-shell py-4 sm:py-6">
        <Breadcrumb items={[{ label: "Painel" }, { label: "Visão geral TC" }]} />

        <DashboardHeader
          kicker="Testing Company"
          title="Visão geral de qualidade por empresa"
          subtitle="Painel consultivo para Líder TC e Suporte Técnico acompanharem saúde, risco e execução das empresas atendidas."
          contextLabel={dashboardContext.contextLabel}
          chips={dashboardFilters.compactChips}
          hiddenChipCount={dashboardFilters.hiddenChipCount}
          className="mb-4"
        />

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("assistant:open", {
                  detail: {
                    source: "dashboard",
                    agentMode: "qa",
                    panelMode: "side",
                    initialMessage: "Analise a visão geral da Testing Company: empresas críticas, qualidade por cliente, riscos, runs, defeitos e próximos passos consultivos.",
                  },
                }));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0b1a3c) shadow-sm transition hover:border-[rgba(1,24,72,0.3)] hover:text-(--tc-primary,#011848)"
          >
            🧠 Perguntar IA
          </button>
        </div>

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
                  <p className="tc-hero-kicker">Gestão e consultoria</p>
                  <h1 className="tc-hero-title">Controle de qualidade da carteira</h1>
                  <p className="tc-hero-description">
                    Acompanhe onde atuar primeiro, quais empresas estão em risco e quais operações precisam de atenção técnica.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                  {displayName}
                </span>
                {displayUsername ? (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                    @{displayUsername}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                  {safeUser.email ?? "Sem e-mail"}
                </span>
                {companySlug ? (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/92">
                    Empresa ativa: {companyDisplayValue}
                  </span>
                ) : null}
              </div>

              <div className="tc-hero-actions">
                <Link href="/admin/clients" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12">
                  <FiBriefcase size={14} />
                  Carteira de empresas
                </Link>
                <Link href="/requests" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12">
                  <FiShield size={14} />
                  Solicitações
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
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {metricsError instanceof Error ? metricsError.message : String(metricsError)}
          </div>
        ) : null}

        <section className="tc-panel">
          <div className="tc-panel-header">
            <div>
              <p className="tc-panel-kicker">Gestão consultiva</p>
              <h2 className="tc-panel-title">Prioridade de atuação por empresa</h2>
              <p className="tc-panel-description">
                Ranking do portfólio pela saúde de qualidade, defeitos abertos, execuções e presença de projetos integrados.
              </p>
            </div>
            <FiTrendingUp size={20} className="text-(--tc-text-muted,#6b7280)" />
          </div>

          {metricsLoading && !metricsData ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="tc-panel-muted min-h-40 animate-pulse" />
              ))}
            </div>
          ) : priorityCompanies.length === 0 ? (
            <div className="tc-empty-state mt-5 min-h-44">
              Sem empresas com dados suficientes. Configure empresas, projetos ou integrações para montar a visão consultiva.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {priorityCompanies.map((company) => {
                const meta = riskMeta(company.risk);
                return (
                  <article key={company.slug} className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black text-(--tc-text-primary,#0b1a3c)">{company.name}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-(--tc-text-muted,#64748b)">/{company.slug} · {meta.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black tracking-[-0.05em] text-(--tc-text-primary,#0b1a3c)">{formatPercent(company.passRate)}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted,#64748b)">saúde</div>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${Math.max(company.passRate, company.runs > 0 ? 8 : 0)}%` }} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-(--tc-text-muted,#64748b)">Runs</div>
                        <div className="mt-1 text-lg font-black">{formatNumber(company.runs)}</div>
                      </div>
                      <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-(--tc-text-muted,#64748b)">Projetos</div>
                        <div className="mt-1 text-lg font-black">{formatNumber(company.projects)}</div>
                      </div>
                      <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-(--tc-text-muted,#64748b)">Defeitos</div>
                        <div className="mt-1 text-lg font-black">{formatNumber(company.openDefects)}</div>
                      </div>
                      <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-(--tc-text-muted,#64748b)">Última ação</div>
                        <div className="mt-1 text-sm font-black">{formatDateTime(company.lastActivityAt)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/empresas/${encodeURIComponent(company.slug)}/dashboard`} className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
                        Dashboard <FiArrowRight size={14} />
                      </Link>
                      <Link href={`/empresas/${encodeURIComponent(company.slug)}/projetos`} className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-(--tc-text-primary,#0b1a3c)">
                        Projetos
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">Portfólio</p>
                <h2 className="tc-panel-title">Resumo da carteira</h2>
                <p className="tc-panel-description">Distribuição executiva para reunião de gestão, suporte e consultoria.</p>
              </div>
              <FiBarChart2 size={20} className="text-(--tc-text-muted,#6b7280)" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="tc-panel-muted">
                <div className="flex items-center gap-3">
                  <FiAlertCircle className="text-red-500" />
                  <div>
                    <div className="tc-kv-label">Críticas</div>
                    <div className="tc-kv-value">{formatNumber(criticalCompanies.length)}</div>
                    <div className="tc-kv-note">empresa(s) para atuação imediata.</div>
                  </div>
                </div>
              </div>
              <div className="tc-panel-muted">
                <div className="flex items-center gap-3">
                  <FiActivity className="text-amber-500" />
                  <div>
                    <div className="tc-kv-label">Em atenção</div>
                    <div className="tc-kv-value">{formatNumber(attentionCompanies.length)}</div>
                    <div className="tc-kv-note">empresa(s) com risco moderado.</div>
                  </div>
                </div>
              </div>
              <div className="tc-panel-muted">
                <div className="flex items-center gap-3">
                  <FiCheckCircle className="text-emerald-500" />
                  <div>
                    <div className="tc-kv-label">Estáveis</div>
                    <div className="tc-kv-value">{formatNumber(stableCompanies.length)}</div>
                    <div className="tc-kv-note">empresa(s) com qualidade controlada.</div>
                  </div>
                </div>
              </div>
              <div className="tc-panel-muted">
                <div className="flex items-center gap-3">
                  <FiClock className="text-slate-500" />
                  <div>
                    <div className="tc-kv-label">Sem dados</div>
                    <div className="tc-kv-value">{formatNumber(emptyCompanies.length)}</div>
                    <div className="tc-kv-note">precisam de onboarding operacional.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {canViewSystemMetrics ? (
            <section className="tc-panel">
              <div className="tc-panel-header">
                <div>
                  <p className="tc-panel-kicker">Base da plataforma</p>
                  <h2 className="tc-panel-title">Números administrativos</h2>
                  <p className="tc-panel-description">Indicadores técnicos que sustentam a operação da Testing Company.</p>
                </div>
                <FiDatabase size={20} className="text-(--tc-text-muted,#6b7280)" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {metricsLoading && !metricsData
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="tc-panel-muted min-h-28 animate-pulse" />
                    ))
                  : systemCards.map((card) => (
                      <div key={card.label} className="tc-kv">
                        <div className="tc-kv-label">{card.label}</div>
                        <div className="tc-kv-value">{formatNumber(card.value)}</div>
                        <div className="tc-kv-note">{card.note}</div>
                      </div>
                    ))}
              </div>
            </section>
          ) : null}
        </section>

        <section className="tc-panel">
          <div className="tc-panel-header">
            <div>
              <p className="tc-panel-kicker">Ações de gestão</p>
              <h2 className="tc-panel-title">Atalhos para liderança e suporte</h2>
              <p className="tc-panel-description">Entradas principais para operação consultiva, governança e sustentação técnica.</p>
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
