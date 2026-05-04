import { listApplications, syncCompanyApplications } from "@/lib/applicationsStore";
import { findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { mapCompanyRecord } from "@/lib/companyRecord";
import { getCompanyDefects, type IntegratedProjectAccessStatus } from "@/lib/companyDefects";
import { summarizeDefectActivity } from "@/lib/defectActivity";
import { listDefectHistories } from "@/lib/manualDefectHistoryStore";
import { listManualReleaseResponsibleOptions, type ManualReleaseResponsibleOption } from "@/lib/manualReleaseResponsible";
import { getClientQaseSettings } from "@/lib/qaseConfig";

type CatalogSource = "manual" | "qase" | "mixed";

type DatasetItem = Awaited<ReturnType<typeof getCompanyDefects>>["items"][number] & {
  commentsCount: number;
  lastCommentAt: string | null;
};

type ApplicationCatalogItem = {
  name: string;
  projectCode: string | null;
  source: CatalogSource;
};

export type CompanyDefectsDataset = {
  items: DatasetItem[];
  applications: ApplicationCatalogItem[];
  integration: {
    hasQaseToken: boolean;
    hasJiraToken: boolean;
    activeProviders: Array<"qase" | "jira">;
    projectCodes: string[];
    blockedProjects: IntegratedProjectAccessStatus[];
  };
  responsibleOptions: ManualReleaseResponsibleOption[];
  warning: string | null;
};

type CompanyDefectsDatasetCacheEntry = {
  expiresAt: number;
  value: CompanyDefectsDataset;
};

type CompanyDefectsDatasetGlobal = typeof globalThis & {
  __qcCompanyDefectsDatasetCache?: Map<string, CompanyDefectsDatasetCacheEntry>;
};

const DATASET_TTL_MS = 60_000;

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeProjectCode(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
}

function normalizeProjectKey(value: unknown) {
  const normalized = normalizeProjectCode(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeKey(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function mergeCatalogSource(current: CatalogSource | undefined, next: "manual" | "qase"): CatalogSource {
  if (!current || current === next) return next;
  return "mixed";
}

function getDatasetCache() {
  const globalState = globalThis as CompanyDefectsDatasetGlobal;
  if (!globalState.__qcCompanyDefectsDatasetCache) {
    globalState.__qcCompanyDefectsDatasetCache = new Map<string, CompanyDefectsDatasetCacheEntry>();
  }
  return globalState.__qcCompanyDefectsDatasetCache;
}

function getConfiguredProjectCodes(
  qaseSettings: Awaited<ReturnType<typeof getClientQaseSettings>>,
) {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
        qaseSettings?.projectCode,
      ]
        .map((projectCode) => normalizeProjectCode(projectCode))
        .filter((projectCode): projectCode is string => Boolean(projectCode)),
    ),
  );
}

export function invalidateCompanyDefectsDataset(companySlug?: string | null) {
  const cache = getDatasetCache();
  if (!companySlug) {
    cache.clear();
    return;
  }
  cache.delete(companySlug);
}

export async function getCompanyDefectsDataset(
  companySlug: string,
  options?: { forceRefresh?: boolean },
): Promise<CompanyDefectsDataset> {
  const cache = getDatasetCache();
  const cached = cache.get(companySlug);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const qaseSettings = await getClientQaseSettings(companySlug);
  const configuredProjectCodes = getConfiguredProjectCodes(qaseSettings);

  if (options?.forceRefresh && configuredProjectCodes.length) {
    await syncCompanyApplications({
      companySlug,
      projects: configuredProjectCodes.map((code) => ({ code })),
      source: "qase",
    }).catch(() => undefined);
  }

  const [payload, applications, responsibleOptions, companyRecord] = await Promise.all([
    getCompanyDefects(companySlug, { forceRefresh: options?.forceRefresh }),
    listApplications({ companySlug }),
    listManualReleaseResponsibleOptions(companySlug),
    findLocalCompanyBySlug(companySlug),
  ]);
  const company = companyRecord ? mapCompanyRecord(companyRecord) : null;
  const activeProviders: Array<"qase" | "jira"> = [];
  if (company?.qase_is_active || company?.has_qase_token || Boolean(qaseSettings?.token)) {
    activeProviders.push("qase");
  }
  if (company?.jira_is_active || company?.has_jira_api_token) {
    activeProviders.push("jira");
  }
  const blockedProjectCodes = new Set(
    payload.integratedProjects
      .filter((project) => !project.accessible)
      .map((project) => normalizeProjectKey(project.projectCode))
      .filter((projectCode): projectCode is string => Boolean(projectCode)),
  );

  const appNameByProjectCode = new Map<string, string>();
  const appNameBySlug = new Map<string, string>();
  for (const application of applications) {
    const byProject = normalizeProjectKey(application.qaseProjectCode);
    const bySlug = normalizeKey(application.slug);
    const name = normalizeString(application.name);
    if (byProject && name && !appNameByProjectCode.has(byProject)) {
      appNameByProjectCode.set(byProject, name);
    }
    if (bySlug && name && !appNameBySlug.has(bySlug)) {
      appNameBySlug.set(bySlug, name);
    }
  }

  const historiesBySlug = await listDefectHistories(payload.items.map((item) => item.slug));
  const items = payload.items.map((item) => {
    const activity = summarizeDefectActivity(historiesBySlug[item.slug] ?? []);
    const projectCode = normalizeProjectCode(item.projectCode);
    const projectKey = normalizeProjectKey(item.projectCode);
    const applicationName =
      normalizeString(item.applicationName) ??
      (projectKey ? appNameByProjectCode.get(projectKey) ?? null : null) ??
      (item.runSlug ? appNameBySlug.get(normalizeKey(item.runSlug) ?? "") ?? null : null) ??
      projectCode;
    const assignedToUserId = item.sourceType === "manual" ? item.assignedToUserId : activity.assignedToUserId;
    const assignedToName = item.sourceType === "manual" ? item.assignedToName : activity.assignedToName;

    return {
      ...item,
      applicationName,
      assignedToUserId,
      assignedToName,
      commentsCount: activity.commentsCount,
      lastCommentAt: activity.lastCommentAt,
    };
  });

  const catalog = new Map<string, ApplicationCatalogItem>();

  for (const application of applications) {
    const name = normalizeString(application.name);
    if (!name) continue;
    const projectCode = normalizeProjectCode(application.qaseProjectCode);
    const projectKey = normalizeProjectKey(application.qaseProjectCode);
    if (projectKey && blockedProjectCodes.has(projectKey)) continue;
    const key = `${normalizeKey(name) ?? name}:${projectKey ?? ""}`;
    const source = normalizeKey(application.source) === "qase" || projectCode ? "qase" : "manual";
    const current = catalog.get(key);
    catalog.set(key, {
      name,
      projectCode,
      source: mergeCatalogSource(current?.source, source),
    });
  }

  for (const item of items) {
    const name = normalizeString(item.applicationName);
    if (!name) continue;
    const projectCode = normalizeProjectCode(item.projectCode);
    const key = `${normalizeKey(name) ?? name}:${normalizeProjectKey(item.projectCode) ?? ""}`;
    const current = catalog.get(key);
    catalog.set(key, {
      name,
      projectCode,
      source: mergeCatalogSource(current?.source, item.sourceType),
    });
  }

  for (const projectCode of configuredProjectCodes) {
    const projectKey = normalizeProjectKey(projectCode);
    if (projectKey && blockedProjectCodes.has(projectKey)) continue;
    const mappedName = (projectKey ? appNameByProjectCode.get(projectKey) : null) ?? projectCode;
    const key = `${normalizeKey(mappedName) ?? mappedName}:${projectKey ?? ""}`;
    const current = catalog.get(key);
    catalog.set(key, {
      name: mappedName,
      projectCode,
      source: mergeCatalogSource(current?.source, "qase"),
    });
  }

  const value: CompanyDefectsDataset = {
    items,
    warning: payload.warning ?? null,
    applications: Array.from(catalog.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
    ),
    integration: {
      hasQaseToken: Boolean(company?.has_qase_token || qaseSettings?.token),
      hasJiraToken: Boolean(company?.has_jira_api_token),
      activeProviders,
      projectCodes: configuredProjectCodes,
      blockedProjects: payload.integratedProjects.filter((project) => !project.accessible),
    },
    responsibleOptions,
  };

  cache.set(companySlug, {
    expiresAt: Date.now() + DATASET_TTL_MS,
    value,
  });

  return value;
}
