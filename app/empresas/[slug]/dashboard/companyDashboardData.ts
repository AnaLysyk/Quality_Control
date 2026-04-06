import "server-only";

import { readManualReleaseStore } from "@/data/manualData";
import { findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { type AppRecord, listApplications } from "@/lib/applicationsStore";
import { mapCompanyRecord, normalizeProjectCodes } from "@/lib/companyRecord";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { readAlertsStore, type QualityAlert } from "@/lib/qualityAlert";
import { formatRunTitle } from "@/lib/runPresentation";
import { getAllReleases, type ReleaseEntry } from "@/release/data";
import type { Release } from "@/types/release";
import type {
  CompanyRunsHeroStats,
  HomeRunItem,
  HomeStatusBadge,
  RunIntegrationProvider,
  Tone,
} from "../home/homeTypes";

type CompanyProfileRecord = ReturnType<typeof mapCompanyRecord>;

type CompanySignals = {
  companyIdKey: string;
  companySlugKey: string;
  companyNameKey: string;
  projectCodes: Set<string>;
  applicationKeys: Set<string>;
};

export type CompanyDashboardAlert = {
  type: string;
  severity: "critical" | "warning";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type CompanyDefectItem = {
  id: string;
  slug: string;
  title: string;
  href: string;
  runSlug: string | null;
  runName: string | null;
  applicationKey: string;
  applicationName: string;
  projectCode: string | null;
  environments: string[];
  statusRaw: string | null;
  statusLabel: string;
  statusTone: Tone;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CompanyDashboardApplication = Pick<
  AppRecord,
  "id" | "name" | "slug" | "description" | "imageUrl" | "qaseProjectCode" | "source" | "active" | "createdAt" | "updatedAt"
>;

export type CompanyDashboardData = {
  companySlug: string;
  companyName: string;
  companyInitials: string;
  subtitle: string;
  companyStatus: HomeStatusBadge;
  integrationStatus: HomeStatusBadge;
  heroStats: CompanyRunsHeroStats;
  runs: HomeRunItem[];
  defects: CompanyDefectItem[];
  alerts: CompanyDashboardAlert[];
  applications: CompanyDashboardApplication[];
  projectCodes: string[];
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

function resolveDefectStatusMeta(value?: string | null): { label: string; tone: Tone } {
  const normalized = normalizeDefectStatus(value);
  if (normalized === "done") return { label: "Resolvido", tone: "positive" };
  if (normalized === "in_progress") return { label: "Em analise", tone: "warning" };
  if (normalized === "open") return { label: "Aberto", tone: "warning" };
  return { label: "Em analise", tone: "neutral" };
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

function buildSignals(company: CompanyProfileRecord, applications: CompanyDashboardApplication[]): CompanySignals {
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

function manualReleaseMatchesCompany(release: Release, signals: CompanySignals) {
  const clientSlugKey = normalizeKey(release.clientSlug);
  if (clientSlugKey) return clientSlugKey === signals.companySlugKey;

  const appKey = normalizeKey(release.app);
  const qaseKey = normalizeKey(release.qaseProject);
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
    environments: Array.isArray(run.environments) ? run.environments.filter(Boolean) : [],
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
    responsibleLabel: run.assignedToName ?? run.createdByName ?? null,
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
    environments: Array.isArray(release.environments) ? release.environments.filter(Boolean) : [],
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

function buildDefectItem(defect: Release, companySlug: string): CompanyDefectItem {
  const applicationName = String(defect.app ?? defect.qaseProject ?? defect.runName ?? "Aplicacao").trim() || "Aplicacao";
  const status = resolveDefectStatusMeta(defect.status ?? null);
  return {
    id: defect.id || defect.slug,
    slug: defect.slug,
    title: formatRunTitle(defect.name || defect.slug, "Defeito"),
    href: defect.runSlug
      ? `/empresas/${encodeURIComponent(companySlug)}/defeitos?run=${encodeURIComponent(defect.runSlug)}`
      : `/empresas/${encodeURIComponent(companySlug)}/defeitos`,
    runSlug: defect.runSlug ?? null,
    runName: defect.runName ?? null,
    applicationKey: normalizeKey(defect.app ?? defect.qaseProject ?? applicationName),
    applicationName,
    projectCode: normalizeProjectCode(defect.qaseProject ?? defect.app),
    environments: Array.isArray(defect.environments) ? defect.environments.filter(Boolean) : [],
    statusRaw: defect.status ?? null,
    statusLabel: status.label,
    statusTone: status.tone,
    createdAt: toIso(defect.createdAt),
    updatedAt: toIso(defect.updatedAt),
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

function mapAlerts(alerts: QualityAlert[]): CompanyDashboardAlert[] {
  return alerts.map((alert) => ({
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    timestamp: alert.timestamp,
    metadata: alert.metadata,
  }));
}

export async function loadCompanyDashboardData(slug: string): Promise<CompanyDashboardData | null> {
  const companyRecord = await findLocalCompanyBySlug(slug);
  if (!companyRecord) return null;

  const company = mapCompanyRecord(companyRecord);
  const [manualReleases, integratedReleases, applicationsRaw, alertsRaw] = await Promise.all([
    readManualReleaseStore(),
    getAllReleases(),
    listApplications({ companySlug: company.slug ?? slug }),
    readAlertsStore(),
  ]);

  const applications = applicationsRaw.map((app) => ({
    id: app.id,
    name: app.name,
    slug: app.slug,
    description: app.description ?? null,
    imageUrl: app.imageUrl ?? null,
    qaseProjectCode: app.qaseProjectCode ?? null,
    source: app.source ?? null,
    active: app.active,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  }));

  const signals = buildSignals(company, applications);

  const runsManual = manualReleases
    .filter((release) => resolveManualReleaseKind(release) === "run")
    .filter((release) => manualReleaseMatchesCompany(release, signals))
    .map((release) => buildManualRunItem(release, company.slug ?? slug));

  const runsIntegrated = integratedReleases
    .filter((release) => integratedRunMatchesCompany(release, signals))
    .map((release) => buildIntegratedRunItem(release, company.slug ?? slug));

  const runs = [...runsManual, ...runsIntegrated].sort((left, right) => {
    const leftTime = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    const rightTime = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    return rightTime - leftTime;
  });

  const defects = manualReleases
    .filter((release) => resolveManualReleaseKind(release) === "defect")
    .filter((release) => manualReleaseMatchesCompany(release, signals))
    .map((release) => buildDefectItem(release, company.slug ?? slug))
    .sort((left, right) => Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt)) - Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt)));

  const alerts = mapAlerts(
    alertsRaw
      .filter((alert) => normalizeKey(alert.companySlug) === signals.companySlugKey)
      .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp)),
  );

  const heroStats: CompanyRunsHeroStats = {
    total: runs.length,
    inProgress: runs.filter((run) => !run.isCompleted).length,
    completed: runs.filter((run) => run.isCompleted).length,
    manual: runs.filter((run) => run.sourceType === "manual").length,
    integration: runs.filter((run) => run.sourceType === "integration").length,
    latestExecutionAt: runs[0]?.updatedAt ?? runs[0]?.createdAt ?? null,
    alerts: alerts.length,
    openDefects: defects.filter((defect) => normalizeDefectStatus(defect.statusRaw) !== "done").length,
    applications: Math.max(applications.length, signals.projectCodes.size),
  };

  const companyStatus = resolveCompanyStatus(company);
  const integrationStatus = resolveIntegrationStatus(company);

  return {
    companySlug: company.slug ?? slug,
    companyName: company.company_name || company.name || slug,
    companyInitials: companyInitials(company.company_name || company.name || slug),
    subtitle: buildSubtitle(companyStatus, integrationStatus, heroStats),
    companyStatus,
    integrationStatus,
    heroStats,
    runs,
    defects,
    alerts,
    applications,
    projectCodes: Array.from(signals.projectCodes),
  };
}
