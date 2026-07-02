import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import {
  archiveTestCaseRecord,
  getTestCaseRecord,
  updateTestCaseRecord,
} from "@/lib/test-cases/testCaseRepository";
import {
  canAccessTestCaseRecord,
  canCreateTestCaseForCompany,
} from "@/lib/test-cases/testCasePermissions";
import {
  TEST_CASE_AUTOMATION_STATUSES,
  TEST_CASE_PRIORITIES,
  TEST_CASE_SOURCES,
  TEST_CASE_STATUSES,
  TEST_CASE_TYPES,
  type CreateTestCaseInput,
  type TestCaseAutomationStatus,
  type TestCasePriority,
  type TestCaseSource,
  type TestCaseStatus,
  type TestCaseType,
} from "@/lib/test-cases/types";

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function mapTestCaseError(error: unknown) {
  if (!(error instanceof Error)) return null;

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

function normalizePayload(
  body: Record<string, unknown>,
): Partial<CreateTestCaseInput> & {
  source?: TestCaseSource;
  status?: TestCaseStatus;
  type?: TestCaseType;
  priority?: TestCasePriority;
  automationStatus?: TestCaseAutomationStatus;
  companyId?: string | null;
} {
  return {
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    objective: typeof body.objective === "string" ? body.objective : undefined,
    preconditions: typeof body.preconditions === "string" ? body.preconditions : undefined,
    postconditions: typeof body.postconditions === "string" ? body.postconditions : undefined,
    source: pickEnum(body.source, TEST_CASE_SOURCES),
    type: pickEnum(body.type, TEST_CASE_TYPES),
    status: pickEnum(body.status, TEST_CASE_STATUSES),
    priority: pickEnum(body.priority, TEST_CASE_PRIORITIES),
    severity: pickEnum(body.severity, TEST_CASE_PRIORITIES),
    risk: pickEnum(body.risk, TEST_CASE_PRIORITIES),
    companyId:
      typeof body.companySlug === "string"
        ? body.companySlug
        : typeof body.companyId === "string"
          ? body.companyId
          : undefined,
    applicationId: typeof body.applicationId === "string" ? body.applicationId : undefined,
    moduleId: typeof body.moduleId === "string" ? body.moduleId : undefined,
    testProjectCode:
      typeof body.testProjectCode === "string"
        ? body.testProjectCode
        : typeof body.projectCode === "string"
          ? body.projectCode
          : undefined,
    testProjectName: typeof body.testProjectName === "string" ? body.testProjectName : undefined,
    suiteId: typeof body.suiteId === "string" ? body.suiteId : undefined,
    suiteName: typeof body.suiteName === "string" ? body.suiteName : undefined,
    featureId: typeof body.featureId === "string" ? body.featureId : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    steps: Array.isArray(body.steps)
      ? body.steps
          .map((step) => {
            if (!step || typeof step !== "object") return null;
            const record = step as Record<string, unknown>;
            if (typeof record.action !== "string" || typeof record.expectedResult !== "string") return null;
            return {
              action: record.action,
              expectedResult: record.expectedResult,
              data: typeof record.data === "string" ? record.data : undefined,
              notes: typeof record.notes === "string" ? record.notes : undefined,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : undefined,
    automationStatus: pickEnum(body.automationStatus, TEST_CASE_AUTOMATION_STATUSES),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão para acessar este caso" }, { status: 403 });
  }

  return NextResponse.json(record);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existing = await getTestCaseRecord(id);
  if (!existing) return NextResponse.json({ message: "Não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, existing)) {
    return NextResponse.json({ message: "Sem permissão para alterar este caso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const payload = normalizePayload(body);
  const nextCompanySlug = payload.companyId ?? existing.testCase.companyId;

  if (!canCreateTestCaseForCompany(user, nextCompanySlug)) {
    return NextResponse.json({ message: "Sem permissão para alterar este caso neste contexto" }, { status: 403 });
  }

  try {
    const updated = await updateTestCaseRecord(id, payload, user.id);
    if (!updated) return NextResponse.json({ message: "Não encontrado" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error) {
    const mapped = mapTestCaseError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existing = await getTestCaseRecord(id);
  if (!existing) return NextResponse.json({ message: "Não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, existing)) {
    return NextResponse.json({ message: "Sem permissão para arquivar este caso" }, { status: 403 });
  }

  const archived = await archiveTestCaseRecord(id, user.id);
  if (!archived) return NextResponse.json({ message: "Não encontrado" }, { status: 404 });

  return NextResponse.json(archived);
}

