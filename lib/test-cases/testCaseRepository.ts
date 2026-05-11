import "server-only";

import { randomUUID } from "node:crypto";
import { listSeedTestCaseRecords } from "./testCaseMappers";
import { createTestCaseVersion } from "./testCaseSnapshots";
import {
  TEST_CASE_AUTOMATION_STATUSES,
  TEST_CASE_PRIORITIES,
  TEST_CASE_SOURCES,
  TEST_CASE_STATUSES,
  TEST_CASE_TYPES,
} from "./types";
import type {
  CreateTestAutomationLinkInput,
  CreateTestCaseInput,
  TestCase,
  TestCaseAutomationStatus,
  TestCaseFilters,
  TestCasePriority,
  TestAutomationLink,
  TestCaseRecord,
  TestCaseSource,
  TestCaseStatus,
  TestCaseType,
} from "./types";

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

async function readManualRecords(): Promise<TestCaseRecord[]> {
  try {
    const prisma = await getPrisma();
    const rows = await prisma.storedTestCase.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((row) => row.data as unknown as TestCaseRecord);
  } catch {
    return [];
  }
}

async function writeManualRecords(records: TestCaseRecord[]) {
  const prisma = await getPrisma();
  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      const id = record.testCase.id;
      const companyId = record.testCase.companyId ?? null;
      await tx.storedTestCase.upsert({
        where: { id },
        update: { data: record as object, companyId },
        create: { id, companyId, data: record as object },
      });
    }
    // Remove records that are no longer in the list
    const keepIds = records.map((r) => r.testCase.id);
    await tx.storedTestCase.deleteMany({ where: { id: { notIn: keepIds } } });
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(tags: unknown) {
  return Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean)))
    : [];
}

function normalizeNullableText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function createDomainError(code: string, extras?: Record<string, unknown>) {
  const error = new Error(code) as Error & { code?: string } & Record<string, unknown>;
  error.code = code;
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      error[key] = value;
    }
  }
  return error;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]) {
  const normalized = normalizeText(value) as T;
  if (!normalized) return undefined;
  return allowed.includes(normalized) ? normalized : undefined;
}

function ensureAllowedEnum<T extends string>(
  code: string,
  value: unknown,
  allowed: readonly T[],
  fallback?: T,
) {
  if (value === undefined) return fallback;
  const normalized = normalizeEnum(value, allowed);
  if (!normalized) throw createDomainError(code);
  return normalized;
}

function buildNormalizedSteps(
  testCaseId: string,
  stepsInput: CreateTestCaseInput["steps"],
  now: string,
  currentSteps?: TestCaseRecord["steps"],
) {
  return (stepsInput ?? []).map((step, index) => {
    const action = normalizeText(step.action);
    if (!action) {
      throw createDomainError("STEP_ACTION_REQUIRED", { stepIndex: index + 1 });
    }

    const expectedResult = normalizeText(step.expectedResult);
    if (!expectedResult) {
      throw createDomainError("STEP_EXPECTED_RESULT_REQUIRED", { stepIndex: index + 1 });
    }

    return {
      id: `${testCaseId}-step-${index + 1}`,
      testCaseId,
      order: index + 1,
      action,
      expectedResult,
      data: normalizeText(step.data) || null,
      notes: normalizeText(step.notes) || null,
      createdAt: currentSteps?.[index]?.createdAt ?? now,
      updatedAt: now,
    };
  });
}

function findAutomationDuplicate(
  records: TestCaseRecord[],
  currentTestCaseId: string,
  specFile: string,
  tags: string[],
) {
  const normalizedSpec = normalizeText(specFile);
  if (!normalizedSpec) return null;

  for (const record of records) {
    if (record.testCase.id === currentTestCaseId) continue;
    const link = record.automationLink;
    if (!link) continue;
    if (normalizeText(link.specFile) !== normalizedSpec) continue;

    for (const tag of tags) {
      if (link.tags.includes(tag)) {
        return {
          testCaseId: record.testCase.id,
          key: record.testCase.key ?? null,
          title: record.testCase.title,
          tag,
        };
      }
    }
  }

  return null;
}

