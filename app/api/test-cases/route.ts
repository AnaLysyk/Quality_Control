import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import {
  buildTestCaseMetrics,
  createManualTestCaseRecord,
  listTestCaseRecords,
} from "@/lib/test-cases/testCaseRepository";
import {
  canCreateTestCaseForCompany,
  filterTestCasesByPermission,
} from "@/lib/test-cases/testCasePermissions";
import { listIntegratedQaseTestCaseRecords } from "@/lib/test-projects/testProjectsRepository";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { CreateTestCaseInput, TestCaseFilters } from "@/lib/test-cases/types";

function mapTestCaseError(error: unknown) {
  if (!(error instanceof Error)) return null;

  if (error.message === "TITLE_REQUIRED") {
    return NextResponse.json({ message: "Título é obrigatório" }, { status: 400 });
  }

  if (error.message === "STEP_ACTION_REQUIRED") {
    return NextResponse.json({ message: "Cada passo precisa de ação" }, { status: 400 });
  }

  if (error.message === "STEP_EXPECTED_RESULT_REQUIRED") {
    return NextResponse.json({ message: "Cada passo precisa de resultado esperado" }, { status: 400 });
  }

  if (
    error.message === "INVALID_TEST_CASE_SOURCE" ||
    error.message === "INVALID_TEST_CASE_TYPE" ||
    error.message === "INVALID_TEST_CASE_STATUS" ||
    error.message === "INVALID_TEST_CASE_PRIORITY" ||
    error.message === "INVALID_TEST_CASE_AUTOMATION_STATUS"
  ) {
    return NextResponse.json({ message: "Campos de classificação inválidos" }, { status: 400 });
  }

  return null;
}

function filtersFromUrl(url: URL): TestCaseFilters {
  return {
    query: url.searchParams.get("query"),
    companyId: url.searchParams.get("companySlug") ?? url.searchParams.get("companyId"),
    projectId: url.searchParams.get("projectId"),
    applicationId: url.searchParams.get("applicationId"),
    moduleId: url.searchParams.get("moduleId"),
    projectCode: url.searchParams.get("projectCode") ?? url.searchParams.get("project"),
    suiteId: url.searchParams.get("suiteId"),
    type: url.searchParams.get("type") as TestCaseFilters["type"],
    source: url.searchParams.get("source") as TestCaseFilters["source"],
    status: url.searchParams.get("status") as TestCaseFilters["status"],
    priority: url.searchParams.get("priority") as TestCaseFilters["priority"],
    automationStatus: url.searchParams.get("automationStatus") as TestCaseFilters["automationStatus"],
    tag: url.searchParams.get("tag"),
  };
}

function matchesFilterValue(value: string | null | undefined, filter: string | null | undefined) {
  if (!filter || filter === "all") return true;
  return String(value ?? "").trim().toLowerCase() === filter.trim().toLowerCase();
}

function matchesTestCaseFilters(record: Awaited<ReturnType<typeof listTestCaseRecords>>[number], filters: TestCaseFilters) {
  const testCase = record.testCase;
  const query = String(filters.query ?? "").trim().toLowerCase();
  if (query) {
    const haystack = [
      testCase.key,
      testCase.externalKey,
      testCase.externalUrl,
      testCase.title,
      testCase.description,
      testCase.applicationId,
      testCase.moduleId,
      testCase.testProjectCode,
      testCase.testProjectName,
      testCase.suiteId,
      testCase.suiteName,
      testCase.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (!matchesFilterValue(testCase.companyId, filters.companyId)) return false;
  if (filters.projectId && testCase.projectId !== filters.projectId) return false;
  if (!matchesFilterValue(testCase.applicationId, filters.applicationId)) return false;
  if (!matchesFilterValue(testCase.moduleId, filters.moduleId)) return false;
  if (!matchesFilterValue(testCase.suiteId, filters.suiteId)) return false;
  if (!matchesFilterValue(testCase.source, filters.source as string | null | undefined)) return false;
  if (!matchesFilterValue(testCase.status, filters.status as string | null | undefined)) return false;
  if (!matchesFilterValue(testCase.type, filters.type as string | null | undefined)) return false;
  if (!matchesFilterValue(testCase.priority, filters.priority as string | null | undefined)) return false;
  if (!matchesFilterValue(testCase.automationStatus, filters.automationStatus as string | null | undefined)) return false;
  if (filters.projectCode) {
    const projectCode = String(filters.projectCode).trim().toUpperCase();
    const testProjectCode = String(testCase.testProjectCode ?? testCase.externalKey?.split("-")[0] ?? "").trim().toUpperCase();
    if (testProjectCode !== projectCode) return false;
  }
  if (filters.tag && !testCase.tags.includes(filters.tag)) return false;
  return true;
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const filters = filtersFromUrl(url);
  const includeIntegrated = String(url.searchParams.get("includeIntegrated") ?? "true").toLowerCase() !== "false";
  const localRecords = await listTestCaseRecords(filters);
  const integratedRecords =
    includeIntegrated && filters.companyId
      ? await listIntegratedQaseTestCaseRecords({
          companySlug: filters.companyId,
          applicationId: filters.applicationId,
          projectCode: filters.projectCode,
        })
      : [];
  const recordsById = new Map<string, (typeof localRecords)[number]>();
  for (const record of localRecords.filter((item) => matchesTestCaseFilters(item, filters))) recordsById.set(record.testCase.id, record);
  for (const record of integratedRecords.filter((item) => matchesTestCaseFilters(item, filters))) recordsById.set(record.testCase.id, record);
  const records = Array.from(recordsById.values());
  const visibleRecords = filterTestCasesByPermission(records, user);

  return NextResponse.json({
    items: visibleRecords,
    total: visibleRecords.length,
    metrics: buildTestCaseMetrics(visibleRecords),
  });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const payload = (await req.json()) as CreateTestCaseInput & { companySlug?: string | null };
  const companySlug = payload.companySlug ?? payload.companyId ?? null;

  if (!canCreateTestCaseForCompany(user, companySlug)) {
    return NextResponse.json({ message: "Sem permissão para criar caso neste contexto" }, { status: 403 });
  }

  try {
    const record = await createManualTestCaseRecord(
      {
        ...payload,
        companyId: companySlug,
        testProjectCode:
          typeof payload.testProjectCode === "string"
            ? payload.testProjectCode
            : typeof (payload as Record<string, unknown>).projectCode === "string"
              ? String((payload as Record<string, unknown>).projectCode)
              : undefined,
      },
      user.id,
    );
    writeAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "create",
      entityType: "TestCase",
      entityId: record.testCase.id,
      entityLabel: record.testCase.title,
      metadata: { companyId: companySlug, projectId: payload.projectId ?? null },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const mapped = mapTestCaseError(error);
    if (mapped) return mapped;
    throw error;
  }
}
