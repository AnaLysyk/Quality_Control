import { type NextRequest, NextResponse } from "next/server";

import { isBrainNodeVisible, resolveBrainAccess, type BrainAccessContext } from "@/backend/brain/access";
import { canAccess } from "@/backend/permissions/can-access";
import { prisma } from "@/database/prismaClient";

function canManageMemory(access: BrainAccessContext) {
  return access.canManage || canAccess(access.userAccess, { moduleId: "brain", action: "manage_memories" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  if (!canManageMemory(accessResult.context)) {
    return NextResponse.json({ error: "Sem permissao para desativar memoria" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.brainMemory.findUnique({ where: { id }, include: { node: true } });
  if (!existing) return NextResponse.json({ error: "Memoria nao encontrada" }, { status: 404 });
  if (existing.node && !isBrainNodeVisible(existing.node, accessResult.context)) {
    return NextResponse.json({ error: "Sem permissao para esta memoria" }, { status: 403 });
  }

  const updated = await prisma.brainMemory.update({
    where: { id },
    data: {
      status: "INACTIVE",
      metadata: {
        ...(existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata) ? existing.metadata : {}),
        disabledBy: accessResult.context.user.id ?? accessResult.context.user.email ?? "unknown",
        disabledAt: new Date().toISOString(),
      },
    },
  });

  await prisma.brainAuditLog.create({
    data: {
      action: "DISABLE_MEMORY",
      entityType: "BrainMemory",
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
      userId: accessResult.context.user.id ?? accessResult.context.user.email ?? null,
      reason: "Memoria desativada na tela Memorias do Brain",
    },
  }).catch(() => null);

  return NextResponse.json({ memory: updated });
}
