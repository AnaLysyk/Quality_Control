import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { listAutomationAgentRuns } from "@/backend/test-cases/automationDraftsStore";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const runs = await listAutomationAgentRuns(record.testCase.id);
  return NextResponse.json({ testCaseId: record.testCase.id, runs });
}
