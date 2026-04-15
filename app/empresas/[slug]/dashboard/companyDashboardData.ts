import "server-only";

import { readManualReleaseStore } from "@/data/manualData";
import { findLocalCompanyBySlug, listLocalLinksForCompany, listLocalUsers } from "@/lib/auth/localStore";
import { resolveLocalUserDisplayName } from "@/lib/manualReleaseResponsible";
import { type AppRecord, listApplications } from "@/lib/applicationsStore";
import { mapCompanyRecord, normalizeProjectCodes } from "@/lib/companyRecord";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { readAlertsStore, type QualityAlert } from "@/lib/qualityAlert";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient } from "@/lib/qaseSdk";
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

export type CompanyMember = {
  userId: string;
  name: string;
};

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
  companyMembers: CompanyMember[];
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

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeNumericId(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  if (normalized === "in_progress") return { label: "Em análise", tone: "warning" };
  if (normalized === "open") return { label: "Aberto", tone: "warning" };
  return { label: "Em análise", tone: "neutral" };
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
      detail: "Runs integradas podem aparecer junto das execuções manuais neste painel.",
      tone: "positive",
    };
  }
  if (company.jira_is_active === true && company.jira_is_valid === true) {
    return {
      title: "Jira ativa",
      detail: "A empresa possui integração Jira ativa e pronta para sincronizacao.",
      tone: "positive",
    };
  }
  if ((company.has_qase_token && (company.qase_project_codes?.length ?? 0) > 0) || company.qase_validation_status === "saved") {
    return {
      title: "Qase pendente",
      detail: "Existe configuração salva, mas ela ainda não esta ativa para uso operacional.",
      tone: "warning",
    };
  }
  if (company.has_jira_api_token || company.jira_validation_status === "saved") {
    return {
      title: "Jira pendente",
      detail: "Existe configuração Jira salva, mas ela ainda não esta ativa.",
      tone: "warning",
    };
  }

  return {
    title: "Sem integração",
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

type QaseDashboardResponsible = {
  name: string | null;
  email: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }

  return [];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => normalizeString(value)).filter((value): value is string => Boolean(value))),
  );
}

function resolveIntegratedReleaseResponsible(release: ReleaseEntry) {
  const record = asRecord(release);
  const names = uniqueStrings([
    ...normalizeStringList(release.assigneeNames),
    ...normalizeStringList(record?.assigneeNames),
    normalizeString(record?.responsibleName),
    normalizeString(record?.assignedToName),
    normalizeString(record?.createdByName),
  ]);
  const emails = uniqueStrings([
    ...normalizeStringList(release.assignees),
    ...normalizeStringList(record?.assignees),
    normalizeString(record?.responsibleEmail),
    normalizeString(record?.createdByEmail),
  ]);
  const label =
    names.join(", ") ||
    emails.join(", ") ||
    normalizeString(record?.responsibleLabel) ||
    null;

  return { names, emails, label };
}

function releaseRunLookupKey(release: ReleaseEntry) {
  const projectCode = normalizeProjectCode(release.qaseProject ?? release.project ?? release.app);
  const runId = normalizeNumericId(release.runId);
  if (!projectCode || !runId) return null;
  return `${projectCode}:${runId}`;
}

