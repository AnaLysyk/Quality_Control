import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { getAutomationDraft, recordAutomationAgentRun, updateAutomationDraft } from "@/lib/test-cases/automationDraftsStore";
import type { AutomationQualityScore } from "@/lib/test-cases/types";

type ReviewOutput = {
  score: number;
  hasTag: boolean;
  hasTestStep: boolean;
  hasExpect: boolean;
  hasResilientLocators: boolean;
  risks: string[];
  notes: string;
  qualityScore: AutomationQualityScore;
  locatorPolicy: {
    blocked: boolean;
    reasons: string[];
    justificationAccepted: boolean;
  };
};

type BaseReviewOutput = Omit<ReviewOutput, "qualityScore" | "locatorPolicy">;

function evaluateLocatorPolicy(code: string, justification: string | null) {
  const reasons: string[] = [];
  const lower = code.toLowerCase();

  if (lower.includes("nth(")) {
    reasons.push("Uso de nth() detectado (instável por mudança de layout).");
  }
  if (/locator\(\s*["'`]\/\//i.test(code) || /xpath=/i.test(lower)) {
    reasons.push("XPath detectado (proibido por política padrão).");
  }
  if (/locator\(\s*["'`][^"'`]*(>|:nth-child|:nth-of-type|\.\w+\s+\w+)/i.test(code)) {
    reasons.push("CSS locator potencialmente frágil detectado.");
  }

  const hasJustification = Boolean(justification && justification.trim().length >= 12);
  return {
    blocked: reasons.length > 0 && !hasJustification,
    reasons,
    justificationAccepted: hasJustification,
  };
}

function buildQualityScore(review: {
  score: number;
  hasExpect: boolean;
  hasResilientLocators: boolean;
  hasTag: boolean;
  hasTestStep: boolean;
  risks: string[];
}, locatorPolicyBlocked: boolean, actorId: string): AutomationQualityScore {
  return {
    totalScore: Math.max(0, review.score - (locatorPolicyBlocked ? 30 : 0)),
    locators: review.hasResilientLocators && !locatorPolicyBlocked ? "good" : review.hasResilientLocators ? "medium" : "poor",
    assertions: review.hasExpect ? "sufficient" : "weak",
    pom: "not_required",
    fixtures: "no",
    traceability: review.hasTag && review.hasTestStep ? "ok" : "missing",
    flakinessRisk: locatorPolicyBlocked || review.risks.length >= 3 ? "high" : review.risks.length >= 1 ? "medium" : "low",
    security: locatorPolicyBlocked ? "risk" : "ok",
    reviewedAt: new Date().toISOString(),
    reviewedBy: actorId,
  };
}

function buildReview(draftCode: string, caseKey: string): BaseReviewOutput {
  const lowerCode = draftCode.toLowerCase();
  const hasTag = lowerCode.includes(`@${caseKey.toLowerCase()}`);
  const hasTestStep = lowerCode.includes("test.step(");
  const hasExpect = lowerCode.includes("expect(");
  const hasResilientLocators =
    lowerCode.includes("getbyrole(") || lowerCode.includes("getbytestid(") || lowerCode.includes("getbylabel(");

  const risks: string[] = [];
  if (!hasTag) risks.push("Script sem tag do caso para rastreabilidade.");
  if (!hasTestStep) risks.push("Script sem test.step para mapear passos manuais.");
  if (!hasExpect) risks.push("Script sem assertions expect().");
  if (!hasResilientLocators) risks.push("Locators resilientes não detectados (getByRole/getByTestId/getByLabel).");

  const score = [hasTag, hasTestStep, hasExpect, hasResilientLocators].filter(Boolean).length * 25;
  return {
    score,
    hasTag,
    hasTestStep,
    hasExpect,
    hasResilientLocators,
    risks,
    notes: risks.length ? "Revisão concluída com recomendações." : "Revisão concluída sem riscos críticos.",
  };
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
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const locatorJustification = typeof body?.locatorJustification === "string" ? body.locatorJustification : null;
  if (!draftId) return NextResponse.json({ message: "draftId é obrigatório" }, { status: 400 });

  const draft = await getAutomationDraft(record.testCase.id, draftId);
  if (!draft) return NextResponse.json({ message: "Draft não encontrado" }, { status: 404 });

  const baseReview = buildReview(draft.specCode ?? "", record.testCase.key || record.testCase.id);
  const locatorPolicy = evaluateLocatorPolicy(draft.specCode ?? "", locatorJustification);
  const qualityScore = buildQualityScore(baseReview, locatorPolicy.blocked, user.id);
  const review: ReviewOutput = {
    ...baseReview,
    qualityScore,
    locatorPolicy,
  };
  const reviewNotes = `${draft.reviewNotes ? `${draft.reviewNotes}\n` : ""}[ReviewAgent] score=${review.score} - ${review.notes}`;

  if (locatorPolicy.blocked) {
    const blockedReason = `Policy gate bloqueou draft: ${locatorPolicy.reasons.join(" ")}`;
    const blockedDraft = await updateAutomationDraft(record.testCase.id, draftId, {
      reviewNotes: `${reviewNotes}\n${blockedReason}`,
      qualityScore,
      maturityStatus: "review",
      approvalState: "awaiting_qa_review",
    });

    await recordAutomationAgentRun(
      record.testCase.id,
      user.id,
      "ReviewAgent",
      {
        draftId,
        testCaseKey: record.testCase.key || record.testCase.id,
        locatorJustification,
      },
      review,
      "failed",
      blockedReason,
    );

    return NextResponse.json(
      {
        testCaseId: record.testCase.id,
        draft: blockedDraft,
        review,
        message: blockedReason,
      },
      { status: 422 },
    );
  }

  const updated = await updateAutomationDraft(record.testCase.id, draftId, {
    reviewNotes,
    qualityScore,
    maturityStatus: "review",
    approvalState: "awaiting_qa_review",
  });

  await recordAutomationAgentRun(
    record.testCase.id,
    user.id,
    "ReviewAgent",
    {
      draftId,
      testCaseKey: record.testCase.key || record.testCase.id,
      locatorJustification,
    },
    review,
    "completed",
  );

  return NextResponse.json({
    testCaseId: record.testCase.id,
    draft: updated,
    review,
  });
}
