import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import {
  createBrainAgentReview,
  reviewBrainAgentReview,
  type BrainAgentReviewAction,
} from "@/lib/brain/agentReview";
import { brainPrisma } from "@/lib/brain/brainPrisma";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readAction(value: unknown): BrainAgentReviewAction {
  return value === "approve" || value === "reject" || value === "review" || value === "archive"
    ? value
    : "review";
}

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim().toLowerCase() || "pending";
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || null;

  const items = await brainPrisma.brainInboxItem.findMany({
    where: {
      kind: "agent_operation_approval",
      status,
      ...(companySlug ? { companySlug } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = asRecord(await req.json().catch(() => ({})));
  const companySlug = typeof body.companySlug === "string" ? body.companySlug.trim().toLowerCase() : null;
  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : accessResult.context.userAccess.companyId;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : null;

  const item = await createBrainAgentReview({
    requestedBy: accessResult.context.user.id,
    companySlug,
    companyId,
    projectId,
    title: typeof body.title === "string" ? body.title : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    operationType: typeof body.operationType === "string" ? body.operationType : undefined,
    target: typeof body.target === "string" ? body.target : undefined,
    reason: typeof body.reason === "string" ? body.reason : null,
    riskLevel: body.riskLevel === "low" || body.riskLevel === "medium" || body.riskLevel === "high" || body.riskLevel === "critical" ? body.riskLevel : "medium",
    proposedPayload: asRecord(body.proposedPayload),
  });

  return NextResponse.json({ item, status: "pending_user_acceptance" }, { status: 201 });
}

export async function PATCH(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = asRecord(await req.json().catch(() => ({})));
  const id = typeof body.id === "string" ? body.id.trim() : "";

  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const item = await reviewBrainAgentReview({
    id,
    action: readAction(body.action),
    reviewedBy: accessResult.context.user.id,
    note: typeof body.note === "string" ? body.note : null,
  });

  return NextResponse.json({ item });
}