async function enrichIntegratedRunsWithQaseResponsibles(releases: ReleaseEntry[], companySlug: string) {
  if (!releases.length) return releases;

  const MAX_RESPONSIBLE_ENRICH_RUNS = 24;

  const settings = await getClientQaseSettings(companySlug);
  if (!settings?.token) return releases;

  const candidates = Array.from(
    new Map(
      releases
        .filter((release) => !resolveIntegratedReleaseResponsible(release).label)
        .map((release) => {
          const key = releaseRunLookupKey(release);
          return key ? [key, release] as const : null;
        })
        .filter((entry): entry is readonly [string, ReleaseEntry] => entry !== null),
    ).values(),
  )
    .sort((left, right) => {
      const leftTime = toTimestamp(left.createdAt ?? left.created_at);
      const rightTime = toTimestamp(right.createdAt ?? right.created_at);
      return rightTime - leftTime;
    })
    .slice(0, MAX_RESPONSIBLE_ENRICH_RUNS);

  if (!candidates.length) return releases;

  const client = createQaseClient({
    token: settings.token,
    baseUrl: settings.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });

  const runUserIdByKey = new Map<string, number>();

  await Promise.all(
    candidates.map(async (release) => {
      const key = releaseRunLookupKey(release);
      const projectCode = normalizeProjectCode(release.qaseProject ?? release.project ?? release.app);
      const runId = normalizeNumericId(release.runId);
      if (!key || !projectCode || !runId) return;

      try {
        const { data } = await client.getWithStatus<{ result?: unknown }>(`/run/${encodeURIComponent(projectCode)}/${runId}`);
        const runResult = asRecord(asRecord(data)?.result);
        const userId = normalizeNumericId(runResult?.user_id);
        if (userId) {
          runUserIdByKey.set(key, userId);
        }
      } catch {
        // Best-effort enrichment: dashboard must still load without responsible data.
      }
    }),
  );

  if (!runUserIdByKey.size) return releases;

  const responsiblesByUserId = new Map<number, QaseDashboardResponsible>();
  const uniqueUserIds = Array.from(new Set(runUserIdByKey.values()));

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const { data } = await client.getWithStatus<{ result?: unknown }>(`/user/${userId}`);
        const result = asRecord(asRecord(data)?.result);
        if (!result) return;
        responsiblesByUserId.set(userId, {
          name: normalizeString(result.name),
          email: normalizeString(result.email),
        });
      } catch {
        // Ignore per-user lookup failures to avoid blocking the dashboard.
      }
    }),
  );

  if (!responsiblesByUserId.size) return releases;

  return releases.map((release) => {
    if (resolveIntegratedReleaseResponsible(release).label) return release;

    const key = releaseRunLookupKey(release);
    if (!key) return release;

    const userId = runUserIdByKey.get(key);
    if (!userId) return release;

    const responsible = responsiblesByUserId.get(userId);
    if (!responsible) return release;

    return {
      ...release,
      assigneeNames: responsible.name ? [responsible.name] : release.assigneeNames,
      assignees: responsible.email ? [responsible.email] : release.assignees,
    };
  });
}

function buildManualRunItem(run: Release, companySlug: string): HomeRunItem {
  const status = resolveRunStatusMeta(run.status, { closedAt: run.closedAt ?? null });
  const stats = computeStats(run.stats);
  const applicationName = String(run.app ?? run.qaseProject ?? "Aplicação manual").trim() || "Aplicação manual";
  const createdAt = toIso(run.createdAt);
  const updatedAt = toIso(run.updatedAt) ?? createdAt;

  return {
    id: run.id || run.slug,
    slug: run.slug,
    runId: normalizeNumericId(run.runId),
    title: formatRunTitle(run.name || run.slug, "Run manual"),
    href: `../runs/${encodeURIComponent(run.slug)}`,
    applicationKey: normalizeKey(run.app || run.qaseProject || applicationName),
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
        : `${stats.pass} aprovados, ${stats.fail} falhas, ${stats.blocked} bloqueados e ${stats.notRun} não executados.`,
    stats,
    releaseLabel: "Run manual",
    responsibleLabel: run.assignedToName ?? run.createdByName ?? null,
  };
}

