import "server-only";

import {
  normalizeTestPlanAutomationState,
  normalizeTestPlanCaseAutomation,
  parseTestPlanCases,
  type TestPlanAutomationState,
  type TestPlanCase,
} from "@/lib/testPlanCases";

async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

export type ManualTestPlanRecord = {
  id: string;
  companySlug: string;
  applicationId: string;
  applicationName: string;
  applicationSlug: string;
  projectCode?: string | null;
  projectId?: string | null;
  title: string;
  description?: string | null;
  cases: TestPlanCase[];
  automation?: TestPlanAutomationState;
  createdAt: string;
  updatedAt: string;
};

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function toStoredCaseLinks(value: unknown): TestPlanCase[] {
  const parsed = parseTestPlanCases(value);
  return parsed.map((item) => ({
    id: item.id,
    ...(item.automation ? { automation: normalizeTestPlanCaseAutomation(item.automation) } : {}),
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
    automation: normalizeTestPlanAutomationState(row.automation),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listManualTestPlans(filter: {
  companySlug: string;
  applicationId?: string | null;
  projectId?: string | null;
}) {
  const prisma = await getPrisma();
  const companySlug = filter.companySlug.trim().toLowerCase();
  const rows = await prisma.manualTestPlan.findMany({
    where: {
      companySlug,
      ...(filter.applicationId?.trim() ? { applicationId: filter.applicationId.trim() } : {}),
      ...(filter.projectId?.trim() ? { projectId: filter.projectId.trim() } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToRecord);
}

export async function getManualTestPlan(input: { companySlug: string; id: string }) {
  const prisma = await getPrisma();
  const row = await prisma.manualTestPlan.findFirst({
    where: {
      id: input.id,
      companySlug: input.companySlug.trim().toLowerCase(),
    },
  });
  return row ? rowToRecord(row) : null;
}

export async function createManualTestPlan(
  input: Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">,
) {
  const prisma = await getPrisma();
  const row = await prisma.manualTestPlan.create({
    data: {
      id: `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      companySlug: input.companySlug.trim().toLowerCase(),
      applicationId: input.applicationId,
      applicationName: input.applicationName,
      applicationSlug: input.applicationSlug.trim().toLowerCase(),
      projectCode: normalizeOptionalString(input.projectCode),
      projectId: normalizeOptionalString(input.projectId),
      title: input.title,
      description: normalizeOptionalString(input.description),
      cases: toStoredCaseLinks(input.cases) as object,
      automation: (normalizeTestPlanAutomationState(input.automation) ?? {}) as object,
    },
  });
  return rowToRecord(row);
}

export async function updateManualTestPlan(
  companySlug: string,
  id: string,
  patch: Partial<Omit<ManualTestPlanRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const prisma = await getPrisma();
  const normalizedCompanySlug = companySlug.trim().toLowerCase();
  const existing = await prisma.manualTestPlan.findFirst({
    where: { id, companySlug: normalizedCompanySlug },
  });
  if (!existing) return null;
  const row = await prisma.manualTestPlan.update({
    where: { id },
    data: {
      ...(patch.companySlug ? { companySlug: patch.companySlug.trim().toLowerCase() } : {}),
      ...(patch.applicationId !== undefined ? { applicationId: patch.applicationId } : {}),
      ...(patch.applicationName !== undefined ? { applicationName: patch.applicationName } : {}),
      ...(patch.applicationSlug !== undefined ? { applicationSlug: patch.applicationSlug.trim().toLowerCase() } : {}),
      ...(patch.projectCode !== undefined ? { projectCode: normalizeOptionalString(patch.projectCode) } : {}),
      ...(patch.projectId !== undefined ? { projectId: normalizeOptionalString(patch.projectId) } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: normalizeOptionalString(patch.description) } : {}),
      ...(patch.cases !== undefined ? { cases: toStoredCaseLinks(patch.cases) as object } : {}),
      ...(patch.automation !== undefined ? { automation: (normalizeTestPlanAutomationState(patch.automation) ?? {}) as object } : {}),
    },
  });
  return rowToRecord(row);
}

export async function deleteManualTestPlan(companySlug: string, id: string) {
  const prisma = await getPrisma();
  const normalizedCompanySlug = companySlug.trim().toLowerCase();
  const existing = await prisma.manualTestPlan.findFirst({
    where: { id, companySlug: normalizedCompanySlug },
  });
  if (!existing) return false;
  await prisma.manualTestPlan.delete({ where: { id } });
  return true;
}


