import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createManualTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { canCreateTestCaseForCompany } from "@/lib/test-cases/testCasePermissions";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { CreateTestCaseInput } from "@/lib/test-cases/types";

type ImportPayload = {
  cases?: Array<CreateTestCaseInput & { companySlug?: string | null }>;
  sourceFileName?: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  return normalizeText(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCase(input: CreateTestCaseInput & { companySlug?: string | null }): CreateTestCaseInput {
  const companySlug = input.companySlug ?? input.companyId ?? null;
  return {
    title: normalizeText(input.title),
    description: normalizeText(input.description) || undefined,
    objective: normalizeText(input.objective) || undefined,
    preconditions: normalizeText(input.preconditions) || undefined,
    postconditions: normalizeText(input.postconditions) || undefined,
    source: input.source || "import",
    type: input.type || "manual",
    status: input.status || "active",
    priority: input.priority || "medium",
    severity: input.severity || undefined,
    risk: input.risk || undefined,
    companyId: companySlug,
    projectId: input.projectId ?? null,
    applicationId: normalizeText(input.applicationId) || null,
    moduleId: normalizeText(input.moduleId) || null,
    testProjectCode: normalizeText(input.testProjectCode) || null,
    testProjectName: normalizeText(input.testProjectName) || null,
    suiteId: normalizeText(input.suiteId) || null,
    suiteName: normalizeText(input.suiteName) || null,
    featureId: normalizeText(input.featureId) || null,
    tags: normalizeTags(input.tags),
    steps: (input.steps ?? [])
      .map((step) => ({
        action: normalizeText(step.action),
        expectedResult: normalizeText(step.expectedResult),
        data: normalizeText(step.data) || null,
        notes: normalizeText(step.notes) || null,
      }))
      .filter((step) => step.action && step.expectedResult),
  };
}

function mapImportError(error: unknown) {
  if (!(error instanceof Error)) return "Erro desconhecido ao importar caso.";
  if (error.message === "TITLE_REQUIRED") return "Título é obrigatório.";
  if (error.message === "STEP_ACTION_REQUIRED") return "Cada passo precisa de ação.";
  if (error.message === "STEP_EXPECTED_RESULT_REQUIRED") return "Cada passo precisa de resultado esperado.";
  if (error.message.startsWith("INVALID_TEST_CASE_")) return "Campo de classificação inválido. Verifique source, type, status, priority ou automation.";
  return error.message || "Erro ao importar caso.";
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const payload = (await req.json().catch(() => null)) as ImportPayload | null;
  const inputCases = Array.isArray(payload?.cases) ? payload.cases : [];
  if (!inputCases.length) {
    return NextResponse.json({ message: "Nenhum caso enviado para importação" }, { status: 400 });
  }

  if (inputCases.length > 500) {
    return NextResponse.json({ message: "Limite de 500 casos por importação" }, { status: 400 });
  }

  const created = [];
  const errors: Array<{ index: number; title?: string; message: string }> = [];

  for (const [index, rawCase] of inputCases.entries()) {
    const normalized = normalizeCase(rawCase);
    const companySlug = normalized.companyId ?? null;

    if (!canCreateTestCaseForCompany(user, companySlug, normalized.projectId)) {
      errors.push({ index: index + 1, title: normalized.title, message: "Sem permissão para criar caso neste contexto" });
      continue;
    }

    try {
      const record = await createManualTestCaseRecord(normalized, user.id);
      created.push(record);
      writeAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "import",
        entityType: "TestCase",
        entityId: record.testCase.id,
        entityLabel: record.testCase.title,
        metadata: {
          companyId: companySlug,
          projectId: normalized.projectId ?? null,
          sourceFileName: payload?.sourceFileName ?? null,
          importIndex: index + 1,
        },
      });
    } catch (error) {
      errors.push({ index: index + 1, title: normalized.title, message: mapImportError(error) });
    }
  }

  return NextResponse.json(
    {
      created: created.length,
      failed: errors.length,
      total: inputCases.length,
      items: created,
      errors,
    },
    { status: created.length > 0 ? 201 : 400 },
  );
}

