import "server-only";

import type { TestCaseRecord } from "@/backend/test-cases/types";
import { createQaseClient } from "@/backend/qaseSdk";

function externalCaseId(record: TestCaseRecord) {
  const values = [record.testCase.externalId, record.testCase.externalKey?.split("-").at(-1)];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function buildCasePayload(record: TestCaseRecord) {
  return {
    title: record.testCase.title,
    description: record.testCase.description ?? null,
    preconditions: record.testCase.preconditions ?? null,
    postconditions: record.testCase.postconditions ?? null,
    priority: record.testCase.priority,
    severity: record.testCase.severity ?? record.testCase.priority,
    tags: record.testCase.tags,
    steps: record.steps.map((step) => ({
      action: step.action,
      expected_result: step.expectedResult,
      data: step.data ?? null,
    })),
  };
}

export async function syncTestCaseWithLinkedQaseProject(record: TestCaseRecord) {
  const projectId = record.testCase.projectId;
  if (!projectId) return { integrated: false as const };

  const { prisma } = await import("@/database/prismaClient");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      qaseProjectCode: true,
      company: { select: { qase_token: true } },
    },
  });
  const projectCode = project?.qaseProjectCode?.trim().toUpperCase();
  const token = project?.company.qase_token?.trim();
  if (!projectCode || !token) return { integrated: false as const };

  const client = createQaseClient({ token, defaultFetchOptions: { cache: "no-store" } });
  const caseId = externalCaseId(record);
  if (caseId) {
    await client.updateCase(projectCode, caseId, buildCasePayload(record));
    return {
      integrated: true as const,
      operation: "updated" as const,
      projectCode,
      caseId,
      externalKey: `${projectCode}-${caseId}`,
      externalUrl: `https://app.qase.io/case/${encodeURIComponent(projectCode)}/${caseId}`,
    };
  }

  const response = await client.createCase(projectCode, buildCasePayload(record));
  const createdId = Number(response?.result?.id);
  if (!Number.isInteger(createdId) || createdId <= 0) throw new Error("Qase não retornou o identificador do caso criado.");
  return {
    integrated: true as const,
    operation: "created" as const,
    projectCode,
    caseId: createdId,
    externalKey: `${projectCode}-${createdId}`,
    externalUrl: `https://app.qase.io/case/${encodeURIComponent(projectCode)}/${createdId}`,
  };
}
