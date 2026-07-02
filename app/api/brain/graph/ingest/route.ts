import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { addMemory, connectNodes, upsertNode } from "@/lib/brain";
import { resolveBrainAccess } from "@/lib/brain/access";
import { isAllowedBrainEvent } from "@/lib/brain/contracts";
import { prisma } from "@/lib/prismaClient";

type IngestPayload = {
  eventType?: string;
  source?: string;
  companySlug?: string;
  node?: {
    type?: string;
    label?: string;
    refType?: string;
    refId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
  };
  edge?: {
    fromId?: string;
    toId?: string;
    type?: string;
    metadata?: Prisma.InputJsonValue;
  };
  memory?: {
    title?: string;
    summary?: string;
    memoryType?: string;
    importance?: number;
    relatedNodeIds?: string[];
    sourceType?: string;
    sourceId?: string;
    metadata?: Prisma.InputJsonValue;
  };
};

function toRecord(value: Prisma.InputJsonValue | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeMemoryType(value: unknown) {
  if (value === "DECISION" || value === "RULE" || value === "PATTERN" || value === "CONTEXT" || value === "EXCEPTION" || value === "TECHNICAL_NOTE") {
    return value;
  }
  return null;
}

function validateEventType(eventType: string) {
  if (!eventType) {
    return NextResponse.json({ error: "eventType e obrigatorio" }, { status: 400 });
  }

  if (!isAllowedBrainEvent(eventType) && !eventType.startsWith("custom.")) {
    return NextResponse.json({
      error: "eventType fora do contrato de ingestao do Brain",
      hint: "Use eventos registrados em BrainModuleEvents ou prefixo custom.*",
    }, { status: 400 });
  }

  return null;
}

async function ingestNode(body: IngestPayload, eventType: string, userId: string) {
  if (!body.node?.type || !body.node?.label) return null;

  const metadata = {
    ...toRecord(body.node.metadata),
    ...(body.companySlug ? { companySlug: body.companySlug } : {}),
    source: body.source ?? eventType,
    createdBy: userId,
  };

  return upsertNode({
    type: body.node.type,
    label: body.node.label,
    refType: body.node.refType,
    refId: body.node.refId,
    description: body.node.description,
    metadata,
    userId,
    enforceOntology: true,
  });
}

async function ingestEdge(body: IngestPayload, eventType: string, userId: string) {
  if (!body.edge?.fromId || !body.edge?.toId || !body.edge?.type) return null;

  const edgeMetadata = toRecord(body.edge.metadata);
  return connectNodes(
    body.edge.fromId,
    body.edge.toId,
    body.edge.type,
    {
      ...edgeMetadata,
      reason: edgeMetadata.reason ?? `event:${eventType}`,
      source: body.source ?? eventType,
      createdBy: userId,
      ...(body.companySlug ? { companySlug: body.companySlug } : {}),
    },
    userId,
    { enforceOntology: true },
  );
}

async function ingestMemory(body: IngestPayload, node: Awaited<ReturnType<typeof upsertNode>> | null, userId: string) {
  const memoryType = normalizeMemoryType(body.memory?.memoryType);
  if (!body.memory?.title || !body.memory?.summary || !memoryType) return null;

  return addMemory({
    title: body.memory.title,
    summary: body.memory.summary,
    memoryType,
    importance: body.memory.importance ?? 1,
    relatedNodeIds: body.memory.relatedNodeIds ?? (node ? [node.id] : []),
    sourceType: body.memory.sourceType ?? "MANUAL",
    sourceId: body.memory.sourceId,
    userId,
  });
}

async function writeIngestAudit(
  body: IngestPayload,
  eventType: string,
  userId: string,
  node: Awaited<ReturnType<typeof upsertNode>> | null,
  edge: Awaited<ReturnType<typeof connectNodes>> | null,
  memory: Awaited<ReturnType<typeof addMemory>> | null,
) {
  await prisma.brainAuditLog.create({
    data: {
      action: "INGEST_EVENT",
      entityType: "BrainGraphEvent",
      entityId: node?.id ?? edge?.id ?? memory?.id ?? eventType,
      userId,
      reason: `Ingest event: ${eventType}`,
      after: {
        eventType,
        source: body.source ?? "api",
        companySlug: body.companySlug ?? null,
        hasNode: Boolean(node),
        hasEdge: Boolean(edge),
        hasMemory: Boolean(memory),
      },
    },
  });
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json()) as IngestPayload;
    const eventType = (body.eventType ?? "custom.event").trim();
    const eventError = validateEventType(eventType);
    if (eventError) return eventError;

    const userId = accessResult.context.user.id;
    const node = await ingestNode(body, eventType, userId);
    const edge = await ingestEdge(body, eventType, userId);
    const memory = await ingestMemory(body, node, userId);

    await writeIngestAudit(body, eventType, userId, node, edge, memory);

    return NextResponse.json({
      eventType,
      node,
      edge,
      memory,
      status: "ingested",
    }, { status: 201 });
  } catch (error) {
    console.error("[brain/graph/ingest] POST error:", error);
    return NextResponse.json({ error: "Erro ao ingerir evento no Brain" }, { status: 500 });
  }
}

