import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { listAutomationAgentRuns } from "@/lib/test-cases/automationDraftsStore";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "NÃ£o autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso nÃ£o encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissÃ£o" }, { status: 403 });
  }

  const runs = await listAutomationAgentRuns(record.testCase.id);
  return NextResponse.json({ testCaseId: record.testCase.id, runs });
}
