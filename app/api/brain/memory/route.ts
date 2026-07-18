import { type NextRequest, NextResponse } from "next/server";

import { normalizeBrainText } from "@/brain/_utils/brainGraphFormatters";
import { isBrainNodeVisible, resolveBrainAccess } from "@/backend/brain/access";
import { prisma } from "@/database/prismaClient";

type MemoryBody = {
  title?: string;
  summary?: string;
  memoryType?: string;
  nodeId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  importance?: number;
  metadata?: Record<string, unknown>;
};

const VALID_MEMORY_TYPES = new Set([
  "DECISION",
  "RULE",
  "PATTERN",
  "CONTEXT",
  "EXCEPTION",
  "TECHNICAL_NOTE",
  "QA_NOTE",
  "SYSTEM_EVENT",
]);

function normalizeMemoryType(value: unknown) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : "";
  return VALID_MEMORY_TYPES.has(text) ? text : "CONTEXT";
}

function normalizeImportance(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 2;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);

  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const q = normalizeBrainText(url.searchParams.get("q") ?? "");
  const nodeId = url.searchParams.get("nodeId");
  const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  const memories = await prisma.brainMemory.findMany({
    where: {
      status: "ACTIVE",
      ...(nodeId ? { nodeId } : {}),
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 160,
    include: {
      node: true,
    },
  });

  const visible = memories
    .filter((memory) => !memory.node || isBrainNodeVisible(memory.node, accessResult.context))
    .filter((memory) => {
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
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary,
      memoryType: memory.memoryType,
      importance: memory.importance,
      status: memory.status,
      sourceType: memory.sourceType,
      sourceId: memory.sourceId,
      nodeId: memory.nodeId,
      node: memory.node ? {
        id: memory.node.id,
        label: memory.node.label,
        type: memory.node.type,
        refType: memory.node.refType,
        refId: memory.node.refId,
      } : null,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    }));

  return NextResponse.json({
    source: "brain-memory",
    count: visible.length,
    memories: visible,
  });
}

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);

  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as MemoryBody;

  const title = asString(body.title);
  const summary = asString(body.summary);
  const nodeId = asString(body.nodeId);

  if (!title) {
    return NextResponse.json({ error: "Titulo da memoria obrigatorio" }, { status: 400 });
  }

  if (!summary) {
    return NextResponse.json({ error: "Resumo/contexto da memoria obrigatorio" }, { status: 400 });
  }

  let node = null;

  if (nodeId) {
    node = await prisma.brainNode.findUnique({ where: { id: nodeId } });

    if (!node) {
      return NextResponse.json({ error: "No do Brain nao encontrado" }, { status: 404 });
    }

    if (!isBrainNodeVisible(node, accessResult.context)) {
      return NextResponse.json({ error: "Sem permissao para gravar memoria neste no" }, { status: 403 });
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
        ...(body.metadata ?? {}),
        createdFrom: "brain-ui",
        createdBy: accessResult.context.user.id ?? accessResult.context.user.email ?? "unknown",
        role: accessResult.context.user.permissionRole ?? accessResult.context.user.role ?? accessResult.context.user.companyRole ?? null,
      },
    },
    include: {
      node: true,
    },
  });

  await prisma.brainAuditLog.create({
    data: {
      action: "ADD_MEMORY",
      entityType: "BrainMemory",
      entityId: memory.id,
      after: {
        title: memory.title,
        memoryType: memory.memoryType,
        nodeId: memory.nodeId,
      },
      userId: accessResult.context.user.id ?? accessResult.context.user.email ?? null,
      reason: "Memoria adicionada ao Brain pelo contexto visual/chat",
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    memory: {
      id: memory.id,
      title: memory.title,
      summary: memory.summary,
      memoryType: memory.memoryType,
      importance: memory.importance,
      nodeId: memory.nodeId,
      createdAt: memory.createdAt,
    },
  }, { status: 201 });
}
