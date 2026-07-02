import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeTestPlanAutomationState,
  normalizeTestPlanCaseAutomation,
  normalizeTestPlanSource,
  parseTestPlanCases,
  type TestPlanSource,
  type TestPlanAutomationState,
  type TestPlanCase,
} from "@/lib/testPlanCases";
import { shouldUseJsonStore } from "@/lib/storeMode";

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const USE_JSON_STORE = shouldUseJsonStore();
const TEST_PLAN_STORE_PATH = path.join(
  process.env.LOCAL_AUTH_DATA_DIR || path.join(process.cwd(), "data"),
  "manual-test-plans.json",
);

export type ManualTestPlanRecord = {
  id: string;
  companySlug: string;
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  projectCode?: string | null;
  projectId?: string | null;
  source: TestPlanSource;
  title: string;
  description?: string | null;
  cases: TestPlanCase[];
  automation?: TestPlanAutomationState;
  createdAt: string;
  updatedAt: string;
};

type ManualTestPlanStore = {
  items: ManualTestPlanRecord[];
};

function normalizeCompanySlug(value: string) {
  return value.trim().toLowerCase();
}

function generatePlanId() {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readManualTestPlanStore(): Promise<ManualTestPlanStore> {
  if (!USE_JSON_STORE) return { items: [] };

  try {
    const raw = await readFile(TEST_PLAN_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ManualTestPlanStore> | null;
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return { items: [] };
  }
}

async function writeManualTestPlanStore(store: ManualTestPlanStore) {
  if (!USE_JSON_STORE) return;
  await mkdir(path.dirname(TEST_PLAN_STORE_PATH), { recursive: true });
  await writeFile(TEST_PLAN_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toStoredCaseLinks(value: unknown): TestPlanCase[] {
  const parsed = parseTestPlanCases(value);
  return parsed.map((item) => ({
    id: item.id,
    ...(item.automation
      ? { automation: normalizeTestPlanCaseAutomation(item.automation) }
      : {}),
  }));
}

function rowToRecord(row: {
  id: string;
  companySlug: string;
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  projectCode: string | null;
  projectId?: string | null;
  title: string;
  description: string | null;
  cases: unknown;
  automation: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ManualTestPlanRecord {
  const automation = normalizeTestPlanAutomationState(row.automation);
  const automationRecord = asRecord(row.automation);
  return {
    id: row.id,
    companySlug: row.companySlug,
    applicationId: row.applicationId,
    applicationName: row.applicationName,
    applicationSlug: row.applicationSlug,
    projectCode: row.projectCode,
    projectId: row.projectId ?? null,
    title: row.title,
    description: row.description,
    cases: parseTestPlanCases(row.cases),
    source: normalizeTestPlanSource(automation.source ?? automationRecord?.source),
    automation: {
      ...automation,
      source: normalizeTestPlanSource(automation.source ?? automationRecord?.source),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listManualTestPlans(filter: {
  companySlug: string;
  applicationId?: string | null;
  projectId?: string | null;
}) {
  if (USE_JSON_STORE) {
    const companySlug = normalizeCompanySlug(filter.companySlug);
    const store = await readManualTestPlanStore();
    return store.items
      .filter((item) => item.companySlug === companySlug)
      .filter(
        (item) =>
          !filter.applicationId?.trim() ||
          item.applicationId === filter.applicationId.trim(),
      )
      .filter(
        (item) =>
          !filter.projectId?.trim() ||
          item.projectId === filter.projectId.trim(),
      )
      .sort(
        (left, right) =>
          (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0),
      );
  }

  const prisma = await getPrisma();
  const companySlug = normalizeCompanySlug(filter.companySlug);
  const rows = await prisma.manualTestPlan.findMany({
    where: {
      companySlug,
      ...(filter.applicationId?.trim()
        ? { applicationId: filter.applicationId.trim() }
        : {}),
      ...(filter.projectId?.trim()
        ? { projectId: filter.projectId.trim() }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToRecord);
}

export async function getManualTestPlan(input: {
  companySlug: string;
  id: string;
}) {
  if (USE_JSON_STORE) {
    const store = await readManualTestPlanStore();
    return (
      store.items.find(
        (item) =>
          item.id === input.id &&
          item.companySlug === normalizeCompanySlug(input.companySlug),
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  const row = await prisma.manualTestPlan.findFirst({
    where: {
      id: input.id,
      companySlug: normalizeCompanySlug(input.companySlug),
    },
  });
  return row ? rowToRecord(row) : null;
}

export async function createManualTestPlan(
  input: Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">,
) {
  if (USE_JSON_STORE) {
    const store = await readManualTestPlanStore();
    const now = new Date().toISOString();
    const record: ManualTestPlanRecord = {
      id: generatePlanId(),
      companySlug: normalizeCompanySlug(input.companySlug),
      applicationId: input.applicationId,
      applicationName: input.applicationName,
      applicationSlug: input.applicationSlug.trim().toLowerCase(),
      projectCode: normalizeOptionalString(input.projectCode),
      projectId: normalizeOptionalString(input.projectId),
      source: normalizeTestPlanSource(input.source),
      title: input.title,
      description: normalizeOptionalString(input.description),
      cases: toStoredCaseLinks(input.cases),
      automation: input.automation
        ? normalizeTestPlanAutomationState(input.automation)
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    store.items.unshift(record);
    await writeManualTestPlanStore(store);
    return record;
  }

  const prisma = await getPrisma();
  const automation = normalizeTestPlanAutomationState(input.automation);
  const row = await prisma.manualTestPlan.create({
    data: {
      id: generatePlanId(),
      companySlug: normalizeCompanySlug(input.companySlug),
      applicationId: input.applicationId,
      applicationName: input.applicationName,
      applicationSlug: input.applicationSlug.trim().toLowerCase(),
      projectCode: normalizeOptionalString(input.projectCode),
      projectId: normalizeOptionalString(input.projectId),
      automation: {
        ...automation,
        source: normalizeTestPlanSource(input.source),
      } as object,
      title: input.title,
      description: normalizeOptionalString(input.description),
      cases: toStoredCaseLinks(input.cases) as object,
    },
  });
  return rowToRecord(row);
}

export async function updateManualTestPlan(
  companySlug: string,
  id: string,
  patch: Partial<Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">>,
) {
  if (USE_JSON_STORE) {
    const normalizedCompanySlug = normalizeCompanySlug(companySlug);
    const store = await readManualTestPlanStore();
    const index = store.items.findIndex(
      (item) => item.id === id && item.companySlug === normalizedCompanySlug,
    );
    if (index < 0) return null;

    const current = store.items[index];
    const updated: ManualTestPlanRecord = {
      ...current,
      ...(patch.companySlug
        ? { companySlug: normalizeCompanySlug(patch.companySlug) }
        : {}),
      ...(patch.applicationId !== undefined
        ? { applicationId: patch.applicationId }
        : {}),
      ...(patch.applicationName !== undefined
        ? { applicationName: patch.applicationName }
        : {}),
      ...(patch.applicationSlug !== undefined
        ? { applicationSlug: patch.applicationSlug.trim().toLowerCase() }
        : {}),
      ...(patch.projectCode !== undefined
        ? { projectCode: normalizeOptionalString(patch.projectCode) }
        : {}),
      ...(patch.projectId !== undefined
        ? { projectId: normalizeOptionalString(patch.projectId) }
        : {}),
      ...(patch.source !== undefined
        ? { source: normalizeTestPlanSource(patch.source) }
        : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined
        ? { description: normalizeOptionalString(patch.description) }
        : {}),
      ...(patch.cases !== undefined ? { cases: toStoredCaseLinks(patch.cases) } : {}),
      ...(patch.automation !== undefined
        ? { automation: normalizeTestPlanAutomationState(patch.automation) }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    store.items[index] = updated;
    await writeManualTestPlanStore(store);
    return updated;
  }

  const prisma = await getPrisma();
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const existing = await prisma.manualTestPlan.findFirst({
    where: { id, companySlug: normalizedCompanySlug },
  });
  if (!existing) return null;
  const row = await prisma.manualTestPlan.update({
    where: { id },
    data: {
      ...(patch.companySlug
        ? { companySlug: normalizeCompanySlug(patch.companySlug) }
        : {}),
      ...(patch.applicationId !== undefined
        ? { applicationId: patch.applicationId }
        : {}),
      ...(patch.applicationName !== undefined
        ? { applicationName: patch.applicationName }
        : {}),
      ...(patch.applicationSlug !== undefined
        ? { applicationSlug: patch.applicationSlug.trim().toLowerCase() }
        : {}),
      ...(patch.projectCode !== undefined
        ? { projectCode: normalizeOptionalString(patch.projectCode) }
        : {}),
      ...(patch.projectId !== undefined
        ? { projectId: normalizeOptionalString(patch.projectId) }
        : {}),
      ...(patch.source !== undefined
        ? {
            automation: {
              ...normalizeTestPlanAutomationState(existing.automation),
              source: normalizeTestPlanSource(patch.source),
            } as object,
          }
        : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined
        ? { description: normalizeOptionalString(patch.description) }
        : {}),
      ...(patch.cases !== undefined
        ? { cases: toStoredCaseLinks(patch.cases) as object }
        : {}),
      ...(patch.automation !== undefined
        ? {
            automation:
              (normalizeTestPlanAutomationState(patch.automation) ?? {}) as object,
          }
        : {}),
    },
  });
  return rowToRecord(row);
}

export async function deleteManualTestPlan(companySlug: string, id: string) {
  if (USE_JSON_STORE) {
    const normalizedCompanySlug = normalizeCompanySlug(companySlug);
    const store = await readManualTestPlanStore();
    const before = store.items.length;
    store.items = store.items.filter(
      (item) => !(item.id === id && item.companySlug === normalizedCompanySlug),
    );
    if (store.items.length === before) return false;
    await writeManualTestPlanStore(store);
    return true;
  }

  const prisma = await getPrisma();
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const existing = await prisma.manualTestPlan.findFirst({
    where: { id, companySlug: normalizedCompanySlug },
  });
  if (!existing) return false;
  await prisma.manualTestPlan.delete({ where: { id } });
  return true;
}

