import "server-only";

import { listApplications, type AppRecord } from "@/lib/applicationsStore";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";
import { listTestCaseRecords } from "@/lib/test-cases/testCaseRepository";
import type {
  TestCase,
  TestCasePriority,
  TestCaseRecord,
  TestCaseStep,
} from "@/lib/test-cases/types";
import { buildQaseCaseLink } from "@/lib/testPlanCases";

export type TestProjectSuite = {
  id: string;
  name: string;
  parentId?: string | null;
  casesCount: number;
  source: "internal" | "qase";
};

export type TestProjectCase = {
  id: string;
  key: string;
  title: string;
  source: "internal" | "qase";
  projectCode: string | null;
  projectName: string | null;
  suiteId: string | null;
  suiteName: string | null;
  applicationId: string | null;
  applicationName: string | null;
  moduleId: string | null;
  priority: string | null;
  severity: string | null;
  automationStatus: string | null;
  tags: string[];
  externalUrl?: string | null;
  record?: TestCaseRecord;
};

export type TestProject = {
  id: string;
  code: string | null;
  name: string;
  source: "internal" | "qase";
  companySlug: string;
  applicationId: string | null;
  applicationName: string | null;
  applicationSlug: string | null;
  integrationStatus: "active" | "missing_token" | "unconfigured" | "error";
  lastSyncedAt?: string | null;
  suites: TestProjectSuite[];
  cases: TestProjectCase[];
  casesCount: number;
  suitesCount: number;
  warning?: string | null;
};

export type TestProjectsResult = {
  projects: TestProject[];
  warnings: string[];
};