function deriveAutomationStatus(status: TestAutomationLink["status"]): TestCaseAutomationStatus {
  if (status === "broken") return "broken";
  if (status === "active") return "linked";
  if (status === "pending") return "planned";
  if (status === "disabled") return "disabled";
  return "none";
}

function deriveTestCaseType(currentType: TestCaseType, automationStatus: TestCaseAutomationStatus): TestCaseType {
  if (automationStatus === "none") {
    if (currentType === "hybrid") return "manual";
    return currentType === "automated" ? "manual" : currentType;
  }

  if (currentType === "manual") return "hybrid";
  return currentType;
}

function generateReadableKey(totalRecords: number) {
  return `TC-${String(totalRecords + 1).padStart(3, "0")}`;
}

function searchableText(record: TestCaseRecord) {
  return [
    record.testCase.key,
    record.testCase.externalKey,
    record.testCase.externalUrl,
    record.testCase.title,
    record.testCase.description,
    record.testCase.objective,
    record.testCase.applicationId,
    record.testCase.moduleId,
    record.testCase.testProjectCode,
    record.testCase.testProjectName,
    record.testCase.suiteId,
    record.testCase.suiteName,
    record.testCase.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesFilterValue(value: string | null | undefined, filter: string | null | undefined) {
  if (!filter || filter === "all") return true;
  return String(value ?? "").toLowerCase() === filter.toLowerCase();
}

function matchesProjectCode(testCase: TestCase, filter: string | null | undefined) {
  if (!filter || filter === "all") return true;
  const normalizedFilter = String(filter).trim().toUpperCase();
  return [testCase.testProjectCode, testCase.externalKey?.split("-")[0], testCase.applicationId]
    .map((value) => String(value ?? "").trim().toUpperCase())
    .some((value) => value === normalizedFilter);
}

export async function listTestCaseRecords(filters: TestCaseFilters = {}): Promise<TestCaseRecord[]> {
  const seedRecords = listSeedTestCaseRecords();
  const manualRecords = await readManualRecords();
  const recordsById = new Map<string, TestCaseRecord>();

  for (const record of seedRecords) recordsById.set(record.testCase.id, record);
  for (const record of manualRecords) recordsById.set(record.testCase.id, record);

  const query = normalizeText(filters.query).toLowerCase();

  return Array.from(recordsById.values()).filter((record) => {
    const testCase = record.testCase;
    if (query && !searchableText(record).includes(query)) return false;
    if (!matchesFilterValue(testCase.companyId, filters.companyId)) return false;
    if (filters.projectId && (testCase as unknown as { projectId?: string | null }).projectId !== filters.projectId) return false;
    if (!matchesFilterValue(testCase.applicationId, filters.applicationId)) return false;
    if (!matchesFilterValue(testCase.moduleId, filters.moduleId)) return false;
    if (!matchesProjectCode(testCase, filters.projectCode)) return false;
    if (!matchesFilterValue(testCase.suiteId, filters.suiteId)) return false;
    if (!matchesFilterValue(testCase.type, filters.type as TestCaseType | "all" | null | undefined)) return false;
    if (!matchesFilterValue(testCase.source, filters.source as TestCaseSource | "all" | null | undefined)) return false;
    if (!matchesFilterValue(testCase.status, filters.status as TestCaseStatus | "all" | null | undefined)) return false;
    if (!matchesFilterValue(testCase.priority, filters.priority)) return false;
    if (!matchesFilterValue(testCase.automationStatus, filters.automationStatus as TestCaseAutomationStatus | "all" | null | undefined)) return false;
    if (filters.tag && !testCase.tags.includes(filters.tag)) return false;
    return true;
  });
}

export async function getTestCaseRecord(id: string): Promise<TestCaseRecord | null> {
  const records = await listTestCaseRecords();
  return records.find((record) => record.testCase.id === id || record.testCase.key === id) ?? null;
}

export async function createManualTestCaseRecord(input: CreateTestCaseInput, actorId: string): Promise<TestCaseRecord> {
  const title = normalizeText(input.title);
  if (!title) {
    throw createDomainError("TITLE_REQUIRED");
  }

  const manualRecords = await readManualRecords();
  const allRecords = await listTestCaseRecords();
  const now = new Date().toISOString();
  const id = `tc-${randomUUID()}`;
  const testCase: TestCase = {
    id,
    key: generateReadableKey(allRecords.length),
    source: "manual",
    title,
    description: normalizeText(input.description) || undefined,
    objective: normalizeText(input.objective) || undefined,
    preconditions: normalizeText(input.preconditions) || undefined,
    postconditions: normalizeText(input.postconditions) || undefined,
    type: ensureAllowedEnum("INVALID_TEST_CASE_TYPE", input.type, TEST_CASE_TYPES, "manual")!,
    status: ensureAllowedEnum("INVALID_TEST_CASE_STATUS", input.status, TEST_CASE_STATUSES, "draft")!,
    priority: ensureAllowedEnum("INVALID_TEST_CASE_PRIORITY", input.priority, TEST_CASE_PRIORITIES, "medium")!,
    severity: input.severity,
    risk: input.risk,
    companyId: input.companyId ?? null,
    applicationId: normalizeText(input.applicationId) || null,
    moduleId: normalizeText(input.moduleId) || null,
    testProjectCode: normalizeText(input.testProjectCode)?.toUpperCase() || null,
    testProjectName: normalizeText(input.testProjectName) || null,
    suiteId: normalizeText(input.suiteId) || null,
    suiteName: normalizeText(input.suiteName) || null,
    featureId: normalizeText(input.featureId) || null,
    tags: normalizeTags(input.tags),
    lastExecutionStatus: "not_run",
    lastExecutedAt: null,
    automationStatus: "none",
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
  const steps = buildNormalizedSteps(id, input.steps, now);
  const record: TestCaseRecord = {
    testCase,
    steps,
    versions: [createTestCaseVersion(testCase, steps, 1, actorId)],
    automationLink: null,
    externalSync: null,
  };

  await writeManualRecords([record, ...manualRecords.filter((item) => item.testCase.id !== id)]);
  return record;
}

export async function updateTestCaseRecord(
  id: string,
  patch: Partial<CreateTestCaseInput> & {
    source?: TestCaseSource;
    status?: TestCaseStatus;
    type?: TestCaseType;
    priority?: TestCasePriority;
    automationStatus?: TestCaseAutomationStatus;
    companyId?: string | null;
  },
  actorId: string,
): Promise<TestCaseRecord | null> {
  const manualRecords = await readManualRecords();
  const index = manualRecords.findIndex(
    (item) => item.testCase.id === id || item.testCase.key === id,
  );
  if (index < 0) return null;

  const current = manualRecords[index];
  const now = new Date().toISOString();
  const nextTestCase: TestCase = {
    ...current.testCase,
    title: patch.title !== undefined ? normalizeText(patch.title) || current.testCase.title : current.testCase.title,
    description:
      patch.description !== undefined ? normalizeText(patch.description) || undefined : current.testCase.description,
    objective:
      patch.objective !== undefined ? normalizeText(patch.objective) || undefined : current.testCase.objective,
    preconditions:
      patch.preconditions !== undefined ? normalizeText(patch.preconditions) || undefined : current.testCase.preconditions,
    postconditions:
      patch.postconditions !== undefined ? normalizeText(patch.postconditions) || undefined : current.testCase.postconditions,
    source: ensureAllowedEnum("INVALID_TEST_CASE_SOURCE", patch.source, TEST_CASE_SOURCES, current.testCase.source)!,
    type: ensureAllowedEnum("INVALID_TEST_CASE_TYPE", patch.type, TEST_CASE_TYPES, current.testCase.type)!,
    status: ensureAllowedEnum("INVALID_TEST_CASE_STATUS", patch.status, TEST_CASE_STATUSES, current.testCase.status)!,
    priority: ensureAllowedEnum("INVALID_TEST_CASE_PRIORITY", patch.priority, TEST_CASE_PRIORITIES, current.testCase.priority)!,
    severity: patch.severity ?? current.testCase.severity,
    risk: patch.risk ?? current.testCase.risk,
    companyId: patch.companyId === undefined ? current.testCase.companyId : patch.companyId,
    applicationId:
      patch.applicationId !== undefined ? normalizeText(patch.applicationId) || null : current.testCase.applicationId,
    moduleId: patch.moduleId !== undefined ? normalizeText(patch.moduleId) || null : current.testCase.moduleId,
    testProjectCode:
      patch.testProjectCode !== undefined
        ? normalizeText(patch.testProjectCode)?.toUpperCase() || null
        : current.testCase.testProjectCode,
    testProjectName:
      patch.testProjectName !== undefined
        ? normalizeText(patch.testProjectName) || null
        : current.testCase.testProjectName,
    suiteId: patch.suiteId !== undefined ? normalizeText(patch.suiteId) || null : current.testCase.suiteId,
    suiteName: patch.suiteName !== undefined ? normalizeText(patch.suiteName) || null : current.testCase.suiteName,
    featureId: patch.featureId !== undefined ? normalizeText(patch.featureId) || null : current.testCase.featureId,
    tags: patch.tags ? normalizeTags(patch.tags) : current.testCase.tags,
    automationStatus: ensureAllowedEnum(
      "INVALID_TEST_CASE_AUTOMATION_STATUS",
      patch.automationStatus,
      TEST_CASE_AUTOMATION_STATUSES,
      current.testCase.automationStatus,
    )!,
    updatedBy: actorId,
    updatedAt: now,
  };

  const nextSteps = patch.steps
    ? buildNormalizedSteps(nextTestCase.id, patch.steps, now, current.steps)
    : current.steps.map((step) => ({ ...step, updatedAt: now }));

  const version = createTestCaseVersion(
    nextTestCase,
    nextSteps,
    (current.versions[0]?.version ?? 0) + 1,
    actorId,
  );

  const updated: TestCaseRecord = {
    ...current,
    testCase: nextTestCase,
    steps: nextSteps,
    versions: [version, ...current.versions],
  };

  manualRecords[index] = updated;
  await writeManualRecords(manualRecords);
  return updated;
}

export async function saveTestCaseAutomationLink(
  id: string,
  input: CreateTestAutomationLinkInput,
  actorId: string,
): Promise<TestCaseRecord | null> {
  const specFile = normalizeText(input.specFile);
  if (!specFile) {
    throw createDomainError("SPEC_FILE_REQUIRED");
  }

  const current = await getTestCaseRecord(id);
  if (!current) return null;

  const manualRecords = await readManualRecords();
  const manualIndex = manualRecords.findIndex((item) => item.testCase.id === current.testCase.id);
  const baseRecord = manualIndex >= 0 ? manualRecords[manualIndex] : current;
  const now = new Date().toISOString();
  const existingLink = baseRecord.automationLink;

  const normalizedTags = input.tags ? normalizeTags(input.tags) : existingLink?.tags ?? [];

  if (!input.allowDuplicate) {
    const records = await listTestCaseRecords();
    const duplicate = findAutomationDuplicate(records, baseRecord.testCase.id, specFile, normalizedTags);
    if (duplicate) {
      throw createDomainError("AUTOMATION_LINK_DUPLICATE", { duplicate });
    }
  }

  const automationLink: TestAutomationLink = {
    id: existingLink?.id ?? `${baseRecord.testCase.id}-automation`,
    testCaseId: baseRecord.testCase.id,
    provider: "playwright",
    repository: normalizeNullableText(input.repository) ?? existingLink?.repository ?? null,
    branch: normalizeNullableText(input.branch) ?? existingLink?.branch ?? null,
    specFile,
    testDescribe: normalizeNullableText(input.testDescribe) ?? existingLink?.testDescribe ?? null,
    testTitle: normalizeNullableText(input.testTitle) ?? existingLink?.testTitle ?? null,
    playwrightProject: normalizeNullableText(input.playwrightProject) ?? existingLink?.playwrightProject ?? null,
    environment: normalizeNullableText(input.environment) ?? existingLink?.environment ?? null,
    tags: normalizedTags,
    command: normalizeNullableText(input.command) ?? existingLink?.command ?? null,
    pomPath: normalizeNullableText(input.pomPath) ?? existingLink?.pomPath ?? null,
    fixtureNames: input.fixtureNames ? normalizeTags(input.fixtureNames) : existingLink?.fixtureNames ?? [],
    locatorStrategy: normalizeNullableText(input.locatorStrategy) ?? existingLink?.locatorStrategy ?? null,
    status: input.status ?? existingLink?.status ?? "pending",
    lastRunId: existingLink?.lastRunId ?? null,
    lastStatus: existingLink?.lastStatus,
    lastExecutedAt: existingLink?.lastExecutedAt ?? null,
    lastDurationMs: existingLink?.lastDurationMs ?? null,
    lastTraceUrl: existingLink?.lastTraceUrl ?? null,
    lastVideoUrl: existingLink?.lastVideoUrl ?? null,
    lastScreenshotUrl: existingLink?.lastScreenshotUrl ?? null,
    lastErrorMessage: existingLink?.lastErrorMessage ?? null,
    createdBy: existingLink?.createdBy ?? actorId,
    createdAt: existingLink?.createdAt ?? now,
    updatedAt: now,
  };

  const automationStatus = deriveAutomationStatus(automationLink.status);
  const nextTestCase: TestCase = {
    ...baseRecord.testCase,
    automationId: automationLink.id,
    automationStatus,
    type: deriveTestCaseType(baseRecord.testCase.type, automationStatus),
    updatedBy: actorId,
    updatedAt: now,
  };
  const version = createTestCaseVersion(
    nextTestCase,
    baseRecord.steps,
    (baseRecord.versions[0]?.version ?? 0) + 1,
    actorId,
  );
  const updated: TestCaseRecord = {
    ...baseRecord,
    testCase: nextTestCase,
    versions: [version, ...baseRecord.versions],
    automationLink,
  };

  if (manualIndex >= 0) {
    manualRecords[manualIndex] = updated;
  } else {
    manualRecords.unshift(updated);
  }

  await writeManualRecords(manualRecords);
  return updated;
}

export async function disableTestCaseAutomationLink(
  id: string,
  automationId: string,
  actorId: string,
): Promise<TestCaseRecord | null> {
  const current = await getTestCaseRecord(id);
  if (!current?.automationLink || current.automationLink.id !== automationId) return null;

  return saveTestCaseAutomationLink(
    id,
    {
      repository: current.automationLink.repository,
      branch: current.automationLink.branch,
      specFile: current.automationLink.specFile,
      testDescribe: current.automationLink.testDescribe,
      testTitle: current.automationLink.testTitle,
      playwrightProject: current.automationLink.playwrightProject,
      environment: current.automationLink.environment,
      tags: current.automationLink.tags,
      command: current.automationLink.command,
      pomPath: current.automationLink.pomPath,
      fixtureNames: current.automationLink.fixtureNames,
      locatorStrategy: current.automationLink.locatorStrategy,
      status: "disabled",
    },
    actorId,
  );
}

export async function archiveTestCaseRecord(id: string, actorId: string): Promise<TestCaseRecord | null> {
  return updateTestCaseRecord(
    id,
    {
      status: "archived",
      source: "manual",
      automationStatus: "none",
    },
    actorId,
  );
}

export function buildTestCaseMetrics(records: TestCaseRecord[]) {
  const total = records.length;
  const automated = records.filter((record) => record.testCase.type === "automated").length;
  const hybrid = records.filter((record) => record.testCase.type === "hybrid").length;
  const manual = records.filter((record) => record.testCase.type === "manual").length;
  const withoutAutomation = records.filter((record) => record.testCase.automationStatus === "none").length;
  const brokenAutomation = records.filter((record) => record.testCase.automationStatus === "broken").length;
  const neverExecuted = records.filter((record) => (record.testCase.lastExecutionStatus ?? "not_run") === "not_run").length;
  const failedRecently = records.filter((record) => record.testCase.lastExecutionStatus === "failed").length;

  return {
    total,
    automated,
    hybrid,
    manual,
    withoutAutomation,
    brokenAutomation,
    neverExecuted,
    failedRecently,
    automationCoverage: total > 0 ? Math.round(((automated + hybrid) / total) * 100) : 0,
  };
}
