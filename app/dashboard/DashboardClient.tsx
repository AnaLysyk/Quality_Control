"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiCompass,
  FiCpu,
  FiDatabase,
  FiGitBranch,
  FiLayers,
  FiMessageCircle,
  FiPieChart,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useAuthUser, type AuthUser } from "@/hooks/useAuthUser";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import Breadcrumb from "@/components/Breadcrumb";
import { buildCompanyPathForAccess } from "@/backend/companyRoutes";

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
  testStats: { total: number; passed: number; failed: number; blocked: number; skipped: number };
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

type ActionCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof FiTarget;
  nodeId: string;
  prompt: string;
};

type Tone = "danger" | "warning" | "success" | "info" | "neutral";

const riskPriority: Record<CompanyRisk, number> = {
  critical: 0,
  warning: 1,
  stable: 2,
  empty: 3,
};

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function formatPercent(value: unknown) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskMeta(risk: CompanyRisk) {
  if (risk === "critical") return { label: "Crítico", badge: "border-red-200 bg-red-50 text-red-700", bar: "bg-red-500", border: "border-red-200", note: "ação imediata" };
  if (risk === "warning") return { label: "Atenção", badge: "border-amber-200 bg-amber-50 text-amber-700", bar: "bg-amber-500", border: "border-amber-200", note: "monitorar" };
  if (risk === "stable") return { label: "Estável", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", border: "border-emerald-200", note: "controlado" };
  return { label: "Sem dados", badge: "border-slate-200 bg-slate-50 text-slate-600", bar: "bg-slate-300", border: "border-slate-200", note: "onboarding" };
}

function healthTone(value: number): Exclude<Tone, "neutral"> {
  if (value < 70) return "danger";
  if (value < 90) return "warning";
  return "success";
}

function qualityGateLabel(value: number) {
  if (value < 70) return "Risco alto";
  if (value < 90) return "Atenção controlada";
  return "Dentro do controle";
}

function resolveRole(user: Partial<AuthUser>) {
  return (
    normalizeLegacyRole(typeof user.permissionRole === "string" ? user.permissionRole : null) ??
    normalizeLegacyRole(typeof user.role === "string" ? user.role : null) ??
    normalizeLegacyRole(typeof user.companyRole === "string" ? user.companyRole : null)
  );
}

function roleLabel(value: ReturnType<typeof resolveRole>) {
  if (value === SYSTEM_ROLES.LEADER_TC) return "Líder TC";
  if (value === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "Suporte Técnico";
  if (value === SYSTEM_ROLES.EMPRESA) return "Empresa";
  if (value === SYSTEM_ROLES.COMPANY_USER) return "Usuário da empresa";
  return "Perfil operacional";
}

function openAssistant(message: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("assistant:open", {
      detail: {
        source: "dashboard",
        agentMode: "qa",
        panelMode: "side",
        initialMessage: message,
        context: {
          module: "dashboard",
          screenLabel: "Visão geral TC",
          screenSummary: "Painel executivo de qualidade por empresa para gestão Testing Company, consultoria, suporte técnico e liderança.",
          suggestedPrompts: [
            "Resuma a carteira de empresas",
            "Quais empresas precisam de ação imediata?",
            "Monte próximos passos para suporte técnico",
            "Abra os nós do Brain relacionados a risco",
          ],
          metadata: metadata ?? null,
        },
      },
    }),
  );
}

export default function DashboardClient() {
  const { user, loading: userLoading } = useAuthUser();
  const router = useRouter();
  const { metrics, loading: metricsLoading, error: metricsError } = useSystemMetrics();
  const [mounted, setMounted] = useState(false);
  const safeUser = useMemo<Partial<AuthUser>>(() => user ?? {}, [user]);
  const metricsData = (metrics ?? null) as SystemMetrics | null;
  const normalizedRole = resolveRole(safeUser);
  const isGlobalAdmin = safeUser.isGlobalAdmin === true || (safeUser as { is_global_admin?: boolean }).is_global_admin === true || safeUser.globalRole === "global_admin";
  const canViewExecutive = isGlobalAdmin || normalizedRole === SYSTEM_ROLES.LEADER_TC || normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const companySlug =
    (typeof safeUser.clientSlug === "string" && safeUser.clientSlug.trim() ? safeUser.clientSlug.trim() : null) ??
    (typeof safeUser.companySlug === "string" && safeUser.companySlug.trim() ? safeUser.companySlug.trim() : null) ??
    null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (mounted && !userLoading && !user) router.replace("/login");
  }, [mounted, router, user, userLoading]);

  useEffect(() => {
    if (!mounted || userLoading || !user || canViewExecutive) return;
    const target = companySlug
      ? buildCompanyPathForAccess(companySlug, "dashboard", {
          isGlobalAdmin,
          permissionRole: typeof safeUser.permissionRole === "string" ? safeUser.permissionRole : null,
          role: typeof safeUser.role === "string" ? safeUser.role : null,
          companyRole: typeof safeUser.companyRole === "string" ? safeUser.companyRole : null,
          userOrigin: typeof safeUser.userOrigin === "string" ? safeUser.userOrigin : null,
          clientSlug: companySlug,
        })
      : "/empresas";
    router.replace(target);
  }, [canViewExecutive, companySlug, isGlobalAdmin, mounted, router, safeUser, user, userLoading]);

  const companyQuality = useMemo<CompanyQuality[]>(
    () => (Array.isArray(metricsData?.companyQuality) ? metricsData.companyQuality : []),
    [metricsData],
  );
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

  const totalTests = metricsData?.testStats.total ?? 0;
  const globalPassRate = totalTests ? Math.round(((metricsData?.testStats.passed ?? 0) / totalTests) * 100) : 0;
  const health = consultingStats.averagePassRate || globalPassRate;

  const priorityCompanies = useMemo(
    () =>
      [...companyQuality]
        .sort((left, right) => {
          const riskDiff = riskPriority[left.risk] - riskPriority[right.risk];
          if (riskDiff !== 0) return riskDiff;
          if (right.openDefects !== left.openDefects) return right.openDefects - left.openDefects;
          if (left.passRate !== right.passRate) return left.passRate - right.passRate;
          return right.runs - left.runs;
        })
        .slice(0, 8),
    [companyQuality],
  );
  const criticalCompanies = companyQuality.filter((company) => company.risk === "critical");
  const attentionCompanies = companyQuality.filter((company) => company.risk === "warning");
  const stableCompanies = companyQuality.filter((company) => company.risk === "stable");
  const emptyCompanies = companyQuality.filter((company) => company.risk === "empty");
  const totalCompanies = metricsData?.overview?.totalCompanies ?? companyQuality.length;
  const totalRuns = metricsData?.overview?.totalTestRuns ?? companyQuality.reduce((sum, company) => sum + company.runs, 0);
  const companiesWithRuns = companyQuality.filter((company) => company.runs > 0).length;
  const qaseCoverage = consultingStats.totalProjects > 0 ? clampPercent((consultingStats.qaseProjects / consultingStats.totalProjects) * 100) : 0;
  const unresolvedTests = (metricsData?.testStats.failed ?? 0) + (metricsData?.testStats.blocked ?? 0);
  const riskQueueCount = criticalCompanies.length + attentionCompanies.length;
  const averageDefectsByCompany = totalCompanies > 0 ? consultingStats.openDefects / totalCompanies : 0;
  const lastUpdatedLabel = formatDateTime(metricsData?.lastUpdated ?? null);
  const currentHealthTone = healthTone(health);

  const controlSignals = [
    {
      label: "Gate da carteira",
      value: metricsLoading ? "..." : formatPercent(health),
      detail: qualityGateLabel(health),
      icon: FiTarget,
      tone: currentHealthTone,
    },
    {
      label: "Cobertura Qase",
      value: `${qaseCoverage}%`,
      detail: `${formatNumber(consultingStats.qaseProjects)} de ${formatNumber(consultingStats.totalProjects)} projetos`,
      icon: FiPieChart,
      tone: qaseCoverage >= 85 ? "success" : qaseCoverage >= 50 ? "warning" : "danger",
    },
    {
      label: "Falhas e bloqueios",
      value: formatNumber(unresolvedTests),
      detail: `${formatNumber(metricsData?.testStats.failed ?? 0)} falhas, ${formatNumber(metricsData?.testStats.blocked ?? 0)} bloqueios`,
      icon: FiGitBranch,
      tone: unresolvedTests > 0 ? "danger" : "success",
    },
    {
      label: "Empresas sem execução",
      value: formatNumber(emptyCompanies.length),
      detail: `${formatNumber(companiesWithRuns)} com histórico de runs`,
      icon: FiCompass,
      tone: emptyCompanies.length > 0 ? "warning" : "success",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; icon: typeof FiTarget; tone: Tone }>;

  const decisionQueue = [
    {
      title: "Conter empresas críticas",
      value: criticalCompanies.length,
      detail: "Risco alto na carteira",
      tone: criticalCompanies.length > 0 ? "danger" : "success",
    },
    {
      title: "Revisar atenção operacional",
      value: attentionCompanies.length,
      detail: "Empresas com sinais de degradação",
      tone: attentionCompanies.length > 0 ? "warning" : "success",
    },
    {
      title: "Fechar lacunas de execução",
      value: emptyCompanies.length,
      detail: "Sem dados de run para leitura de qualidade",
      tone: emptyCompanies.length > 0 ? "warning" : "success",
    },
  ] satisfies Array<{ title: string; value: number; detail: string; tone: Tone }>;

  const actionCards: ActionCard[] = [
    {
      title: "Carteira de empresas",
      description: "Abra a visão de clientes e entre no dashboard ou nos projetos de cada empresa.",
      href: "/admin/clients",
      icon: FiBriefcase,
      nodeId: "exec-companies",
      prompt: "Analise a carteira de empresas e me diga quais clientes precisam de ação consultiva primeiro.",
    },
    {
      title: "Projetos e operações",
      description: "Controle qualidade por aplicação: dashboard, casos, defeitos, planos, runs e docs.",
      href: "/empresas",
      icon: FiLayers,
      nodeId: "exec-projects",
      prompt: "Explique como devo usar projetos e operações para separar qualidade por aplicação.",
    },
    {
      title: "Repositório de casos",
      description: "Importe, exporte, revise cobertura e use a referência Qase como rastreabilidade opcional.",
      href: "/casos-de-teste",
      icon: FiDatabase,
      nodeId: "exec-test-cases",
      prompt: "Analise o repositório de casos e me ajude a encontrar lacunas de cobertura.",
    },
    {
      title: "Defeitos e risco",
      description: "Priorize bugs por empresa/projeto, severidade e impacto operacional.",
      href: "/issues",
      icon: FiAlertCircle,
      nodeId: "exec-defects",
      prompt: "Monte uma visão executiva dos defeitos abertos e riscos por empresa.",
    },
    {
      title: "Brain contextual",
      description: "Acesse os nós executivos, de QA, projetos, permissões e assistente por perfil.",
      href: "/admin/sistema/mapa",
      icon: FiCpu,
      nodeId: "exec-brain",
      prompt: "Abra o Brain e explique os nós da visão executiva da Testing Company.",
    },
    {
      title: "Perfis e governança",
      description: "Confira o que cada perfil acessa e como o chat deve ajudar sem quebrar RBAC.",
      href: "/admin/users/permissions",
      icon: FiShield,
      nodeId: "exec-permissions",
      prompt: "Explique a matriz de perfis e como o chat deve ajudar cada perfil com segurança.",
    },
  ];

  if (!mounted || userLoading) return <div className="tc-empty-state min-h-80">Carregando painel executivo.</div>;
  if (!user) return <div className="tc-empty-state min-h-80">Redirecionando para login.</div>;
  if (!canViewExecutive) return <div className="tc-empty-state min-h-80">Redirecionando para a visão da empresa.</div>;

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <Breadcrumb items={[{ label: "Testing Company" }, { label: "Visão geral" }]} />

        <section className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--tc-accent,#ef0001)]">Controle de qualidade</p>
              <h1 className="mt-1 text-2xl font-black text-[var(--tc-text,#0b1a3c)] sm:text-3xl">Visão geral da carteira TC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tc-text-muted,#64748b)]">
                Mesa executiva para Líder TC e Suporte Técnico acompanharem saúde, risco, execução, defeitos e governança por empresa.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">
                <span className="rounded-md border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5">{roleLabel(normalizedRole)}</span>
                <span className="max-w-full truncate rounded-md border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5">{safeUser.email ?? "sem e-mail"}</span>
                <span className="rounded-md border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5">{metricsData?.lastUpdated ? `Atualizado ${lastUpdatedLabel}` : "Aguardando atualização"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAssistant("Resuma a visão executiva da Testing Company e priorize as ações por empresa.", { nodeId: "exec-root", role: normalizedRole })}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--tc-primary,#011848)] px-4 text-sm font-bold text-white transition hover:opacity-90"
              >
                <FiMessageCircle className="h-4 w-4" /> Perguntar IA
              </button>
              <Link href="/admin/sistema/mapa?node=exec-root" className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--tc-border,#d7deea)] bg-white px-4 text-sm font-bold text-[var(--tc-text,#0b1a3c)] transition hover:bg-[var(--tc-surface-2,#f8fafc)]">
                <FiCpu className="h-4 w-4" /> Brain executivo
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveMetric label="Saúde média" value={metricsLoading ? "..." : formatPercent(health)} detail={qualityGateLabel(health)} icon={FiTrendingUp} tone={currentHealthTone} />
            <ExecutiveMetric label="Fila de risco" value={formatNumber(riskQueueCount)} detail={`${formatNumber(criticalCompanies.length)} críticas, ${formatNumber(attentionCompanies.length)} em atenção`} icon={FiAlertCircle} tone={riskQueueCount > 0 ? "danger" : "success"} />
            <ExecutiveMetric label="Runs avaliadas" value={formatNumber(totalRuns)} detail={`${formatNumber(totalTests)} testes na base`} icon={FiBarChart2} tone="info" />
            <ExecutiveMetric label="Defeitos abertos" value={formatNumber(consultingStats.openDefects)} detail={`${averageDefectsByCompany.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por empresa`} icon={FiActivity} tone={consultingStats.openDefects > 0 ? "warning" : "success"} />
          </div>
        </section>

        {metricsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {metricsError instanceof Error ? metricsError.message : String(metricsError)}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <SectionHeader
              kicker="Prioridade QA"
              title="Fila de empresas por risco"
              description="Ordenação por criticidade, defeitos abertos, pass rate e volume de execução."
              action={
              <button
                type="button"
                onClick={() => openAssistant("Analise o ranking de empresas e gere uma ordem de atendimento para Líder TC e Suporte Técnico.", { nodeId: "exec-companies", criticalCompanies: criticalCompanies.length })}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--tc-border,#d7deea)] bg-white px-4 text-sm font-bold text-[var(--tc-text,#0b1a3c)] transition hover:bg-[var(--tc-surface-2,#f8fafc)]"
              >
                <FiMessageCircle /> Analisar carteira
              </button>
              }
            />

            {metricsLoading && !metricsData ? (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : priorityCompanies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--tc-border,#d7deea)] bg-white px-5 py-10 text-center text-sm font-semibold text-[var(--tc-text-muted,#64748b)]">
                Ainda não há dados suficientes de qualidade por empresa. Configure empresas, projetos, casos ou runs para alimentar a visão executiva.
              </div>
            ) : (
              <div className="grid gap-3">
                {priorityCompanies.map((company) => <CompanyRiskCard key={company.slug} company={company} />)}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <PortfolioPanel
              total={totalCompanies}
              rows={[
                { icon: FiAlertCircle, label: "Críticas", value: criticalCompanies.length, tone: "danger", description: "Atuação imediata" },
                { icon: FiActivity, label: "Em atenção", value: attentionCompanies.length, tone: "warning", description: "Monitoramento ativo" },
                { icon: FiCheckCircle, label: "Estáveis", value: stableCompanies.length, tone: "success", description: "Qualidade controlada" },
                { icon: FiCompass, label: "Sem dados", value: emptyCompanies.length, tone: "neutral", description: "Onboarding operacional" },
              ]}
            />
            <DecisionQueuePanel items={decisionQueue} />
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <SectionHeader kicker="Controle" title="Sinais operacionais" description="Indicadores para triagem diária da carteira e sustentação da qualidade." />
            <div className="grid gap-3 sm:grid-cols-2">
              {controlSignals.map((signal) => <ControlSignalCard key={signal.label} signal={signal} />)}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader kicker="Operação" title="Atalhos de governança QA" description="Acessos diretos para investigar carteira, projetos, casos, defeitos, Brain e permissões." />
            <div className="grid gap-3 md:grid-cols-2">
              {actionCards.map((card) => <ExecutiveActionCard key={card.title} card={card} />)}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader kicker="Perfil" title="Foco de atuação" description="Leitura separada para liderança, suporte e governança." />
          <div className="grid gap-3 lg:grid-cols-3">
            <ProfileHelpCard title="Líder TC" description="Carteira, criticidade, prioridade consultiva, governança e saúde geral." prompts={["Priorize a carteira", "Gere resumo executivo", "Compare empresas críticas"]} />
            <ProfileHelpCard title="Suporte Técnico" description="Risco, bug, bloqueio, triagem, evidência e encaminhamento por empresa/projeto." prompts={["Explique causa provável", "Sugira próxima ação", "Monte resposta técnica"]} />
            <ProfileHelpCard title="Governança" description="Perfis, permissões, rastreabilidade, cobertura e consistência da operação QA." prompts={["Revisar permissões", "Checar cobertura", "Auditar risco"]} />
          </div>
        </section>
      </div>
    </main>
  );
}

const toneStyles: Record<Tone, { icon: string; value: string; bar: string; soft: string }> = {
  danger: {
    icon: "border-red-200 bg-red-50 text-red-700",
    value: "text-red-700",
    bar: "bg-red-500",
    soft: "bg-red-50 text-red-700 border-red-200",
  },
  warning: {
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    value: "text-amber-700",
    bar: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 border-amber-200",
  },
  success: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    value: "text-emerald-700",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  info: {
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    value: "text-blue-700",
    bar: "bg-blue-500",
    soft: "bg-blue-50 text-blue-700 border-blue-200",
  },
  neutral: {
    icon: "border-slate-200 bg-slate-50 text-slate-600",
    value: "text-slate-700",
    bar: "bg-slate-400",
    soft: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

function SectionHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-[var(--tc-accent,#ef0001)]">{kicker}</p>
        <h2 className="mt-1 text-xl font-black text-[var(--tc-text,#0b1a3c)] sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tc-text-muted,#64748b)]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ExecutiveMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof FiTarget; tone: Tone }) {
  const styles = toneStyles[tone];
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[var(--tc-text-muted,#64748b)]">{label}</p>
          <p className={`mt-2 text-3xl font-black ${styles.value}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${styles.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">{detail}</p>
    </article>
  );
}

function CompanyRiskCard({ company }: { company: CompanyQuality }) {
  const meta = riskMeta(company.risk);
  const progress = clampPercent(Math.max(company.passRate, company.runs > 0 ? 8 : 0));

  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm transition hover:border-[var(--tc-primary,#011848)] ${meta.border}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px_230px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-lg font-black text-[var(--tc-text,#0b1a3c)]">{company.name}</h3>
            <span className={`rounded-md border px-2 py-1 text-xs font-bold ${meta.badge}`}>{meta.label}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">/{company.slug} · {meta.note} · última atividade {formatDateTime(company.lastActivityAt)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <MiniStat label="Saúde" value={formatPercent(company.passRate)} />
          <MiniStat label="Falhas" value={formatNumber(company.failed)} />
          <MiniStat label="Bloqueios" value={formatNumber(company.blocked)} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Runs" value={formatNumber(company.runs)} />
            <MiniStat label="Projetos" value={formatNumber(company.projects)} />
            <MiniStat label="Defeitos" value={formatNumber(company.openDefects)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/empresas/${encodeURIComponent(company.slug)}/dashboard`} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--tc-primary,#011848)] px-3 text-xs font-bold text-white">
              <FiBarChart2 className="h-4 w-4" /> Dashboard
            </Link>
            <Link href={`/empresas/${encodeURIComponent(company.slug)}/projetos`} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--tc-border,#d7deea)] bg-white px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
              <FiLayers className="h-4 w-4" /> Projetos
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-black text-[var(--tc-text,#0b1a3c)]">{value}</div>
      <div className="mt-0.5 truncate text-[11px] font-semibold uppercase text-[var(--tc-text-muted,#64748b)]">{label}</div>
    </div>
  );
}

function PortfolioPanel({ total, rows }: { total: number; rows: Array<{ icon: typeof FiTarget; label: string; value: number; description: string; tone: Tone }> }) {
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--tc-accent,#ef0001)]">Resumo da carteira</p>
      <h2 className="mt-1 text-xl font-black text-[var(--tc-text,#0b1a3c)]">Distribuição executiva</h2>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => <PortfolioRow key={row.label} total={total} {...row} />)}
      </div>
    </article>
  );
}

function PortfolioRow({ icon: Icon, label, value, description, tone, total }: { icon: typeof FiTarget; label: string; value: number; description: string; tone: Tone; total: number }) {
  const styles = toneStyles[tone];
  const percent = total > 0 ? clampPercent((value / total) * 100) : 0;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${styles.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-black text-[var(--tc-text,#0b1a3c)]">{label}</p>
            <p className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{formatNumber(value)}</p>
          </div>
          <p className="truncate text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">{description}</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DecisionQueuePanel({ items }: { items: Array<{ title: string; value: number; detail: string; tone: Tone }> }) {
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--tc-accent,#ef0001)]">Fila de decisão</p>
          <h2 className="mt-1 text-xl font-black text-[var(--tc-text,#0b1a3c)]">Ação QA</h2>
        </div>
        <button
          type="button"
          onClick={() => openAssistant("Monte um plano de ação para a fila de decisão QA da carteira.", { nodeId: "exec-qa-queue" })}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--tc-border,#d7deea)] bg-white px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
        >
          <FiMessageCircle className="h-4 w-4" /> IA
        </button>
      </div>
      <div className="mt-4 divide-y divide-(--tc-border,#d7deea)">
        {items.map((item) => {
          const styles = toneStyles[item.tone];
          return (
            <div key={item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-black ${styles.soft}`}>{formatNumber(item.value)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</p>
                <p className="truncate text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ControlSignalCard({ signal }: { signal: { label: string; value: string; detail: string; icon: typeof FiTarget; tone: Tone } }) {
  const Icon = signal.icon;
  const styles = toneStyles[signal.tone];
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase text-[var(--tc-text-muted,#64748b)]">{signal.label}</p>
          <p className={`mt-2 text-2xl font-black ${styles.value}`}>{signal.value}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--tc-text-muted,#64748b)]">{signal.detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${styles.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

function ExecutiveActionCard({ card }: { card: ActionCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm transition hover:border-[var(--tc-primary,#011848)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-primary,#011848)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-black text-[var(--tc-text,#0b1a3c)]">{card.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--tc-text-muted,#64748b)]">{card.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={card.href} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--tc-primary,#011848)] px-3 text-xs font-bold text-white">
          Abrir <FiArrowRight className="h-4 w-4" />
        </Link>
        <button type="button" onClick={() => openAssistant(card.prompt, { nodeId: card.nodeId, route: card.href })} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--tc-border,#d7deea)] bg-white px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
          <FiCpu className="h-4 w-4" /> Brain
        </button>
      </div>
    </article>
  );
}

function ProfileHelpCard({ title, description, prompts }: { title: string; description: string; prompts: string[] }) {
  return (
    <article className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-primary,#011848)]">
          <FiUsers className="h-4 w-4" />
        </div>
        <h3 className="text-base font-black text-[var(--tc-text,#0b1a3c)]">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--tc-text-muted,#64748b)]">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => openAssistant(prompt, { profile: title })} className="rounded-md border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
            {prompt}
          </button>
        ))}
      </div>
    </article>
  );
}

