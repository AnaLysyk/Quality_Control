import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { buildTestCaseMetrics, listTestCaseRecords } from "@/lib/test-cases/testCaseRepository";
import { filterTestCasesByPermission } from "@/lib/test-cases/testCasePermissions";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "NÃ£o autorizado" }, { status: 401 });

  const records = await listTestCaseRecords();
  const visibleRecords = filterTestCasesByPermission(records, user);

  return NextResponse.json(buildTestCaseMetrics(visibleRecords));
}

