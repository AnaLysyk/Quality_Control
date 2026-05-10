import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim().toLowerCase() || "pending";
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || null;

  const items = await prisma.brainInboxItem.findMany({
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
  };

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
  }

  const item = await prisma.brainInboxItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Item de inbox não encontrado" }, { status: 404 });
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
  const updated = await prisma.brainInboxItem.update({
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

    await prisma.brainSuggestion.update({
      where: { id: item.suggestionId },
      data: {
        status: suggestionStatus[nextStatus] ?? "suggested",
      },
    });
  }

  return NextResponse.json({ item: updated });
}
