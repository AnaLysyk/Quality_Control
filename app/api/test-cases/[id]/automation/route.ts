import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTestCaseRecord, saveTestCaseAutomationLink } from "@/lib/test-cases/testCaseRepository";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import type { CreateTestAutomationLinkInput } from "@/lib/test-cases/types";

function normalizeBody(body: Record<string, unknown>): CreateTestAutomationLinkInput {
  return {
    repository: typeof body.repository === "string" ? body.repository : undefined,
    branch: typeof body.branch === "string" ? body.branch : undefined,
    specFile: typeof body.specFile === "string" ? body.specFile : "",
    testDescribe: typeof body.testDescribe === "string" ? body.testDescribe : undefined,
    testTitle: typeof body.testTitle === "string" ? body.testTitle : undefined,
    playwrightProject: typeof body.playwrightProject === "string" ? body.playwrightProject : undefined,
    environment: typeof body.environment === "string" ? body.environment : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((item): item is string => typeof item === "string") : undefined,
    command: typeof body.command === "string" ? body.command : undefined,
    pomPath: typeof body.pomPath === "string" ? body.pomPath : undefined,
    fixtureNames: Array.isArray(body.fixtureNames)
      ? body.fixtureNames.filter((item): item is string => typeof item === "string")
      : undefined,
    locatorStrategy: typeof body.locatorStrategy === "string" ? body.locatorStrategy : undefined,
    status:
      body.status === "active" || body.status === "broken" || body.status === "pending" || body.status === "disabled"
        ? body.status
        : undefined,
    allowDuplicate: body.allowDuplicate === true,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  return NextResponse.json({
    testCaseId: record.testCase.id,
    testCase: record.testCase,
    steps: record.steps,
    automationLink: record.automationLink,
  });
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

  try {
    const updated = await saveTestCaseAutomationLink(id, normalizeBody(body), user.id);
    if (!updated) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });

    return NextResponse.json(
      {
        testCaseId: updated.testCase.id,
        testCase: updated.testCase,
        steps: updated.steps,
        automationLink: updated.automationLink,
      },
      { status: record.automationLink ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "SPEC_FILE_REQUIRED") {
      return NextResponse.json({ message: "Spec file é obrigatório" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "AUTOMATION_LINK_DUPLICATE") {
      const duplicate = (error as Error & { duplicate?: unknown }).duplicate;
      return NextResponse.json(
        {
          message: "Já existe um vínculo com o mesmo par spec/tag",
          duplicate,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
