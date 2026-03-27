import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBriefcase,
  FiClipboard,
  FiGrid,
  FiShield,
} from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
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

function companyInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return "EM";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "EM";
}

function badgeClasses(tone: Tone) {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
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
    detail: "Contexto institucional liberado para operacao.",
    tone: "positive",
  };
}

function resolveIntegrationStatus(company: ReturnType<typeof mapCompanyRecord>): StatusBadge {
  if (company.qase_is_active === true && company.qase_is_valid === true) {
    return {
      title: "Qase ativa",
      detail: `${company.qase_project_codes?.length ?? 0} projeto(s) disponiveis para sincronizacao.`,
      tone: "positive",
    };
  }
  if (company.jira_is_active === true && company.jira_is_valid === true) {
    return {
      title: "Jira ativa",
      detail: "Integracao pronta para sincronizacao institucional.",
      tone: "positive",
    };
  }
  if ((company.qase_project_codes?.length ?? 0) > 0 || company.has_qase_token || company.has_jira_api_token) {
    return {
      title: "Integracao pendente",
      detail: "Existe configuracao salva, mas ela ainda nao esta ativa.",
      tone: "warning",
    };
  }
  return {
    title: "Sem integracao",
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
      detail: "Painel operacional de runs, riscos e leitura de execucao.",
      href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/dashboard`,
      icon: FiGrid,
      note: `${totalRuns} runs no contexto`,
    },
    {
      title: "Runs",
      detail: "Lista completa das runs manuais da empresa.",
      href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/runs`,
      icon: FiActivity,
      note: `${manualRuns.length} manual(is)`,
    },
    {
      title: "Defeitos",
      detail: "Triagem de defeitos abertos e contexto de risco.",
      href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/defeitos`,
      icon: FiAlertTriangle,
      note: `${openDefects} aberto(s)`,
    },
    {
      title: "Aplicacoes",
      detail: "Catalogo das aplicacoes e projetos vinculados a empresa.",
      href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/aplicacoes`,
      icon: FiBriefcase,
      note: `${applications.length} aplicacao(oes)`,
    },
    {
      title: "Planos de teste",
      detail: "Planos vinculados as aplicacoes integradas e campanhas da empresa.",
      href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/planos-de-teste`,
      icon: FiClipboard,
      note: `${applications.filter((app) => Boolean(app.qaseProjectCode)).length} com Qase`,
    },
    {
      title: "Perfil da empresa",
      detail: "Cadastro institucional, logo, integracoes e usuarios.",
      href: "/settings/profile",
      icon: FiShield,
      note: "Configuracoes da empresa",
    },
  ];

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-5 lg:px-6 xl:px-8 2xl:px-10">
      <div className="flex w-full max-w-none flex-col gap-6">
        <Breadcrumb
          items={[
            { label: "Home", href: `/empresas/${encodeURIComponent(company.slug ?? slug)}/home` },
            { label: company.company_name || company.name || slug },
          ]}
        />

        <section className="overflow-hidden rounded-[34px] border border-(--tc-border,#dfe5f1) bg-[linear-gradient(135deg,#011848_0%,#0a2f7a_52%,#ef0001_100%)] p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.16)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-white/20 bg-white/10 text-3xl font-extrabold tracking-[0.2em] text-white">
                {companyInitials(company.company_name || company.name || slug)}
              </div>
              <div className="max-w-3xl">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                    Home da empresa
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(companyStatus.tone)}`}>
                    {companyStatus.title}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(integrationStatus.tone)}`}>
                    {integrationStatus.title}
                  </span>
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white [font-family:var(--font-poppins),Poppins,sans-serif] sm:text-5xl">
                  {company.company_name || company.name || slug}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/82 sm:text-base">
                  Entrada institucional da empresa. Aqui fica o contexto principal, os atalhos e o estado geral do cadastro.
                  O dashboard operacional de runs continua separado.
                </p>
                <p className="mt-3 text-sm font-semibold text-white/90">
                  Slug: {company.slug ?? slug} | Ultima movimentacao: {formatDate(latestExecutionAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
              <Link
                href={`/empresas/${encodeURIComponent(company.slug ?? slug)}/dashboard`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-(--tc-text,#0b1a3c) shadow-sm transition hover:bg-slate-100"
              >
                Abrir dashboard
                <FiArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/settings/profile"
                className="inline-flex items-center justify-center rounded-full border border-white/24 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Ver perfil
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-white/20 bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/68">Dashboard</p>
              <div className="mt-3 text-3xl font-extrabold text-white">Operacional</div>
              <p className="mt-2 text-sm text-white/78">Painel de runs e sinais de risco separado desta home.</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/68">Runs no contexto</p>
              <div className="mt-3 text-3xl font-extrabold text-white">{totalRuns}</div>
              <p className="mt-2 text-sm text-white/78">{manualRuns.length} manuais e {integratedRuns.length} integradas.</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/68">Aplicacoes</p>
              <div className="mt-3 text-3xl font-extrabold text-white">{applications.length}</div>
              <p className="mt-2 text-sm text-white/78">{projectCodes.size} projeto(s) vinculados na integracao/cadastro.</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/12 p-4 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/68">Defeitos abertos</p>
              <div className="mt-3 text-3xl font-extrabold text-white">{openDefects}</div>
              <p className="mt-2 text-sm text-white/78">Indicador rapido para leitura institucional da empresa.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Acesso rapido</p>
            <h2 className="text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Home e dashboard agora tem papeis diferentes</h2>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">
              Use esta home como entrada da empresa. Use o dashboard para operar runs, risco e leitura de execucao.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-primary,#0b1a3c)">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
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
          <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Contexto salvo</p>
            <h2 className="mt-2 text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Projetos e aplicacoes da empresa</h2>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              Bloco institucional da home. Aqui ficam os vinculos salvos que contextualizam a empresa, sem misturar com o painel operacional.
            </p>

            <div className="mt-5 rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Projetos vinculados</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from(projectCodes).length > 0 ? (
                  Array.from(projectCodes).map((code) => (
                    <span key={code} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-(--tc-text-secondary,#4b5563)">Nenhum projeto salvo ainda.</span>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Aplicacoes cadastradas</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {applications.length > 0 ? (
                  applications.slice(0, 6).map((app) => (
                    <div key={app.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-sm font-semibold text-(--tc-text,#0b1a3c)">{app.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                        {app.qaseProjectCode ?? app.slug}
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-(--tc-text-secondary,#4b5563)">Nenhuma aplicacao cadastrada ainda.</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-accent,#ef0001)">Leitura rapida</p>
            <h2 className="mt-2 text-2xl font-extrabold text-(--tc-text,#0b1a3c)">Estado atual da empresa</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Empresa</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{companyStatus.title}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{companyStatus.detail}</div>
              </div>
              <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Integracao</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{integrationStatus.title}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{integrationStatus.detail}</div>
              </div>
              <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Proximo passo recomendado</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">
                  {totalRuns > 0 ? "Abrir dashboard" : "Configurar primeira operacao"}
                </div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                  {totalRuns > 0
                    ? "Use o dashboard para ler runs, risco e contexto operacional sem misturar com a home."
                    : "Comece por perfil, integracoes ou criacao da primeira run manual."}
                </div>
              </div>
              <div className="rounded-[24px] border border-(--tc-border,#e5e7eb) bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Ultima execucao</div>
                <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{formatDate(latestExecutionAt)}</div>
                <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                  Referencia rapida da operacao, sem transformar a home em dashboard.
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
                A home volta a ser entrada de contexto e navegacao. O dashboard permanece como painel operacional de runs.
              </p>
            </div>
            <Link
              href={`/empresas/${encodeURIComponent(company.slug ?? slug)}/dashboard`}
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
