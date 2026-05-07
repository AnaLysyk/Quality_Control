import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createManualTestCaseRecord, buildTestCaseMetrics, listTestCaseRecords } from "@/lib/test-cases/testCaseRepository";
import { canCreateTestCaseForCompany, filterTestCasesByPermission } from "@/lib/test-cases/testCasePermissions";
import type { CreateTestCaseInput, TestCaseFilters } from "@/lib/test-cases/types";

function filtersFromUrl(url: URL): TestCaseFilters {
  return {
    query: url.searchParams.get("query"),
    companyId: url.searchParams.get("companyId"),
    applicationId: url.searchParams.get("applicationId"),
    moduleId: url.searchParams.get("moduleId"),
    type: url.searchParams.get("type") as TestCaseFilters["type"],
    source: url.searchParams.get("source") as TestCaseFilters["source"],
    status: url.searchParams.get("status") as TestCaseFilters["status"],
    priority: url.searchParams.get("priority") as TestCaseFilters["priority"],
    automationStatus: url.searchParams.get("automationStatus") as TestCaseFilters["automationStatus"],
    tag: url.searchParams.get("tag"),
  };
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const records = await listTestCaseRecords(filtersFromUrl(url));
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

  const payload = (await req.json()) as CreateTestCaseInput;
  if (!canCreateTestCaseForCompany(user, payload.companyId)) {
    return NextResponse.json({ message: "Sem permissão para criar caso neste contexto" }, { status: 403 });
  }

  try {
    const record = await createManualTestCaseRecord(payload, user.id);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "TITLE_REQUIRED") {
      return NextResponse.json({ message: "Título é obrigatório" }, { status: 400 });
    }
    throw error;
  }
}
