import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { getAutomationDraft, recordAutomationAgentRun, updateAutomationDraft } from "@/backend/test-cases/automationDraftsStore";
import type { AutomationApprovalState, TestCaseAutomationStatus } from "@/backend/test-cases/types";

type ApprovalAction = "request_qa_review" | "approve_publish" | "approve_execution" | "approve_healing" | "reset";

function canTransition(current: AutomationApprovalState, next: AutomationApprovalState) {
  if (current === next) return true;
  if (next === "none") return true;
  if (current === "none" && next === "awaiting_qa_review") return true;
  if (current === "awaiting_qa_review" && ["approved_for_publish", "approved_for_execution", "approved_for_healing"].includes(next)) {
    return true;
  }
  if (["approved_for_publish", "approved_for_execution", "approved_for_healing"].includes(current) && next === "awaiting_qa_review") {
    return true;
  }
  return false;
}

function toNextState(action: ApprovalAction): AutomationApprovalState {
  if (action === "request_qa_review") return "awaiting_qa_review";
  if (action === "approve_publish") return "approved_for_publish";
  if (action === "approve_execution") return "approved_for_execution";
  if (action === "approve_healing") return "approved_for_healing";
  return "none";
}

function resolveMaturity(nextState: AutomationApprovalState, currentMaturity: TestCaseAutomationStatus | undefined): TestCaseAutomationStatus {
  if (nextState === "awaiting_qa_review") return "review";
  if (nextState === "approved_for_publish") return "approved";
  if (nextState === "approved_for_execution") return "approved";
  if (nextState === "approved_for_healing") return "review";
  return currentMaturity ?? "ai_generated";
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; draftId: string }> }) {
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
  const action = typeof body?.action === "string" ? (body.action as ApprovalAction) : null;
  if (!action || !["request_qa_review", "approve_publish", "approve_execution", "approve_healing", "reset"].includes(action)) {
    return NextResponse.json(
      { message: "Ação inválida. Use request_qa_review, approve_publish, approve_execution, approve_healing ou reset." },
      { status: 400 },
    );
  }

  const currentState: AutomationApprovalState = draft.approvalState ?? "none";
  const nextState = toNextState(action);
  if (!canTransition(currentState, nextState)) {
    return NextResponse.json(
      { message: `Transição inválida: ${currentState} -> ${nextState}.` },
      { status: 409 },
    );
  }

  const updated = await updateAutomationDraft(record.testCase.id, draftId, {
    approvalState: nextState,
    maturityStatus: resolveMaturity(nextState, draft.maturityStatus),
    reviewNotes: `${draft.reviewNotes ? `${draft.reviewNotes}\n` : ""}[ApprovalFlow] ${currentState} -> ${nextState}`,
  });

  await recordAutomationAgentRun(
    record.testCase.id,
    user.id,
    "ApprovalStateMachine",
    {
      draftId,
      action,
      from: currentState,
    },
    {
      to: nextState,
      maturityStatus: updated?.maturityStatus,
    },
    "completed",
  );

  return NextResponse.json({
    testCaseId: record.testCase.id,
    draft: updated,
  });
}

