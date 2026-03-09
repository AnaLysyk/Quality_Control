import { NextResponse } from "next/server";

import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalDeveloperWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";

type AdjustmentBody = {
  comment?: string | null;
};

function isFinalStatus(status: string | null | undefined) {
  return status === "closed" || status === "rejected";
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalDeveloperWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = (await req.json().catch(() => null)) as AdjustmentBody | null;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  if (!comment) {
    return NextResponse.json({ error: "Informe a mensagem de ajuste para o solicitante" }, { status: 400 });
  }

  const { id } = await context.params;

  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitacao finalizada nao aceita ajustes" }, { status: 409 });
    }

    const updated = await updateAccessRequest(id, { status: "in_progress" });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "in_progress",
      },
    });
  }

  try {
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitacao finalizada nao aceita ajustes" }, { status: 409 });
    }

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { status: "in_progress" },
    });

    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("[ACCESS-REQUESTS][REQUEST-ADJUSTMENT][PRISMA_FALLBACK]", error);
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(existing.message, existing.email))) {
      return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
    }
    if (isFinalStatus(existing.status)) {
      return NextResponse.json({ error: "Solicitacao finalizada nao aceita ajustes" }, { status: 409 });
    }

    const updated = await updateAccessRequest(id, { status: "in_progress" });
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: comment,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? "in_progress",
      },
    });
  }
}
