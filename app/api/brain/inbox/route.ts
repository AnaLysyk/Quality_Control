import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { reviewBrainAgentReview } from "@/lib/brain/agentReview";
import { brainPrisma } from "@/lib/brain/brainPrisma";
import { MEMORY_CANDIDATE_KIND } from "@/lib/brain/memoryCandidates";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
      status,
      ...(companySlug ? { companySlug } : {}),
    },
    include: {
      suggestion: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ items, total: items.length });
}

export async function PATCH(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: "approve" | "reject" | "merge" | "archive" | "review";
    note?: string;
    title?: string;
    summary?: string;
  };

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const item = await brainPrisma.brainInboxItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Item de inbox não encontrado" }, { status: 404 });
  }

  if (item.kind === MEMORY_CANDIDATE_KIND && body.action === "approve") {
    const payload = asRecord(item.payload);
    const title = body.title?.trim() || item.title;
    const summary = body.summary?.trim() || item.summary || "";
    const memoryType = typeof payload.memoryType === "string" ? payload.memoryType : "CONTEXT";
    const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : null;

    const memory = await brainPrisma.brainMemory.create({
      data: {
        title,
        summary,
        memoryType,
        importance: 3,
        relatedNodeIds: nodeId ? [nodeId] : [],
        sourceType: "CONVERSATION",
        sourceId: item.id,
        status: "ACTIVE",
        nodeId,
        metadata: {
          createdFrom: "conversation-memory-candidate",
          inboxItemId: item.id,
          requestedBy: payload.requestedBy ?? null,
          approvedBy: accessResult.context.user.id,
        },
      },
    });

    const updated = await brainPrisma.brainInboxItem.update({
      where: { id },
      data: {
        status: "merged",
        reviewedBy: accessResult.context.user.id,
        reviewedAt: new Date(),
        payload: { ...payload, memoryId: memory.id, reviewNote: body.note?.trim() || null },
      },
    });

    await brainPrisma.brainAuditLog.create({
      data: {
        action: "ADD_MEMORY",
        entityType: "BrainMemory",
        entityId: memory.id,
        userId: accessResult.context.user.id,
        reason: "Memoria criada a partir de candidato de conversa aprovado",
        after: { title: memory.title, memoryType: memory.memoryType, inboxItemId: item.id },
      },
    }).catch(() => null);

    return NextResponse.json({ item: updated, memory });
  }

  if (item.kind === "agent_operation_approval") {
    const action = body.action === "approve" || body.action === "reject" || body.action === "archive"
      ? body.action
      : "review";

    const updated = await reviewBrainAgentReview({
      id,
      action,
      reviewedBy: accessResult.context.user.id,
      note: body.note,
    });

    return NextResponse.json({ item: updated });
  }

  const action = body.action ?? "review";
  const statusByAction: Record<typeof action, string> = {
    approve: "approved",
    reject: "rejected",
    merge: "merged",
    archive: "archived",
    review: "needs_review",
  };

  const nextStatus = statusByAction[action];
  const updated = await brainPrisma.brainInboxItem.update({
    where: { id },
    data: {
      status: nextStatus,
      reviewedBy: accessResult.context.user.id,
      reviewedAt: new Date(),
      payload: {
        ...(typeof item.payload === "object" && item.payload ? (item.payload as Record<string, unknown>) : {}),
        reviewNote: body.note?.trim() || null,
      },
    },
  });

  if (item.suggestionId) {
    const suggestionStatus: Record<string, string> = {
      approved: "accepted",
      rejected: "rejected",
      merged: "resolved",
      archived: "archived",
      needs_review: "suggested",
    };

    await brainPrisma.brainSuggestion.update({
      where: { id: item.suggestionId },
      data: {
        status: suggestionStatus[nextStatus] ?? "suggested",
      },
    });
  }

  return NextResponse.json({ item: updated });
}
