import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { TechnicalSupportHomeGuard } from "./TechnicalSupportHomeGuard";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBriefcase,
  FiClipboard,
  FiGrid,
  FiShield,
} from "react-icons/fi";
import { readManualReleaseStore } from "@/data/manualData";
import { findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { listApplications } from "@/lib/applicationsStore";
import { mapCompanyRecord, normalizeProjectCodes } from "@/lib/companyRecord";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { getAllReleases } from "@/release/data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type Tone = "positive" | "warning" | "critical" | "neutral";

type StatusBadge = {
  title: string;
  detail: string;
  tone: Tone;
};

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function toTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value: unknown) {
  const time = toTimestamp(value);
  if (!time) return "Sem data recente";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function resolveCompanyStatus(company: ReturnType<typeof mapCompanyRecord>): StatusBadge {
  const normalized = (company.status ?? "").trim().toLowerCase();
  if (company.active === false || normalized === "inactive" || normalized === "archived") {
    return {
      title: "Empresa inativa",
      detail: "Cadastro institucional marcado como inativo.",
      tone: "critical",
    };
  }

  return {
    title: "Empresa ativa",
    detail: "Contexto institucional liberado para operação.",
    tone: "positive",
  };
}

function resolveIntegrationStatus(company: ReturnType<typeof mapCompanyRecord>): StatusBadge {
  if (company.qase_is_active === true && company.qase_is_valid === true) {
    return {
      title: "Qase ativa",
      detail: `${company.qase_project_codes?.length ?? 0} projeto(s) disponíveis para sincronizacao.`,
      tone: "positive",
    };
  }
  if (company.jira_is_active === true && company.jira_is_valid === true) {
    return {
      title: "Jira ativa",
      detail: "Integração pronta para sincronizacao institucional.",
      tone: "positive",
    };
  }
  if ((company.qase_project_codes?.length ?? 0) > 0 || company.has_qase_token || company.has_jira_api_token) {
    return {
      title: "Integração pendente",
      detail: "Existe configuração salva, mas ela ainda não esta ativa.",
      tone: "warning",
    };
  }
  return {
    title: "Sem integração",
    detail: "A empresa segue apenas com contexto manual neste momento.",
    tone: "neutral",
  };
}

export default async function CompanyHomePage({ params }: PageProps) {
  const { slug } = await params;
  const companyRecord = await findLocalCompanyBySlug(slug);

  if (!companyRecord) {
    notFound();
  }

  const company = mapCompanyRecord(companyRecord);
  const [applications, manualReleases, integratedReleases] = await Promise.all([
    listApplications({ companySlug: company.slug ?? slug }),
    readManualReleaseStore(),
    getAllReleases(),
  ]);

  const projectCodes = new Set<string>(normalizeProjectCodes(company.qase_project_codes) ?? []);
  for (const app of applications) {
    const code = normalizeProjectCode(app.qaseProjectCode);
    if (code) projectCodes.add(code);
  }

  const companySlugKey = normalizeKey(company.slug ?? slug);
  const companyIdKey = normalizeKey(company.id);
  const companyNameKey = normalizeKey(company.company_name || company.name || slug);
  const applicationKeys = new Set<string>(
    [
      company.slug,
      company.id,
      company.name,
      company.company_name,
      ...Array.from(projectCodes),
      ...applications.flatMap((app) => [app.slug, app.name, app.qaseProjectCode]),
    ]
      .map((value) => normalizeKey(value))
      .filter(Boolean),
  );

  const manualRuns = manualReleases.filter((release) => {
    if (resolveManualReleaseKind(release) !== "run") return false;
    const clientSlugKey = normalizeKey(release.clientSlug);
    if (clientSlugKey) return clientSlugKey === companySlugKey;
    return applicationKeys.has(normalizeKey(release.app)) || applicationKeys.has(normalizeKey(release.qaseProject));
  });

  const integratedRuns = integratedReleases.filter((release) => {
    const clientIdKey = normalizeKey(release.clientId);
    if (clientIdKey && (clientIdKey === companyIdKey || clientIdKey === companySlugKey)) return true;
    if (normalizeKey(release.clientName) === companyNameKey) return true;
    const qaseProject = normalizeProjectCode(release.qaseProject);
    if (qaseProject && projectCodes.has(qaseProject)) return true;
    if (applicationKeys.has(normalizeKey(release.app)) || applicationKeys.has(normalizeKey(release.project))) return true;
    return false;
  });

  const openDefects = manualReleases.filter((release) => {
    if (resolveManualReleaseKind(release) !== "defect") return false;
    if (normalizeKey(release.clientSlug) !== companySlugKey) return false;
    return normalizeDefectStatus(release.status) !== "done";
  }).length;

  const latestExecutionAt = [
    ...manualRuns.map((run) => run.updatedAt ?? run.createdAt),
    ...integratedRuns.map((run) => run.createdAt ?? run.created_at),
  ]
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

  const companyStatus = resolveCompanyStatus(company);
  const integrationStatus = resolveIntegrationStatus(company);
  const totalRuns = manualRuns.length + integratedRuns.length;

  const quickLinks = [
    {
      title: "Dashboard",
      detail: "Visão estrategica da qualidade, tendencia, regressao e risco da empresa.",
      href: "dashboard",
      icon: FiGrid,
      note: "Leitura executiva",
    },
    {
      title: "Métricas",
      detail: "Painel operacional por run, origem, status e leitura detalhada da execução.",
      href: "metrics",
      icon: FiActivity,
      note: `${totalRuns} runs no contexto`,
    },
    {
      title: "Runs",
      detail: "Lista completa das runs manuais da empresa.",
      href: "runs",
      icon: FiActivity,
      note: `${manualRuns.length} manual(is)`,
    },
    {
      title: "Defeitos",
      detail: "Triagem de defeitos abertos e contexto de risco.",
      href: "defeitos",
      icon: FiAlertTriangle,
      note: `${openDefects} aberto(s)`,
    },
    {
      title: "Aplicações",
      detail: "Catalogo das aplicações e projetos vinculados a empresa.",
      href: "aplicacoes",
      icon: FiBriefcase,
      note: `${applications.length} aplicação(oes)`,
    },
    {
      title: "Planos de teste",
      detail: "Planos vinculados as aplicações integradas e campanhas da empresa.",
      href: "planos-de-teste",
      icon: FiClipboard,
      note: `${applications.filter((app) => Boolean(app.qaseProjectCode)).length} com Qase`,
    },
    {
      title: "Perfil da empresa",
      detail: "Cadastro institucional, logo, integrações e usuários.",
      href: "/settings/profile",
      icon: FiShield,
      note: "Configurações da empresa",
    },
  ];

  return (
    <div className="relative isolate min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-5 lg:px-6 xl:px-8 2xl:px-10">
      <TechnicalSupportHomeGuard />
      <div className="relative z-10 flex w-full max-w-none flex-col gap-6">
        <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-6 shadow-sm sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group rounded-3xl border border-(--tc-border,#e5e7eb) p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] ${styles.elevatedSurface}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-primary,#0b1a3c)">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-alt,#f8fafc) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-secondary,#475569)">
                    {item.note}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{item.detail}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-(--tc-accent,#ef0001)">
                  Abrir
                  <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-6 shadow-sm sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Contexto salvo</p>
            <h2 className="mt-2 text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Projetos e aplicações da empresa</h2>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              Bloco institucional da home. Aqui ficam os vínculos salvos que contextualizam a empresa, sem misturar com o painel operacional.
            </p>

            <div className={`mt-5 rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.subtleSurface}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Projetos vinculados</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from(projectCodes).length > 0 ? (
                  Array.from(projectCodes).map((code) => (
                    <span key={code} className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-primary,#334155)">
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-(--tc-text-secondary,#4b5563)">Nenhum projeto salvo ainda.</span>
                )}
              </div>
            </div>

            <div className={`mt-4 rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.subtleSurface}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Aplicações cadastradas</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {applications.length > 0 ? (
                  applications.map((app) => (
                    <div key={app.id} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-4 py-3">
                      <div className="text-sm font-semibold text-(--tc-text,#0b1a3c)">{app.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                        {app.qaseProjectCode ?? app.slug}
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-(--tc-text-secondary,#4b5563)">Nenhuma aplicação cadastrada ainda.</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-6 shadow-sm sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Leitura rápida</p>
            <h2 className="mt-2 text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Estado atual da empresa</h2>
            <div className="mt-5 grid gap-4">
              <div className={`rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.elevatedSurface}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Empresa</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{companyStatus.title}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{companyStatus.detail}</div>
              </div>
              <div className={`rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.elevatedSurface}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Integração</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{integrationStatus.title}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{integrationStatus.detail}</div>
              </div>
              <div className={`rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.elevatedSurface}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Proximo passo recomendado</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">
                  {totalRuns > 0 ? "Abrir dashboard inteligente" : "Configurar primeira operação"}
                </div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                  {totalRuns > 0
                    ? "Use o dashboard para leitura estrategica e as métricas para o acompanhamento operacional das runs."
                    : "Comece por perfil, integrações ou criação da primeira run manual."}
                </div>
              </div>
              <div className={`rounded-3xl border border-(--tc-border,#e5e7eb) p-5 ${styles.elevatedSurface}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Última execução</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{formatDate(latestExecutionAt)}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                  Referencia rápida da operação, sem transformar a home em dashboard.
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Fechamento da home</p>
              <h2 className="mt-2 text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Home institucional separada do dashboard</h2>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                A home volta a ser entrada de contexto e navegacao. O dashboard fica estrategico e a area de métricas concentra a leitura operacional.
              </p>
            </div>
            <Link
              href="dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--tc-primary,#0b1a3c) px-5 py-3 text-sm font-semibold text-white"
            >
              Ir para dashboard
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
