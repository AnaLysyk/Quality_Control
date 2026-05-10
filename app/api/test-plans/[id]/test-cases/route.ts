import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { listTestCaseRecords } from "@/lib/test-cases/testCaseRepository";
import { canAccessTestCaseRecord, canCreateTestCaseForCompany } from "@/lib/test-cases/testCasePermissions";
import { getManualTestPlan, updateManualTestPlan } from "@/lib/testPlansStore";

function normalizeIdList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

async function resolveCasesByIds(ids: string[]) {
  if (!ids.length) return [];

  const records = await listTestCaseRecords();
  const byId = new Map(records.map((record) => [record.testCase.id, record]));

  return ids.map((id) => {
    const record = byId.get(id);
    if (!record) {
      throw new Error(`TEST_CASE_NOT_FOUND:${id}`);
    }
    return record;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id: planId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const companySlug = String(body.companySlug ?? user.companySlug ?? "").trim().toLowerCase();
  const testCaseIds = normalizeIdList(body.testCaseIds);
  if (!companySlug || !testCaseIds.length) {
    return NextResponse.json({ message: "companySlug e testCaseIds são obrigatórios" }, { status: 400 });
  }

  const plan = await getManualTestPlan({ companySlug, id: planId });
  if (!plan) return NextResponse.json({ message: "Plano não encontrado" }, { status: 404 });

  try {
    const records = await resolveCasesByIds(testCaseIds);
    for (const record of records) {
      if (!canAccessTestCaseRecord(user, record)) {
        return NextResponse.json({ message: "Sem permissão para vincular um ou mais casos" }, { status: 403 });
      }
      if (!canCreateTestCaseForCompany(user, record.testCase.companyId)) {
        return NextResponse.json({ message: "Sem permissão para vincular um ou mais casos" }, { status: 403 });
      }
    }

    const existingIds = new Set(plan.cases.map((item) => item.id));
    const nextCases = [
      ...plan.cases,
      ...records
        .filter((record) => !existingIds.has(record.testCase.id))
        .map((record) => ({
          id: record.testCase.id,
          title: record.testCase.title,
          description: record.testCase.description ?? null,
          preconditions: record.testCase.preconditions ?? null,
          postconditions: record.testCase.postconditions ?? null,
          severity: record.testCase.severity ?? null,
          link: null,
          steps: record.steps.map((step) => ({
            id: step.id,
            action: step.action,
            expectedResult: step.expectedResult,
            data: step.data ?? null,
          })),
        })),
    ];

    const updated = await updateManualTestPlan(companySlug, planId, { cases: nextCases });
    if (!updated) return NextResponse.json({ message: "Plano não encontrado" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      cases: updated.cases,
      total: updated.cases.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TEST_CASE_NOT_FOUND:")) {
      return NextResponse.json({ message: "Um ou mais casos não foram encontrados no repositório central" }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id: planId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const companySlug = String(body.companySlug ?? user.companySlug ?? "").trim().toLowerCase();
  const testCaseIds = new Set(normalizeIdList(body.testCaseIds));
  if (!companySlug || !testCaseIds.size) {
    return NextResponse.json({ message: "companySlug e testCaseIds são obrigatórios" }, { status: 400 });
  }

  const plan = await getManualTestPlan({ companySlug, id: planId });
  if (!plan) return NextResponse.json({ message: "Plano não encontrado" }, { status: 404 });

  const nextCases = plan.cases.filter((item) => !testCaseIds.has(item.id));
  const updated = await updateManualTestPlan(companySlug, planId, { cases: nextCases });
  if (!updated) return NextResponse.json({ message: "Plano não encontrado" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    cases: updated.cases,
    total: updated.cases.length,
  });
}