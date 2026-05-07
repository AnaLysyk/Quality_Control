import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getJsonStorePath } from "@/data/jsonStorePath";
import { listSeedTestCaseRecords } from "./testCaseMappers";
import { createTestCaseVersion } from "./testCaseSnapshots";
import type {
  CreateTestCaseInput,
  TestCase,
  TestCaseAutomationStatus,
  TestCaseFilters,
  TestCaseRecord,
  TestCaseSource,
  TestCaseStatus,
  TestCaseType,
} from "./types";

const STORE_PATH = getJsonStorePath("test-cases-repository.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readManualRecords(): Promise<TestCaseRecord[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TestCaseRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeManualRecords(records: TestCaseRecord[]) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(records, null, 2), "utf8");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(tags: unknown) {
  return Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean)))
    : [];
}

function generateReadableKey(totalRecords: number) {
  return `TC-${String(totalRecords + 1).padStart(3, "0")}`;
}

function searchableText(record: TestCaseRecord) {
  return [
    record.testCase.key,
    record.testCase.externalKey,
    record.testCase.title,
    record.testCase.description,
    record.testCase.objective,
    record.testCase.applicationId,
    record.testCase.moduleId,
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
    if (!matchesFilterValue(testCase.applicationId, filters.applicationId)) return false;
    if (!matchesFilterValue(testCase.moduleId, filters.moduleId)) return false;
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
    throw new Error("TITLE_REQUIRED");
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
    type: input.type ?? "manual",
    status: input.status ?? "draft",
    priority: input.priority ?? "medium",
    severity: input.severity,
    risk: input.risk,
    companyId: input.companyId ?? null,
    applicationId: normalizeText(input.applicationId) || null,
    moduleId: normalizeText(input.moduleId) || null,
    featureId: normalizeText(input.featureId) || null,
    tags: normalizeTags(input.tags),
    lastExecutionStatus: "not_run",
    lastExecutedAt: null,
    automationStatus: "none",
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
  const steps = (input.steps ?? []).map((step, index) => ({
    id: `${id}-step-${index + 1}`,
    testCaseId: id,
    order: index + 1,
    action: normalizeText(step.action),
    expectedResult: normalizeText(step.expectedResult),
    data: normalizeText(step.data) || null,
    notes: normalizeText(step.notes) || null,
    createdAt: now,
    updatedAt: now,
  }));
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
