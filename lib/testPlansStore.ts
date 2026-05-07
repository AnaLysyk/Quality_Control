import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getJsonStorePath } from "@/data/jsonStorePath";
import {
  normalizeTestPlanAutomationState,
  parseTestPlanCases,
  type TestPlanAutomationState,
  type TestPlanCase,
} from "@/lib/testPlanCases";

export type ManualTestPlanRecord = {
  id: string;
  companySlug: string;
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  projectCode?: string | null;
  title: string;
  description?: string | null;
  cases: TestPlanCase[];
  automation?: TestPlanAutomationState;
  createdAt: string;
  updatedAt: string;
};

const STORE_PATH = getJsonStorePath("manual-test-plans.json");

async function ensureFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRequiredString(value: unknown, fallback: string) {
  return normalizeOptionalString(value) ?? fallback;
}

function normalizeManualTestPlanRecord(raw: unknown): ManualTestPlanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = normalizeOptionalString(record.id);
  const companySlug = normalizeOptionalString(record.companySlug)?.toLowerCase();
  const applicationId = normalizeOptionalString(record.applicationId);
  const applicationName = normalizeOptionalString(record.applicationName);
  const applicationSlug = normalizeOptionalString(record.applicationSlug)?.toLowerCase();
  const title = normalizeOptionalString(record.title);
  if (!id || !companySlug || !applicationId || !applicationName || !applicationSlug || !title) {
    return null;
  }

  return {
    id,
    companySlug,
    applicationId,
    applicationName,
    applicationSlug,
    projectCode: normalizeOptionalString(record.projectCode),
    title,
    description: normalizeOptionalString(record.description),
    cases: parseTestPlanCases(record.cases),
    automation: normalizeTestPlanAutomationState(record.automation),
    createdAt: normalizeRequiredString(record.createdAt, new Date().toISOString()),
    updatedAt: normalizeRequiredString(record.updatedAt, new Date().toISOString()),
  };
}

async function readStore(): Promise<ManualTestPlanRecord[]> {
  try {
    await ensureFile();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .map((item) => normalizeManualTestPlanRecord(item))
          .filter((item): item is ManualTestPlanRecord => item !== null)
      : [];
  } catch {
    return [];
  }
}

async function writeStore(items: ManualTestPlanRecord[]) {
  await ensureFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function listManualTestPlans(filter: {
  companySlug: string;
  applicationId?: string | null;
}) {
  const companySlug = filter.companySlug.trim().toLowerCase();
  const applicationId = filter.applicationId?.trim() || null;
  const items = await readStore();
  return items.filter((item) => {
    if (item.companySlug.trim().toLowerCase() !== companySlug) return false;
    if (applicationId && item.applicationId !== applicationId) return false;
    return true;
  });
}

export async function getManualTestPlan(input: {
  companySlug: string;
  id: string;
}) {
  const items = await listManualTestPlans({ companySlug: input.companySlug });
  return items.find((item) => item.id === input.id) ?? null;
}

export async function createManualTestPlan(
  input: Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">,
) {
  const items = await readStore();
  const now = new Date().toISOString();
  const created: ManualTestPlanRecord = {
    ...input,
    companySlug: input.companySlug.trim().toLowerCase(),
    applicationSlug: input.applicationSlug.trim().toLowerCase(),
    projectCode: normalizeOptionalString(input.projectCode),
    description: normalizeOptionalString(input.description),
    cases: parseTestPlanCases(input.cases),
    automation: normalizeTestPlanAutomationState(input.automation),
    id: `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  items.unshift(created);
  await writeStore(items);
  return created;
}

export async function updateManualTestPlan(
  companySlug: string,
  id: string,
  patch: Partial<Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const normalizedCompanySlug = companySlug.trim().toLowerCase();
  const items = await readStore();
  const index = items.findIndex(
    (item) => item.id === id && item.companySlug.trim().toLowerCase() === normalizedCompanySlug,
  );
  if (index < 0) return null;

  const current = items[index];
  const updated: ManualTestPlanRecord = {
    ...current,
    ...patch,
    ...(patch.companySlug ? { companySlug: patch.companySlug.trim().toLowerCase() } : {}),
    ...(patch.applicationSlug ? { applicationSlug: patch.applicationSlug.trim().toLowerCase() } : {}),
    ...(patch.projectCode !== undefined ? { projectCode: normalizeOptionalString(patch.projectCode) } : {}),
    ...(patch.description !== undefined ? { description: normalizeOptionalString(patch.description) } : {}),
    ...(patch.cases !== undefined ? { cases: parseTestPlanCases(patch.cases) } : {}),
    ...(patch.automation !== undefined ? { automation: normalizeTestPlanAutomationState(patch.automation) } : {}),
    updatedAt: new Date().toISOString(),
  };
  items[index] = updated;
  await writeStore(items);
  return updated;
}

export async function deleteManualTestPlan(companySlug: string, id: string) {
  const normalizedCompanySlug = companySlug.trim().toLowerCase();
  const items = await readStore();
  const next = items.filter(
    (item) => !(item.id === id && item.companySlug.trim().toLowerCase() === normalizedCompanySlug),
  );
  const deleted = next.length !== items.length;
  if (deleted) {
    await writeStore(next);
  }
  return deleted;
}