function buildIntegratedRunItem(release: ReleaseEntry, companySlug: string): HomeRunItem {
  const status = resolveRunStatusMeta(release.status ?? null);
  const stats = extractReleaseStats(release);
  const applicationName =
    String(release.app ?? release.project ?? release.qaseProject ?? "Integração").trim() || "Integração";
  const createdAt = toIso(release.createdAt ?? release.created_at);
  const provider = inferIntegrationProvider(release);
  const responsibleLabel = resolveIntegratedReleaseResponsible(release).label;

  return {
    id: release.slug,
    slug: release.slug,
    runId: normalizeNumericId(release.runId),
    title: formatRunTitle(release.title || release.slug, "Run integrada"),
    href: `../runs/${encodeURIComponent(release.slug)}`,
    applicationKey: normalizeKey(release.app || release.project || release.qaseProject || applicationName),
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
  const applicationName = String(defect.app ?? defect.qaseProject ?? defect.runName ?? "Aplicação").trim() || "Aplicação";
  const status = resolveDefectStatusMeta(defect.status ?? null);
  return {
    id: defect.id || defect.slug,
    slug: defect.slug,
    title: formatRunTitle(defect.name || defect.slug, "Defeito"),
    href: defect.runSlug
      ? `../defeitos?run=${encodeURIComponent(defect.runSlug)}`
      : "../defeitos",
    runSlug: defect.runSlug ?? null,
    runName: defect.runName ?? null,
    applicationKey: normalizeKey(defect.app || defect.qaseProject || applicationName),
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
  const [manualReleases, integratedReleases, applicationsRaw, alertsRaw, companyMembers] = await Promise.all([
    readManualReleaseStore(),
    getAllReleases(),
    listApplications({ companySlug: company.slug ?? slug }),
    readAlertsStore(),
    loadCompanyMembers(companyRecord),
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

  // DEBUG: trace application matching
  console.info(`[dashboard-debug] slug=${slug} company.slug=${company.slug} company.id=${company.id}`);
  console.info(`[dashboard-debug] qase_project_codes=${JSON.stringify(company.qase_project_codes)}`);
  console.info(`[dashboard-debug] applicationsRaw.length=${applicationsRaw.length}`);
  console.info(`[dashboard-debug] signals.projectCodes=${JSON.stringify([...signals.projectCodes])}`);
  console.info(`[dashboard-debug] signals.applicationKeys=${JSON.stringify([...signals.applicationKeys])}`);
  console.info(`[dashboard-debug] integratedReleases.length=${integratedReleases.length}`);
  console.info(`[dashboard-debug] manualReleases.length=${manualReleases.length}`);

  const runsManual = manualReleases
    .filter((release) => resolveManualReleaseKind(release) === "run")
    .filter((release) => manualReleaseMatchesCompany(release, signals))
    .map((release) => buildManualRunItem(release, company.slug ?? slug));

  const companyIntegratedReleases = integratedReleases
    .filter((release) => integratedRunMatchesCompany(release, signals))
  const enrichedIntegratedReleases = await enrichIntegratedRunsWithQaseResponsibles(
    companyIntegratedReleases,
    company.slug ?? slug,
  );

  const runsIntegrated = enrichedIntegratedReleases
    .map((release) => buildIntegratedRunItem(release, company.slug ?? slug));

  const runs = [...runsManual, ...runsIntegrated].sort((left, right) => {
    const leftTime = Math.max(toTimestamp(left.updatedAt), toTimestamp(left.createdAt));
    const rightTime = Math.max(toTimestamp(right.updatedAt), toTimestamp(right.createdAt));
    return rightTime - leftTime;
  });

  console.info(`[dashboard-debug] runsManual.length=${runsManual.length} runsIntegrated.length=${runsIntegrated.length} total=${runs.length}`);
  console.info(`[dashboard-debug] applications.length=${applications.length}`);

  // Include Qase project codes as virtual applications when not already registered
  // We must do this after runs are built so we can check which codes already appear
  const runProjectCodes = new Set(
    runs.map((run) => run.projectCode?.trim().toUpperCase()).filter(Boolean),
  );
  const registeredCodes = new Set(
    applications
      .map((app) => app.qaseProjectCode?.trim().toUpperCase())
      .filter(Boolean),
  );
  for (const code of company.qase_project_codes ?? []) {
    const upper = code.trim().toUpperCase();
    const lower = code.trim().toLowerCase();
    if (!upper || registeredCodes.has(upper) || runProjectCodes.has(upper)) continue;
    applications.push({
      id: `qase_${lower}`,
      name: upper,
      slug: lower,
      description: null,
      imageUrl: null,
      qaseProjectCode: upper,
      source: "qase",
      active: true,
      createdAt: company.qase_validated_at ?? new Date().toISOString(),
      updatedAt: company.qase_validated_at ?? new Date().toISOString(),
    });
  }

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
    companyMembers,
  };
}

async function loadCompanyMembers(companyRecord: { id: string }): Promise<CompanyMember[]> {
  try {
    const [links, users] = await Promise.all([
      listLocalLinksForCompany(companyRecord.id),
      listLocalUsers(),
    ]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    return links
      .map((link) => {
        const user = usersById.get(link.userId);
        if (!user) return null;
        const name = resolveLocalUserDisplayName(user) ?? user.id;
        return { userId: user.id, name };
      })
      .filter((m): m is CompanyMember => m !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  } catch {
    return [];
  }
}
