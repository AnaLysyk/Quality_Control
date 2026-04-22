import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getJsonStorePath } from "@/data/jsonStorePath";
import {
  createDefaultTestPlanAutomationState,
  normalizeTestPlanAutomationState,
  normalizeTestPlanCase,
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
  automation: TestPlanAutomationState;
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

async function readStore(): Promise<ManualTestPlanRecord[]> {
  try {
    await ensureFile();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeManualTestPlanRecord(item))
      .filter((item): item is ManualTestPlanRecord => item !== null);
  } catch {
    return [];
  }
}

async function writeStore(items: ManualTestPlanRecord[]) {
  await ensureFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

function normalizeIsoDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeManualTestPlanRecord(raw: unknown): ManualTestPlanRecord | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const companySlug =
    typeof record.companySlug === "string" ? record.companySlug.trim().toLowerCase() : "";
  const applicationId = typeof record.applicationId === "string" ? record.applicationId.trim() : "";
  const applicationName =
    typeof record.applicationName === "string" ? record.applicationName.trim() : "";
  const applicationSlug =
    typeof record.applicationSlug === "string" ? record.applicationSlug.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";

  if (!id || !companySlug || !applicationId || !applicationName || !applicationSlug || !title) {
    return null;
  }

  const cases = Array.isArray(record.cases)
    ? record.cases
        .map((item, index) => normalizeTestPlanCase(item, `case_${index + 1}`))
        .filter((item): item is TestPlanCase => item !== null)
    : [];

  return {
    id,
    companySlug,
    applicationId,
    applicationName,
    applicationSlug,
    projectCode: typeof record.projectCode === "string" ? record.projectCode.trim() || null : null,
    title,
    description: typeof record.description === "string" ? record.description.trim() || null : null,
    cases,
    automation: normalizeTestPlanAutomationState(record.automation),
    createdAt: normalizeIsoDate(record.createdAt),
    updatedAt: normalizeIsoDate(record.updatedAt),
  };
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
  input: Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt" | "automation"> & {
    automation?: TestPlanAutomationState;
  },
) {
  const items = await readStore();
  const now = new Date().toISOString();
  const created: ManualTestPlanRecord = {
    ...input,
    automation: input.automation ?? createDefaultTestPlanAutomationState(false),
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
  patch: Partial<Omit<ManualTestPlanRecord, "id" | "companySlug" | "createdAt" | "updatedAt">>,
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
    automation: patch.automation
      ? normalizeTestPlanAutomationState(patch.automation, current.automation.enabled)
      : current.automation,
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
