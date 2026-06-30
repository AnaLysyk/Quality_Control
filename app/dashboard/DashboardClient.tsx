"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import Breadcrumb from "@/components/Breadcrumb";
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

function riskMeta(risk: CompanyRisk) {
  if (risk === "critical") return { label: "Crítico", badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", note: "ação imediata" };
  if (risk === "warning") return { label: "Atenção", badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", note: "acompanhar" };
  if (risk === "stable") return { label: "Estável", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", note: "controlado" };
  return { label: "Sem dados", badge: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-300", note: "onboarding" };
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
  const safeUser: Partial<AuthUser> = user ?? {};
  const metricsData = (metrics ?? null) as SystemMetrics | null;
  const normalizedRole = resolveRole(safeUser);
  const isGlobalAdmin = safeUser.isGlobalAdmin === true || (safeUser as { is_global_admin?: boolean }).is_global_admin === true || safeUser.globalRole === "global_admin";
  const canViewExecutive = isGlobalAdmin || normalizedRole === SYSTEM_ROLES.LEADER_TC || normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const companySlug =
    (typeof safeUser.clientSlug === "string" && safeUser.clientSlug.trim() ? safeUser.clientSlug.trim() : null) ??
    (typeof safeUser.companySlug === "string" && safeUser.companySlug.trim() ? safeUser.companySlug.trim() : null) ??
    null;

  useEffect(() => {
    if (!userLoading && !user) router.replace("/login");
  }, [router, user, userLoading]);

  useEffect(() => {
    if (userLoading || !user || canViewExecutive) return;
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
  }, [canViewExecutive, companySlug, isGlobalAdmin, router, safeUser, user, userLoading]);

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

  const totalTests = metricsData?.testStats.total ?? 0;
  const globalPassRate = totalTests ? Math.round(((metricsData?.testStats.passed ?? 0) / totalTests) * 100) : 0;
  const health = consultingStats.averagePassRate || globalPassRate;

  const priorityCompanies = useMemo(() => companyQuality.slice(0, 6), [companyQuality]);
  const criticalCompanies = companyQuality.filter((company) => company.risk === "critical");
  const attentionCompanies = companyQuality.filter((company) => company.risk === "warning");
  const stableCompanies = companyQuality.filter((company) => company.risk === "stable");
  const emptyCompanies = companyQuality.filter((company) => company.risk === "empty");

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

  if (userLoading) return <div className="tc-empty-state min-h-80">Carregando painel executivo.</div>;
  if (!user) return <div className="tc-empty-state min-h-80">Redirecionando para login.</div>;
  if (!canViewExecutive) return <div className="tc-empty-state min-h-80">Redirecionando para a visão da empresa.</div>;

  return (
    <main className="min-h-screen bg-(--page-bg,#f3f6fb) px-3 py-4 text-(--page-text,#0b1a3c) sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-550 flex-col gap-5">
        <Breadcrumb items={[{ label: "Testing Company" }, { label: "Visão geral" }]} />

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22)_0%,transparent_28%),linear-gradient(135deg,#011848_0%,#09275f_48%,#4b0f2f_78%,#ef0001_130%)] px-6 py-6 text-white shadow-[0_34px_90px_rgba(1,24,72,0.22)] sm:px-8 lg:px-9">
          <div className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-white/62">Gestão Testing Company</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Cockpit executivo de qualidade por empresa
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/78 sm:text-base">
                Visão para Líder TC e Suporte Técnico acompanharem carteira, risco, saúde de qualidade, projetos, defeitos e próximos passos consultivos com apoio do Brain.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-white/88">{roleLabel(normalizedRole)}</span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-white/88">{safeUser.email ?? "sem e-mail"}</span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-white/88">Brain conectado ao contexto</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openAssistant("Resuma a visão executiva da Testing Company e priorize as ações por empresa.", { nodeId: "exec-root", role: normalizedRole })}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#011848] transition hover:bg-white/90"
                >
                  <FiMessageCircle className="h-4 w-4" /> Perguntar IA
                </button>
                <Link href="/admin/sistema/mapa?node=exec-root" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/18 bg-white/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/16">
                  <FiCpu className="h-4 w-4" /> Abrir Brain executivo
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ExecutiveMetric label="Saúde média" value={metricsLoading ? "..." : formatPercent(health)} detail="pass rate da carteira" icon={FiTrendingUp} tone={health < 70 ? "danger" : health < 90 ? "warning" : "success"} />
              <ExecutiveMetric label="Empresas críticas" value={formatNumber(consultingStats.criticalCompanies)} detail="ação consultiva imediata" icon={FiAlertCircle} tone="danger" />
              <ExecutiveMetric label="Projetos" value={formatNumber(consultingStats.totalProjects)} detail="operações de qualidade" icon={FiLayers} tone="info" />
              <ExecutiveMetric label="Defeitos abertos" value={formatNumber(consultingStats.openDefects)} detail="risco ativo" icon={FiActivity} tone="warning" />
            </div>
          </div>
        </section>

        {metricsError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {metricsError instanceof Error ? metricsError.message : String(metricsError)}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)">Prioridade consultiva</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Empresas que precisam de atenção</h2>
                <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">Ranking por risco, defeitos, execução e saúde de qualidade.</p>
              </div>
              <button
                type="button"
                onClick={() => openAssistant("Analise o ranking de empresas e gere uma ordem de atendimento para Líder TC e Suporte Técnico.", { nodeId: "exec-companies", criticalCompanies: criticalCompanies.length })}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-xs font-black uppercase tracking-[0.1em] text-(--tc-text,#0b1a3c)"
              >
                <FiMessageCircle /> Analisar carteira
              </button>
            </div>

            {metricsLoading && !metricsData ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-3xl bg-slate-100" />)}
              </div>
            ) : priorityCompanies.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-5 py-10 text-center text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
                Ainda não há dados suficientes de qualidade por empresa. Configure empresas, projetos, casos ou runs para alimentar a visão executiva.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {priorityCompanies.map((company) => <CompanyRiskCard key={company.slug} company={company} />)}
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)">Resumo da carteira</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Distribuição executiva</h2>
            <div className="mt-5 grid gap-3">
              <PortfolioRow icon={FiAlertCircle} label="Críticas" value={criticalCompanies.length} tone="danger" description="Atuação imediata" />
              <PortfolioRow icon={FiActivity} label="Em atenção" value={attentionCompanies.length} tone="warning" description="Monitorar e orientar" />
              <PortfolioRow icon={FiCheckCircle} label="Estáveis" value={stableCompanies.length} tone="success" description="Qualidade controlada" />
              <PortfolioRow icon={FiCompass} label="Sem dados" value={emptyCompanies.length} tone="neutral" description="Onboarding operacional" />
            </div>
            <div className="mt-5 rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <p className="text-sm font-black text-(--tc-text,#0b1a3c)">Como usar essa visão</p>
              <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                Comece pelas empresas críticas, entre no dashboard da empresa, abra projetos e use o Brain para explicar risco, cobertura e próximo passo.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)">Brain e operação</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Nós funcionais para acessar contexto</h2>
              <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">Cada bloco abre uma tela e também tem um nó no Brain para o chat explicar impacto, relação e próximos passos.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actionCards.map((card) => <ExecutiveActionCard key={card.title} card={card} />)}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ProfileHelpCard title="Líder TC" description="Enxerga carteira, prioriza empresas, define ação consultiva, valida governança e acompanha saúde geral." prompts={["Priorize a carteira", "Gere resumo executivo", "Compare empresas críticas"]} />
          <ProfileHelpCard title="Suporte Técnico" description="Atua em risco, bug, bloqueio, triagem, evidência, fluxo e direcionamento por empresa/projeto." prompts={["Explique causa provável", "Sugira próxima ação", "Monte resposta técnica"]} />
          <ProfileHelpCard title="Empresa / Usuário" description="Recebe ajuda contextual dentro da própria empresa/projeto, sem acesso indevido a outras carteiras." prompts={["Explique esta tela", "O que falta no meu projeto?", "Como acompanho meus defeitos?"]} />
        </section>
      </div>
    </main>
  );
}

function ExecutiveMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof FiTarget; tone: "danger" | "warning" | "success" | "info" }) {
  const toneClass = {
    danger: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  }[tone];
  return (
    <div className="rounded-3xl border border-white/14 bg-white/10 p-4 backdrop-blur">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass}`}><Icon /></div>
      <div className="mt-3 text-3xl font-black tracking-[-0.05em]">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/58">{label}</div>
      <div className="mt-1 text-xs text-white/68">{detail}</div>
    </div>
  );
}

function CompanyRiskCard({ company }: { company: CompanyQuality }) {
  const meta = riskMeta(company.risk);
  return (
    <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-(--tc-text,#0b1a3c)">{company.name}</h3>
          <p className="mt-1 text-xs font-semibold text-(--tc-text-muted,#64748b)">/{company.slug} · {meta.note}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${meta.badge}`}>{meta.label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black tracking-[-0.05em] text-(--tc-text,#0b1a3c)">{formatPercent(company.passRate)}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-(--tc-text-muted,#64748b)">saúde</div>
        </div>
        <div className="text-right text-xs font-semibold text-(--tc-text-secondary,#4b5563)">{formatDateTime(company.lastActivityAt)}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${Math.max(company.passRate, company.runs > 0 ? 8 : 0)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Runs" value={company.runs} />
        <MiniStat label="Projetos" value={company.projects} />
        <MiniStat label="Defeitos" value={company.openDefects} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/empresas/${encodeURIComponent(company.slug)}/dashboard`} className="rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white">Dashboard</Link>
        <Link href={`/empresas/${encodeURIComponent(company.slug)}/projetos`} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-(--tc-text,#0b1a3c)">Projetos</Link>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2"><div className="text-lg font-black">{formatNumber(value)}</div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-(--tc-text-muted,#64748b)">{label}</div></div>;
}

function PortfolioRow({ icon: Icon, label, value, description, tone }: { icon: typeof FiTarget; label: string; value: number; description: string; tone: "danger" | "warning" | "success" | "neutral" }) {
  const toneClass = {
    danger: "text-red-600 bg-red-50 border-red-200",
    warning: "text-amber-600 bg-amber-50 border-amber-200",
    success: "text-emerald-600 bg-emerald-50 border-emerald-200",
    neutral: "text-slate-600 bg-slate-50 border-slate-200",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}><Icon /></div>
      <div className="min-w-0 flex-1"><p className="font-black text-(--tc-text,#0b1a3c)">{label}</p><p className="text-xs font-semibold text-(--tc-text-secondary,#4b5563)">{description}</p></div>
      <div className="text-2xl font-black">{formatNumber(value)}</div>
    </div>
  );
}

function ExecutiveActionCard({ card }: { card: ActionCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-(--tc-primary,#011848) shadow-sm"><Icon /></div>
      <h3 className="mt-4 text-lg font-black text-(--tc-text,#0b1a3c)">{card.title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{card.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={card.href} className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white">Abrir <FiArrowRight /></Link>
        <button type="button" onClick={() => openAssistant(card.prompt, { nodeId: card.nodeId, route: card.href })} className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-(--tc-text,#0b1a3c)">Brain</button>
      </div>
    </article>
  );
}

function ProfileHelpCard({ title, description, prompts }: { title: string; description: string; prompts: string[] }) {
  return (
    <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-(--tc-surface-2,#f8fafc) text-(--tc-primary,#011848)"><FiUsers /></div><h3 className="text-lg font-black text-(--tc-text,#0b1a3c)">{title}</h3></div>
      <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => openAssistant(prompt, { profile: title })} className="rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1.5 text-xs font-bold text-(--tc-text,#0b1a3c)">{prompt}</button>
        ))}
      </div>
    </article>
  );
}
