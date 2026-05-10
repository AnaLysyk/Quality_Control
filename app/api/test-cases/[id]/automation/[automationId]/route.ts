import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import {
  disableTestCaseAutomationLink,
  getTestCaseRecord,
  saveTestCaseAutomationLink,
} from "@/lib/test-cases/testCaseRepository";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import type { CreateTestAutomationLinkInput } from "@/lib/test-cases/types";

function normalizeBody(body: Record<string, unknown>): Partial<CreateTestAutomationLinkInput> {
  return {
    repository: typeof body.repository === "string" ? body.repository : undefined,
    branch: typeof body.branch === "string" ? body.branch : undefined,
    specFile: typeof body.specFile === "string" ? body.specFile : undefined,
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; automationId: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id, automationId } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }
  if (!record.automationLink || record.automationLink.id !== automationId) {
    return NextResponse.json({ message: "Vínculo não encontrado" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  try {
    const patch = normalizeBody(body);
    const updated = await saveTestCaseAutomationLink(
      id,
      {
        repository: patch.repository ?? record.automationLink.repository,
        branch: patch.branch ?? record.automationLink.branch,
        specFile: patch.specFile ?? record.automationLink.specFile,
        testDescribe: patch.testDescribe ?? record.automationLink.testDescribe,
        testTitle: patch.testTitle ?? record.automationLink.testTitle,
        playwrightProject: patch.playwrightProject ?? record.automationLink.playwrightProject,
        environment: patch.environment ?? record.automationLink.environment,
        tags: patch.tags ?? record.automationLink.tags,
        command: patch.command ?? record.automationLink.command,
        pomPath: patch.pomPath ?? record.automationLink.pomPath,
        fixtureNames: patch.fixtureNames ?? record.automationLink.fixtureNames,
        locatorStrategy: patch.locatorStrategy ?? record.automationLink.locatorStrategy,
        status: patch.status ?? record.automationLink.status,
        allowDuplicate: patch.allowDuplicate,
      },
      user.id,
    );
    if (!updated) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });

    return NextResponse.json({
      testCaseId: updated.testCase.id,
      testCase: updated.testCase,
      steps: updated.steps,
      automationLink: updated.automationLink,
    });
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; automationId: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id, automationId } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const updated = await disableTestCaseAutomationLink(id, automationId, user.id);
  if (!updated) return NextResponse.json({ message: "Vínculo não encontrado" }, { status: 404 });

  return NextResponse.json({
    testCaseId: updated.testCase.id,
    testCase: updated.testCase,
    steps: updated.steps,
    automationLink: updated.automationLink,
  });
}