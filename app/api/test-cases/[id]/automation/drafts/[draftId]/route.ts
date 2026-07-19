import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord, saveTestCaseAutomationLink } from "@/backend/test-cases/testCaseRepository";
import { getAutomationDraft, updateAutomationDraft, updateAutomationDraftStatus } from "@/backend/test-cases/automationDraftsStore";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id, draftId } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const draft = await getAutomationDraft(record.testCase.id, draftId);
  if (!draft) return NextResponse.json({ message: "Draft não encontrado" }, { status: 404 });

  return NextResponse.json(draft);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id, draftId } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const draft = await getAutomationDraft(record.testCase.id, draftId);
  if (!draft) return NextResponse.json({ message: "Draft não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "approve") {
    const statusUpdated = await updateAutomationDraftStatus(record.testCase.id, draftId, "approved");
    const updated = statusUpdated
      ? await updateAutomationDraft(record.testCase.id, draftId, {
          approvalState: "approved_for_publish",
          maturityStatus: "approved",
        })
      : null;
    return NextResponse.json({ testCaseId: record.testCase.id, draft: updated });
  }

  if (action === "discard") {
    const statusUpdated = await updateAutomationDraftStatus(record.testCase.id, draftId, "discarded");
    const updated = statusUpdated
      ? await updateAutomationDraft(record.testCase.id, draftId, {
          approvalState: "none",
          maturityStatus: "disabled",
        })
      : null;
    return NextResponse.json({ testCaseId: record.testCase.id, draft: updated });
  }

  if (action === "link") {
    if (!draft.specFile) {
      return NextResponse.json({ message: "Draft sem specFile não pode ser vinculado." }, { status: 400 });
    }

    const linked = await saveTestCaseAutomationLink(
      record.testCase.id,
      {
        specFile: draft.specFile,
        testTitle: draft.specFile ? draft.specFile.split("/").pop() ?? draft.specFile : undefined,
        command: draft.command ?? undefined,
        status: "active",
      },
      user.id,
    );

    if (!linked) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });

    const statusUpdated = await updateAutomationDraftStatus(record.testCase.id, draftId, "linked");
    const updated = statusUpdated
      ? await updateAutomationDraft(record.testCase.id, draftId, {
          maturityStatus: "linked",
        })
      : null;
    return NextResponse.json({
      testCaseId: linked.testCase.id,
      draft: updated,
      testCase: linked.testCase,
      automationLink: linked.automationLink,
    });
  }

  return NextResponse.json({ message: "Ação inválida. Use approve, link ou discard." }, { status: 400 });
}
