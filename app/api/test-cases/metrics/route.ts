import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { buildTestCaseMetrics, listTestCaseRecords } from "@/backend/test-cases/testCaseRepository";
import { filterTestCasesByPermission } from "@/backend/test-cases/testCasePermissions";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const records = await listTestCaseRecords();
  const visibleRecords = filterTestCasesByPermission(records, user);

  return NextResponse.json(buildTestCaseMetrics(visibleRecords));
}

