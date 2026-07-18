import { type NextRequest, NextResponse } from "next/server";

import { isBrainNodeVisible, resolveBrainAccess, type BrainAccessContext } from "@/backend/brain/access";
import { canAccess } from "@/backend/permissions/can-access";
import { prisma } from "@/database/prismaClient";

const VALID_MEMORY_TYPES = new Set(["RULE", "DECISION", "PATTERN", "CONTEXT", "EXCEPTION", "TECHNICAL_NOTE", "QA_NOTE", "SYSTEM_EVENT"]);

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeMemoryType(value: unknown, fallback: string) {
  const text = asString(value).toUpperCase();
  return VALID_MEMORY_TYPES.has(text) ? text : fallback;
}

function normalizeImportance(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function canManageMemory(access: BrainAccessContext) {
  return access.canManage || canAccess(access.userAccess, { moduleId: "brain", action: "manage_memories" });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  if (!canManageMemory(accessResult.context)) {
    return NextResponse.json({ error: "Sem permissao para editar memoria" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.brainMemory.findUnique({ where: { id }, include: { node: true } });
  if (!existing) return NextResponse.json({ error: "Memoria nao encontrada" }, { status: 404 });
  if (existing.node && !isBrainNodeVisible(existing.node, accessResult.context)) {
    return NextResponse.json({ error: "Sem permissao para esta memoria" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.brainMemory.update({
    where: { id },
    data: {
      title: asString(body.title) || existing.title,
      summary: asString(body.summary) || existing.summary,
      memoryType: normalizeMemoryType(body.memoryType, existing.memoryType),
      importance: normalizeImportance(body.importance, existing.importance),
      sourceType: asString(body.sourceType) || existing.sourceType,
      sourceId: asString(body.sourceId) || existing.sourceId,
      metadata: {
        ...asRecord(existing.metadata),
        ...asRecord(body.metadata),
        updatedBy: accessResult.context.user.id ?? accessResult.context.user.email ?? "unknown",
      },
    },
    include: { node: true },
  });

  await prisma.brainAuditLog.create({
    data: {
      action: "UPDATE_MEMORY",
      entityType: "BrainMemory",
      entityId: id,
      before: { title: existing.title, memoryType: existing.memoryType, status: existing.status },
      after: { title: updated.title, memoryType: updated.memoryType, status: updated.status },
      userId: accessResult.context.user.id ?? accessResult.context.user.email ?? null,
      reason: "Memoria editada na tela Memorias do Brain",
    },
  }).catch(() => null);

  return NextResponse.json({ memory: updated });
}
