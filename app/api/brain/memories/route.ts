import { type NextRequest, NextResponse } from "next/server";

import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { isBrainNodeVisible, resolveBrainAccess, type BrainAccessContext } from "@/lib/brain/access";
import { canAccess } from "@/lib/permissions/can-access";
import { prisma } from "@/database/prismaClient";

const VALID_MEMORY_TYPES = new Set([
  "RULE",
  "DECISION",
  "PATTERN",
  "CONTEXT",
  "EXCEPTION",
  "TECHNICAL_NOTE",
  "QA_NOTE",
  "SYSTEM_EVENT",
]);

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeMemoryType(value: unknown) {
  const text = asString(value).toUpperCase();
  return VALID_MEMORY_TYPES.has(text) ? text : "CONTEXT";
}

function normalizeImportance(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 2;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function canWriteMemory(access: BrainAccessContext) {
  return (
    access.canManage ||
    canAccess(access.userAccess, { moduleId: "brain", action: "manage_memories" }) ||
    canAccess(access.userAccess, { moduleId: "brain", action: "use" })
  );
}

function serializeMemory(memory: {
  id: string;
  title: string;
  summary: string;
  memoryType: string;
  importance: number;
  status: string;
  sourceType?: string | null;
  sourceId?: string | null;
  nodeId?: string | null;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
  node?: { id: string; label: string; type: string; refType?: string | null; refId?: string | null; metadata?: unknown } | null;
}) {
  const metadata = asRecord(memory.metadata);
  return {
    id: memory.id,
    title: memory.title,
    summary: memory.summary,
    memoryType: memory.memoryType,
    importance: memory.importance,
    status: memory.status,
    sourceType: memory.sourceType ?? null,
    sourceId: memory.sourceId ?? null,
    nodeId: memory.nodeId ?? null,
    node: memory.node ? {
      id: memory.node.id,
      label: memory.node.label,
      type: memory.node.type,
      refType: memory.node.refType ?? null,
      refId: memory.node.refId ?? null,
    } : null,
    createdBy: typeof metadata.createdBy === "string" ? metadata.createdBy : null,
    usedIn: Array.isArray(metadata.usedIn) ? metadata.usedIn : [],
    metadata,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const q = normalizeBrainText(url.searchParams.get("q") ?? "");
  const type = url.searchParams.get("type")?.trim().toUpperCase() ?? "";
  const nodeId = url.searchParams.get("nodeId") ?? undefined;
  const source = normalizeBrainText(url.searchParams.get("source") ?? "");
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const memories = await prisma.brainMemory.findMany({
    where: {
      ...(includeInactive ? {} : { status: "ACTIVE" }),
      ...(VALID_MEMORY_TYPES.has(type) ? { memoryType: type } : {}),
      ...(nodeId ? { nodeId } : {}),
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    include: { node: true },
    take: 240,
  }).catch(() => []);

  const visible = memories
    .filter((memory) => !memory.node || isBrainNodeVisible(memory.node, accessResult.context))
    .filter((memory) => {
      if (source && !normalizeBrainText([memory.sourceType, memory.sourceId].filter(Boolean).join(" ")).includes(source)) return false;
      if (!q) return true;
      return normalizeBrainText([
        memory.title,
        memory.summary,
        memory.memoryType,
        memory.sourceType,
        memory.node?.label,
        memory.node?.type,
      ].filter(Boolean).join(" ")).includes(q);
    })
    .slice(0, limit)
    .map(serializeMemory);

  return NextResponse.json({
    memories: visible,
    count: visible.length,
    types: Array.from(VALID_MEMORY_TYPES),
  });
}

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }
  if (!canWriteMemory(accessResult.context)) {
    return NextResponse.json({ error: "Sem permissao para criar memoria" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = asString(body.title);
  const summary = asString(body.summary);
  const nodeId = asString(body.nodeId);

  if (!title || !summary) {
    return NextResponse.json({ error: "Titulo e resumo/contexto sao obrigatorios" }, { status: 400 });
  }

  let node = null;
  if (nodeId) {
    node = await prisma.brainNode.findUnique({ where: { id: nodeId } });
    if (!node) return NextResponse.json({ error: "No do Brain nao encontrado" }, { status: 404 });
    if (!isBrainNodeVisible(node, accessResult.context)) {
      return NextResponse.json({ error: "Sem permissao para vincular memoria a este no" }, { status: 403 });
    }
  }

  const memory = await prisma.brainMemory.create({
    data: {
      title,
      summary,
      memoryType: normalizeMemoryType(body.memoryType),
      importance: normalizeImportance(body.importance),
      relatedNodeIds: nodeId ? [nodeId] : [],
      sourceType: asString(body.sourceType) || "MANUAL",
      sourceId: asString(body.sourceId) || null,
      status: "ACTIVE",
      nodeId: nodeId || null,
      metadata: {
        ...asRecord(body.metadata),
        createdFrom: "brain-memories-page",
        createdBy: accessResult.context.user.id ?? accessResult.context.user.email ?? "unknown",
        role: accessResult.context.user.permissionRole ?? accessResult.context.user.role ?? accessResult.context.user.companyRole ?? null,
      },
    },
    include: { node: true },
  });

  await prisma.brainAuditLog.create({
    data: {
      action: "ADD_MEMORY",
      entityType: "BrainMemory",
      entityId: memory.id,
      after: { title: memory.title, memoryType: memory.memoryType, nodeId: memory.nodeId },
      userId: accessResult.context.user.id ?? accessResult.context.user.email ?? null,
      reason: "Memoria criada na tela Memorias do Brain",
    },
  }).catch(() => null);

  return NextResponse.json({ memory: serializeMemory(memory) }, { status: 201 });
}
