import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { createAutomationDraft, listAutomationDrafts } from "@/lib/test-cases/automationDraftsStore";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const drafts = await listAutomationDrafts(record.testCase.id);
  return NextResponse.json({ testCaseId: record.testCase.id, drafts });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const draft = await createAutomationDraft(record.testCase.id, user.id, {
    generatedBy: body.generatedBy === "user" ? "user" : "ai",
    status:
      body.status === "approved" || body.status === "linked" || body.status === "discarded" || body.status === "draft"
        ? body.status
        : "draft",
    specFile: typeof body.specFile === "string" ? body.specFile : undefined,
    specCode: typeof body.specCode === "string" ? body.specCode : undefined,
    pomPath: typeof body.pomPath === "string" ? body.pomPath : undefined,
    pomCode: typeof body.pomCode === "string" ? body.pomCode : undefined,
    fixturePath: typeof body.fixturePath === "string" ? body.fixturePath : undefined,
    fixtureCode: typeof body.fixtureCode === "string" ? body.fixtureCode : undefined,
    command: typeof body.command === "string" ? body.command : undefined,
    reviewNotes: typeof body.reviewNotes === "string" ? body.reviewNotes : undefined,
  });

  return NextResponse.json({ testCaseId: record.testCase.id, draft }, { status: 201 });
}