type QaseSettings = NonNullable<Awaited<ReturnType<typeof getClientQaseSettings>>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeProjectCode(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return normalizeString(value);
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function extractEntities(payload: unknown) {
  const root = asRecord(payload);
  const result = asRecord(root?.result);
  return normalizeArray(result?.entities ?? root?.entities ?? root?.items ?? result?.items);
}

function readableFromObject(value: unknown) {
  const record = asRecord(value);
  if (!record) return normalizeString(value);
  return (
    normalizeString(record.title) ??
    normalizeString(record.name) ??
    normalizeString(record.value) ??
    normalizeString(record.slug)
  );
}

function normalizePriority(value: unknown): TestCasePriority | undefined {
  const raw = String(readableFromObject(value) ?? "").trim().toLowerCase();
  if (raw.includes("critical") || raw.includes("blocker") || raw.includes("cr")) return "critical";
  if (raw.includes("high") || raw.includes("alta")) return "high";
  if (raw.includes("low") || raw.includes("baixa")) return "low";
  if (raw.includes("medium") || raw.includes("normal") || raw.includes("media") || raw.includes("mÃ©dia")) return "medium";
  return undefined;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => {
          const record = asRecord(item);
          return normalizeString(record?.title) ?? normalizeString(record?.name) ?? normalizeString(item);
        })
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function normalizeQaseStep(raw: unknown, testCaseId: string, index: number, now: string): TestCaseStep | null {
  const record = asRecord(raw);
  if (!record) return null;
  const action =
    normalizeString(record.action) ??
    normalizeString(record.text) ??
    normalizeString(record.step) ??
    normalizeString(record.description);
  const expectedResult =
    normalizeString(record.expected_result) ??
    normalizeString(record.expectedResult) ??
    normalizeString(record.expected);
  const data = normalizeString(record.data);
  if (!action && !expectedResult && !data) return null;
  return {
    id: `${testCaseId}-step-${index + 1}`,
    testCaseId,
    order: index + 1,
    action: action ?? "Passo sem aÃ§Ã£o informada",
    expectedResult: expectedResult ?? "Resultado esperado nÃ£o informado",
    data,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeQaseSuite(raw: unknown): TestProjectSuite | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = normalizeIdentifier(record.id ?? record.suite_id ?? record.suiteId);
  if (!id) return null;
  return {
    id,
    name: readableFromObject(record.title ?? record.name) ?? `Suite ${id}`,
    parentId: normalizeIdentifier(record.parent_id ?? record.parentId),
    casesCount: Number(record.cases_count ?? record.casesCount ?? 0) || 0,
    source: "qase",
  };
}

function normalizeQaseCase(raw: unknown, input: {
  projectCode: string;
  projectName: string;
  companySlug: string;
  application: AppRecord | null;
  suitesById: Map<string, TestProjectSuite>;
}): TestCaseRecord | null {
  const record = asRecord(raw);
  if (!record) return null;
  const caseId = normalizeIdentifier(record.id ?? record.case_id ?? record.caseId);
  if (!caseId) return null;

  const externalKey = `${input.projectCode}-${caseId}`;
  const testCaseId = `qase-${input.projectCode.toLowerCase()}-${caseId}`;
  const suiteId = normalizeIdentifier(record.suite_id ?? record.suiteId ?? asRecord(record.suite)?.id);
  const suite = suiteId ? input.suitesById.get(suiteId) ?? null : null;
  const now = new Date().toISOString();
  const steps = normalizeArray(record.steps)
    .map((step, index) => normalizeQaseStep(step, testCaseId, index, now))
    .filter((step): step is TestCaseStep => step !== null);
  const priority = normalizePriority(record.priority) ?? "medium";
  const severity = normalizePriority(record.severity) ?? priority;
  const externalUrl = buildQaseCaseLink(input.projectCode, caseId);
  const title = normalizeString(record.title) ?? normalizeString(record.name) ?? `Caso ${externalKey}`;

  const testCase: TestCase = {
    id: testCaseId,
    key: externalKey,
    externalId: caseId,
    externalKey,
    externalUrl: externalUrl ?? undefined,
    source: "qase",
    title,
    description: normalizeString(record.description) ?? undefined,
    preconditions:
      normalizeString(record.preconditions) ??
      normalizeString(record.precondition) ??
      undefined,
    postconditions:
      normalizeString(record.postconditions) ??
      normalizeString(record.postcondition) ??
      undefined,
    type: "manual",
    status: "active",
    priority,
    severity,
    companyId: input.companySlug,
    applicationId: input.application?.id ?? input.application?.slug ?? null,
    moduleId: suite?.name ?? null,
    testProjectCode: input.projectCode,
    testProjectName: input.projectName,
    suiteId,
    suiteName: suite?.name ?? null,
    tags: normalizeTags(record.tags),
    lastExecutionStatus: "not_run",
    lastExecutedAt: null,
    automationStatus: normalizeString(record.automation) ? "linked" : "none",
    createdBy: "qase-sync",
    updatedBy: "qase-sync",
    createdAt: normalizeString(record.created_at) ?? now,
    updatedAt: normalizeString(record.updated_at) ?? normalizeString(record.updated) ?? now,
  };

  return {
    testCase,
    steps,
    versions: [],
    automationLink: null,
    externalSync: {
      id: `${testCaseId}-sync`,
      testCaseId,
      provider: "qase",
      externalId: caseId,
      externalKey,
      externalUrl,
      lastSyncedAt: now,
      syncStatus: "synced",
      rawPayload: record,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function recordToProjectCase(record: TestCaseRecord, application: AppRecord | null): TestProjectCase {
  const projectCode = normalizeProjectCode(record.testCase.testProjectCode ?? record.testCase.externalKey?.split("-")[0]);
  return {
    id: record.testCase.id,
    key: record.testCase.key ?? record.testCase.externalKey ?? record.testCase.id,
    title: record.testCase.title,
    source: record.testCase.source === "qase" ? "qase" : "internal",
    projectCode,
    projectName: record.testCase.testProjectName ?? application?.name ?? projectCode,
    suiteId: record.testCase.suiteId ?? record.testCase.moduleId ?? null,
    suiteName: record.testCase.suiteName ?? record.testCase.moduleId ?? null,
    applicationId: record.testCase.applicationId ?? application?.id ?? null,
    applicationName: application?.name ?? record.testCase.applicationId ?? null,
    moduleId: record.testCase.moduleId ?? null,
    priority: record.testCase.priority ?? null,
    severity: record.testCase.severity ?? null,
    automationStatus: record.testCase.automationStatus ?? null,
    tags: record.testCase.tags,
    externalUrl: record.testCase.externalUrl ?? record.externalSync?.externalUrl ?? null,
    record,
  };
}

function upsertProject(projects: Map<string, TestProject>, input: {
  companySlug: string;
  application: AppRecord | null;
  code: string | null;
  name: string;
  source: "internal" | "qase";
  integrationStatus: TestProject["integrationStatus"];
  warning?: string | null;
}) {
  const id = input.code
    ? `${input.source}:${input.code}`
    : `${input.source}:${input.application?.id ?? input.application?.slug ?? input.name}`;
  const existing = projects.get(id);
  if (existing) return existing;
  const created: TestProject = {
    id,
    code: input.code,
    name: input.name,
    source: input.source,
    companySlug: input.companySlug,
    applicationId: input.application?.id ?? null,
    applicationName: input.application?.name ?? null,
    applicationSlug: input.application?.slug ?? null,
    integrationStatus: input.integrationStatus,
    suites: [],
    cases: [],
    suitesCount: 0,
    casesCount: 0,
    warning: input.warning ?? null,
  };
  projects.set(id, created);
  return created;
}

function addCaseToProject(project: TestProject, testCase: TestProjectCase) {
  if (project.cases.some((item) => item.id === testCase.id)) return;
  project.cases.push(testCase);
  const suiteId = testCase.suiteId ?? "sem-suite";
  const suiteName = testCase.suiteName ?? "Sem suite/pasta";
  let suite = project.suites.find((item) => item.id === suiteId);
  if (!suite) {
    suite = {
      id: suiteId,
      name: suiteName,
      casesCount: 0,
      source: testCase.source,
    };
    project.suites.push(suite);
  }
  suite.casesCount += 1;
}

async function fetchQaseSuites(settings: QaseSettings, projectCode: string) {
  const client = createQaseClient({
    token: settings.token ?? "",
    baseUrl: settings.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const all: TestProjectSuite[] = [];
  const limit = 100;
  let offset = 0;
  while (true) {
    const data = await client.listSuites(projectCode, { limit, offset });
    const entities = extractEntities(data);
    all.push(
      ...entities
        .map((entity) => normalizeQaseSuite(entity))
        .filter((entity): entity is TestProjectSuite => entity !== null),
    );
    if (entities.length < limit) break;
    offset += limit;
  }
  return all;
}

async function fetchQaseCaseRecords(settings: QaseSettings, input: {
  companySlug: string;
  application: AppRecord | null;
  projectCode: string;
  projectName: string;
  suites: TestProjectSuite[];
}) {
  const client = createQaseClient({
    token: settings.token ?? "",
    baseUrl: settings.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const suitesById = new Map(input.suites.map((suite) => [suite.id, suite]));
  const records: TestCaseRecord[] = [];
  const limit = 100;
  let offset = 0;
  while (true) {
    const data = await client.listCases(input.projectCode, {
      include: "external_issues",
      limit,
      offset,
    });
    const entities = extractEntities(data);
    records.push(
      ...entities
        .map((entity) =>
          normalizeQaseCase(entity, {
            projectCode: input.projectCode,
            projectName: input.projectName,
            companySlug: input.companySlug,
            application: input.application,
            suitesById,
          }),
        )
        .filter((entity): entity is TestCaseRecord => entity !== null),
    );
    if (entities.length < limit) break;
    offset += limit;
  }
  return records;
}

export async function listIntegratedQaseTestCaseRecords(input: {
  companySlug: string;
  applicationId?: string | null;
  projectCode?: string | null;
}) {
  const companySlug = input.companySlug.trim().toLowerCase();
  if (!companySlug) return [];
  const settings = await getClientQaseSettings(companySlug);
  if (!settings?.token) return [];
  const applications = await listApplications({ companySlug });
  const selectedApplications = applications.filter((application) => {
    if (input.applicationId && application.id !== input.applicationId && application.slug !== input.applicationId) return false;
    if (input.projectCode && normalizeProjectCode(application.qaseProjectCode) !== normalizeProjectCode(input.projectCode)) return false;
    return Boolean(normalizeProjectCode(application.qaseProjectCode));
  });

  const records: TestCaseRecord[] = [];
  for (const application of selectedApplications) {
    const projectCode = normalizeProjectCode(application.qaseProjectCode);
    if (!projectCode) continue;
    try {
      const suites = await fetchQaseSuites(settings, projectCode);
      const qaseRecords = await fetchQaseCaseRecords(settings, {
        companySlug,
        application,
        projectCode,
        projectName: application.name,
        suites,
      });
      records.push(...qaseRecords);
    } catch {
      // Best effort. The projects endpoint exposes warnings; the repository API should stay usable.
    }
  }
  return records;
}

export async function listTestProjects(input: {
  companySlug: string;
  applicationId?: string | null;
  includeCases?: boolean;
}): Promise<TestProjectsResult> {
  const companySlug = input.companySlug.trim().toLowerCase();
  const warnings: string[] = [];
  const projects = new Map<string, TestProject>();
  const applications = await listApplications({ companySlug });
  const selectedApplications = applications.filter((application) => {
    if (!input.applicationId) return true;
    return application.id === input.applicationId || application.slug === input.applicationId;
  });
  const settings = await getClientQaseSettings(companySlug);

  for (const application of selectedApplications) {
    const projectCode = normalizeProjectCode(application.qaseProjectCode);
    if (projectCode) {
      const project = upsertProject(projects, {
        companySlug,
        application,
        code: projectCode,
        name: application.name || projectCode,
        source: "qase",
        integrationStatus: settings?.token ? "active" : "missing_token",
        warning: settings?.token ? null : "Token do Qase ausente para sincronizar suites e casos.",
      });

      if (settings?.token) {
        try {
          const suites = await fetchQaseSuites(settings, projectCode);
          project.suites = suites;
          if (input.includeCases) {
            const qaseRecords = await fetchQaseCaseRecords(settings, {
              companySlug,
              application,
              projectCode,
              projectName: application.name || projectCode,
              suites,
            });
            qaseRecords.map((record) => recordToProjectCase(record, application)).forEach((testCase) => addCaseToProject(project, testCase));
          }
        } catch (error) {
          const message =
            error instanceof QaseError && (error.status === 401 || error.status === 403)
              ? `Qase recusou acesso ao projeto ${projectCode}.`
              : `Nao foi possivel sincronizar ${projectCode}.`;
          project.integrationStatus = "error";
          project.warning = message;
          warnings.push(message);
        }
      }
    } else {
      upsertProject(projects, {
        companySlug,
        application,
        code: null,
        name: application.name,
        source: "internal",
        integrationStatus: "unconfigured",
      });
    }
  }

  const localRecords = await listTestCaseRecords({
    companyId: companySlug,
    applicationId: input.applicationId,
  });

  for (const record of localRecords) {
    const application =
      selectedApplications.find((item) => item.id === record.testCase.applicationId || item.slug === record.testCase.applicationId) ??
      null;
    const projectCode = normalizeProjectCode(record.testCase.testProjectCode ?? application?.qaseProjectCode);
    const project = upsertProject(projects, {
      companySlug,
      application,
      code: projectCode,
      name: record.testCase.testProjectName ?? application?.name ?? projectCode ?? "Projeto interno",
      source: record.testCase.source === "qase" ? "qase" : "internal",
      integrationStatus: projectCode ? (settings?.token ? "active" : "missing_token") : "unconfigured",
    });
    addCaseToProject(project, recordToProjectCase(record, application));
  }

  const items = Array.from(projects.values()).map((project) => {
    project.suites.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    project.cases.sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));
    project.suitesCount = project.suites.length;
    project.casesCount = project.cases.length || project.suites.reduce((sum, suite) => sum + suite.casesCount, 0);
    return project;
  });

  return {
    projects: items.sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    warnings,
  };
}

