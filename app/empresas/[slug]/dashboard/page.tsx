import { notFound } from "next/navigation";
import { readManualReleaseStore } from "@/data/manualData";
import { findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { listApplications } from "@/lib/applicationsStore";
import { mapCompanyRecord, normalizeProjectCodes } from "@/lib/companyRecord";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { readAlertsStore } from "@/lib/qualityAlert";
import { formatRunTitle } from "@/lib/runPresentation";
import { getAllReleases, type ReleaseEntry } from "@/release/data";
import type { Release } from "@/types/release";
import CompanyRunsHomeClient from "../home/CompanyRunsHomeClient";
import type {
  CompanyRunsHeroStats,
  HomeRunItem,
  HomeStatusBadge,
  RunIntegrationProvider,
  Tone,
} from "../home/homeTypes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CompanyProfileRecord = ReturnType<typeof mapCompanyRecord>;

type CompanySignals = {
  companyIdKey: string;
  companySlugKey: string;
  companyNameKey: string;
  projectCodes: Set<string>;
  applicationKeys: Set<string>;
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

function toIso(value: unknown) {
  const time = toTimestamp(value);
  return time ? new Date(time).toISOString() : null;
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

function resolveRunStatusMeta(
  value?: string | null,
  options?: { closedAt?: string | null },
): { label: string; tone: Tone; isCompleted: boolean } {
  const normalized = (value ?? "").trim().toLowerCase();

  if (options?.closedAt || normalized === "done" || normalized === "closed" || normalized === "finalized" || normalized === "finalizada") {
    return { label: "Concluida", tone: "positive", isCompleted: true };
  }
  if (
    normalized === "failed" ||
    normalized === "fail" ||
    normalized === "falha" ||
    normalized === "error" ||
    normalized === "erro" ||
    normalized === "violated"
  ) {
    return { label: "Em risco", tone: "critical", isCompleted: false };
  }
  if (normalized === "blocked" || normalized === "bloqueada") {
    return { label: "Bloqueada", tone: "warning", isCompleted: false };
  }
  if (
    normalized === "active" ||
    normalized === "open" ||
    normalized === "aberta" ||
    normalized === "in_progress" ||
    normalized === "em_andamento" ||
    normalized === "running"
  ) {
    return { label: "Em andamento", tone: "warning", isCompleted: false };
  }
  if (normalized === "draft" || normalized === "saved" || normalized === "pending" || normalized === "pendente") {
    return { label: "Pendente", tone: "neutral", isCompleted: false };
  }
  if (!normalized) {
    return { label: "Sem status", tone: "neutral", isCompleted: false };
  }
  return {
    label: value?.trim() || "Sem status",
    tone: "neutral",
    isCompleted: false,
  };
}

function resolveCompanyStatus(company: CompanyProfileRecord): HomeStatusBadge {
  const normalized = (company.status ?? "").trim().toLowerCase();
  if (company.active === false || normalized === "inactive" || normalized === "archived") {
    return {
      title: "Empresa inativa",
      detail: "A empresa esta marcada como inativa no cadastro atual.",
      tone: "critical",
    };
  }

  return {
    title: "Empresa ativa",
    detail: "Contexto ativo e pronto para leitura operacional das runs.",
    tone: "positive",
  };
}

function resolveIntegrationStatus(company: CompanyProfileRecord): HomeStatusBadge {
  if (company.qase_is_active === true && company.qase_is_valid === true) {
    return {
      title: "Qase ativa",
      detail: "Runs integradas podem aparecer junto das execucoes manuais neste painel.",
      tone: "positive",
    };
  }
  if (company.jira_is_active === true && company.jira_is_valid === true) {
    return {
      title: "Jira ativa",
      detail: "A empresa possui integracao Jira ativa e pronta para sincronizacao.",
      tone: "positive",
    };
  }
  if ((company.has_qase_token && (company.qase_project_codes?.length ?? 0) > 0) || company.qase_validation_status === "saved") {
    return {
      title: "Qase pendente",
      detail: "Existe configuracao salva, mas ela ainda nao esta ativa para uso operacional.",
      tone: "warning",
    };
  }
  if (company.has_jira_api_token || company.jira_validation_status === "saved") {
    return {
      title: "Jira pendente",
      detail: "Existe configuracao Jira salva, mas ela ainda nao esta ativa.",
      tone: "warning",
    };
  }

  return {
    title: "Sem integracao",
    detail: "A empresa ainda depende apenas de runs manuais neste contexto.",
    tone: "neutral",
  };
}

function computeStats(stats?: Partial<Release["stats"]> | null) {
  const pass = Math.max(0, Number(stats?.pass ?? 0));
  const fail = Math.max(0, Number(stats?.fail ?? 0));
  const blocked = Math.max(0, Number(stats?.blocked ?? 0));
  const notRun = Math.max(0, Number(stats?.notRun ?? 0));
  const total = pass + fail + blocked + notRun;
  const passRate = total > 0 ? Math.round((pass / total) * 100) : null;

  return { pass, fail, blocked, notRun, total, passRate };
}

function extractReleaseStats(release: ReleaseEntry) {
  return computeStats({
    pass: release.manualSummary?.pass ?? release.metrics?.pass,
    fail: release.manualSummary?.fail ?? release.metrics?.fail,
    blocked: release.manualSummary?.blocked ?? release.metrics?.blocked,
    notRun: release.manualSummary?.notRun ?? release.metrics?.notRun ?? release.metrics?.not_run,
  });
}

function inferIntegrationProvider(release: ReleaseEntry): RunIntegrationProvider {
  const joined = [
    release.source,
    release.summary,
    release.title,
    release.qaseProject,
    release.app,
    release.project,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (joined.includes("jira")) return "jira";
  if (joined.includes("qase") || Boolean(release.qaseProject)) return "qase";
  return null;
}

function buildSignals(company: CompanyProfileRecord, applications: Awaited<ReturnType<typeof listApplications>>): CompanySignals {
  const projectCodes = new Set<string>();
  for (const code of normalizeProjectCodes(company.qase_project_codes) ?? []) {
    projectCodes.add(code);
  }
  for (const app of applications) {
    const code = normalizeProjectCode(app.qaseProjectCode);
    if (code) projectCodes.add(code);
  }

  const applicationKeys = new Set<string>();
  const seeds = [
    company.id,
    company.slug,
    company.name,
    company.company_name,
    ...Array.from(projectCodes),
    ...applications.flatMap((app) => [app.slug, app.name, app.qaseProjectCode]),
  ];
  for (const seed of seeds) {
    const normalized = normalizeKey(seed);
    if (normalized) applicationKeys.add(normalized);
  }

  return {
    companyIdKey: normalizeKey(company.id),
    companySlugKey: normalizeKey(company.slug),
    companyNameKey: normalizeKey(company.name || company.company_name || company.slug || ""),
    projectCodes,
    applicationKeys,
  };
}

function manualRunMatchesCompany(run: Release, signals: CompanySignals) {
  const clientSlugKey = normalizeKey(run.clientSlug);
  if (clientSlugKey) return clientSlugKey === signals.companySlugKey;

  const appKey = normalizeKey(run.app);
  const qaseKey = normalizeKey(run.qaseProject);
  return signals.applicationKeys.has(appKey) || signals.applicationKeys.has(qaseKey);
}

function integratedRunMatchesCompany(release: ReleaseEntry, signals: CompanySignals) {
  const clientIdKey = normalizeKey(release.clientId);
  if (clientIdKey && (clientIdKey === signals.companyIdKey || clientIdKey === signals.companySlugKey)) {
    return true;
  }

  const clientNameKey = normalizeKey(release.clientName);
  if (clientNameKey && clientNameKey === signals.companyNameKey) {
    return true;
  }

  const qaseProject = normalizeProjectCode(release.qaseProject);
  if (qaseProject && signals.projectCodes.has(qaseProject)) {
    return true;
  }

  const appKey = normalizeKey(release.app);
  if (appKey && signals.applicationKeys.has(appKey)) {
    return true;
  }

  const projectKey = normalizeKey(release.project);
  if (projectKey && signals.applicationKeys.has(projectKey)) {
    return true;
  }

  const summaryKey = normalizeKey(release.summary);
  if (summaryKey && (summaryKey.includes(signals.companySlugKey) || summaryKey.includes(signals.companyNameKey))) {
    return true;
  }

  return false;
}

function buildManualRunItem(run: Release, companySlug: string): HomeRunItem {
  const status = resolveRunStatusMeta(run.status, { closedAt: run.closedAt ?? null });
  const stats = computeStats(run.stats);
  const applicationName = String(run.app ?? run.qaseProject ?? "Aplicacao manual").trim() || "Aplicacao manual";
  const createdAt = toIso(run.createdAt);
  const updatedAt = toIso(run.updatedAt) ?? createdAt;

  return {
    id: run.id || run.slug,
    slug: run.slug,
    title: formatRunTitle(run.name || run.slug, "Run manual"),
    href: `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(run.slug)}`,
    applicationKey: normalizeKey(run.app ?? run.qaseProject ?? applicationName),
    applicationName,
    projectCode: normalizeProjectCode(run.qaseProject ?? run.app),
    sourceType: "manual",
    integrationProvider: null,
    statusRaw: run.status ?? null,
    statusLabel: status.label,
    statusTone: status.tone,
    isCompleted: status.isCompleted,
    createdAt,
    updatedAt,
    summary:
      typeof run.observations === "string" && run.observations.trim()
        ? run.observations.trim()
        : `${stats.pass} aprovados, ${stats.fail} falhas, ${stats.blocked} bloqueados e ${stats.notRun} nao executados.`,
    stats,
    releaseLabel: "Run manual",
    responsibleLabel: null,
  };
}

function buildIntegratedRunItem(release: ReleaseEntry, companySlug: string): HomeRunItem {
  const status = resolveRunStatusMeta(release.status ?? null);
  const stats = extractReleaseStats(release);
  const applicationName =
    String(release.app ?? release.project ?? release.qaseProject ?? "Integracao").trim() || "Integracao";
  const createdAt = toIso(release.createdAt ?? release.created_at);
  const provider = inferIntegrationProvider(release);
  const responsibleLabel = Array.isArray(release.assigneeNames)
    ? release.assigneeNames.filter(Boolean).join(", ") || null
    : Array.isArray(release.assignees)
      ? release.assignees.filter(Boolean).join(", ") || null
      : null;

  return {
    id: release.slug,
    slug: release.slug,
    title: formatRunTitle(release.title || release.slug, "Run integrada"),
    href: `/empresas/${encodeURIComponent(companySlug)}/runs/${encodeURIComponent(release.slug)}`,
    applicationKey: normalizeKey(release.app ?? release.project ?? release.qaseProject ?? applicationName),
    applicationName,
    projectCode: normalizeProjectCode(release.qaseProject ?? release.project ?? release.app),
    sourceType: "integration",
    integrationProvider: provider,
    statusRaw: release.status ?? null,
    statusLabel: status.label,
    statusTone: status.tone,
    isCompleted: status.isCompleted,
    createdAt,
    updatedAt: createdAt,
    summary:
      typeof release.summary === "string" && release.summary.trim()
        ? release.summary.trim()
        : stats.total > 0
          ? `${stats.total} casos consolidados nesta sincronizacao integrada.`
          : "Run integrada sincronizada sem telemetria detalhada no momento.",
    stats,
    releaseLabel: release.title?.trim() || null,
    responsibleLabel,
  };
}

function buildSubtitle(
  companyStatus: HomeStatusBadge,
  integrationStatus: HomeStatusBadge,
  heroStats: CompanyRunsHeroStats,
) {
  if (heroStats.total === 0) {
    return `${companyStatus.detail} ${integrationStatus.detail}`;
  }

  return `${companyStatus.detail} ${integrationStatus.detail} ${heroStats.inProgress} em andamento, ${heroStats.completed} concluidas e ${heroStats.openDefects} defeitos abertos no contexto atual.`;
}

export default async function CompanyDashboardPage({ params }: PageProps) {
  const { slug } = await params;
  const companyRecord = await findLocalCompanyBySlug(slug);

  if (!companyRecord) {
    notFound();
  }

  const company = mapCompanyRecord(companyRecord);

  const [manualReleases, integratedReleases, applications, alerts] = await Promise.all([
    readManualReleaseStore(),
    getAllReleases(),
    listApplications({ companySlug: company.slug ?? slug }),
    readAlertsStore(),
  ]);

  const signals = buildSignals(company, applications);

  const manualRuns = manualReleases
    .filter((release) => resolveManualReleaseKind(release) === "run")
    .filter((release) => manualRunMatchesCompany(release, signals))
    .map((release) => buildManualRunItem(release, company.slug ?? slug));

  const integratedRuns = integratedReleases
    .filter((release) => integratedRunMatchesCompany(release, signals))
    .map((release) => buildIntegratedRunItem(release, company.slug ?? slug));

  const runs = [...manualRuns, ...integratedRuns].sort((left, right) => {
    const leftTime = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    const rightTime = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    return rightTime - leftTime;
  });

  const openDefects = manualReleases.filter((release) => {
    if (resolveManualReleaseKind(release) !== "defect") return false;
    if (!manualRunMatchesCompany(release, signals)) return false;
    return normalizeDefectStatus(release.status) !== "done";
  }).length;

  const recentAlerts = alerts
    .filter((alert) => normalizeKey(alert.companySlug) === signals.companySlugKey)
    .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp))
    .slice(0, 6);

  const heroStats: CompanyRunsHeroStats = {
    total: runs.length,
    inProgress: runs.filter((run) => !run.isCompleted).length,
    completed: runs.filter((run) => run.isCompleted).length,
    manual: runs.filter((run) => run.sourceType === "manual").length,
    integration: runs.filter((run) => run.sourceType === "integration").length,
    latestExecutionAt: runs[0]?.updatedAt ?? runs[0]?.createdAt ?? null,
    alerts: recentAlerts.length,
    openDefects,
    applications: Math.max(applications.length, signals.projectCodes.size),
  };

  const companyStatus = resolveCompanyStatus(company);
  const integrationStatus = resolveIntegrationStatus(company);
  const subtitle = buildSubtitle(companyStatus, integrationStatus, heroStats);

  return (
    <CompanyRunsHomeClient
      companySlug={company.slug ?? slug}
      companyName={company.company_name || company.name || slug}
      companyInitials={companyInitials(company.company_name || company.name || slug)}
      subtitle={subtitle}
      companyStatus={companyStatus}
      integrationStatus={integrationStatus}
      heroStats={heroStats}
      runs={runs}
    />
  );
}
