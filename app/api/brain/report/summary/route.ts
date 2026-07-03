import { type NextRequest, NextResponse } from "next/server";

import { isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function readMeta(row: AnyRecord) {
  return asRecord(row.metadata);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function moduleOf(node: AnyRecord) {
  const metadata = readMeta(node);
  return (
    readString(metadata.module) ||
    readString(metadata.coreId) ||
    readString(node.refType) ||
    readString(node.type, "Sem módulo")
  );
}

function statusOf(node: AnyRecord) {
  const metadata = readMeta(node);
  const direct = readString(metadata.status).toLowerCase();

  if (direct) return direct;

  const risk = readNumber(node.riskScore, 0);
  const quality = readNumber(node.qualityScore, 0);

  if (risk >= 0.75) return "error";
  if (risk >= 0.45) return "warning";
  if (quality > 0 && quality < 0.45) return "pending";

  return "ok";
}

function isPendingStatus(status: string) {
  return ["pending", "missing", "warning", "error", "orphan", "blocked"].includes(status);
}

function topEntries(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);

  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const [nodesRaw, edgesRaw, memories, suggestions, inboxItems, auditLogs] = await Promise.all([
    prisma.brainNode.findMany({
      orderBy: { updatedAt: "desc" },
      take: 1500,
    }).catch(() => []),
    prisma.brainEdge.findMany({
      take: 3000,
    }).catch(() => []),
    prisma.brainMemory.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
      take: 300,
    }).catch(() => []),
    prisma.brainSuggestion.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
    }).catch(() => []),
    prisma.brainInboxItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
    }).catch(() => []),
    prisma.brainAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }).catch(() => []),
  ]);

  const visibleNodes = nodesRaw.filter((node) => isBrainNodeVisible(node, accessResult.context));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edgesRaw.filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));

  const connected = new Set<string>();
  for (const edge of visibleEdges) {
    connected.add(edge.fromId);
    connected.add(edge.toId);
  }

  const moduleMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  const pendingNodes = visibleNodes.filter((node) => {
    const record = node as unknown as AnyRecord;
    const moduleName = moduleOf(record);
    const typeName = readString(record.type, "unknown");
    const status = statusOf(record);

    moduleMap.set(moduleName, (moduleMap.get(moduleName) ?? 0) + 1);
    typeMap.set(typeName, (typeMap.get(typeName) ?? 0) + 1);
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

    return isPendingStatus(status);
  });

  const orphanNodes = visibleNodes.filter((node) => !connected.has(node.id));

  const openSuggestions = suggestions.filter((item) => !["resolved", "archived", "rejected"].includes(item.status));
  const pendingInbox = inboxItems.filter((item) => ["pending", "needs_review"].includes(item.status));

  const health = Math.max(
    0,
    Math.round(
      100 -
        ((pendingNodes.length + orphanNodes.length + pendingInbox.length) /
          Math.max(1, visibleNodes.length + pendingInbox.length)) *
          100,
    ),
  );

  const riskLevel =
    health < 55 || pendingNodes.length > 12
      ? "alto"
      : health < 78 || pendingNodes.length > 4
        ? "medio"
        : "baixo";

  const recommendations = [
    pendingNodes.length
      ? "Revisar nós pendentes e transformar decisões em memória do Brain."
      : null,
    orphanNodes.length
      ? "Conectar nós órfãos a módulos, documentos, usuários ou ações reais."
      : null,
    pendingInbox.length
      ? "Revisar itens da inbox do Brain antes de considerar o contexto maduro."
      : null,
    memories.length < Math.max(3, Math.round(visibleNodes.length * 0.08))
      ? "Adicionar mais memórias manuais ou automáticas aos núcleos principais."
      : null,
    openSuggestions.length
      ? "Avaliar sugestões abertas do Brain e aceitar/rejeitar o que fizer sentido."
      : null,
    "Usar o chat do Brain para aplicar filtros, explicar nós e apoiar decisões do usuário.",
  ].filter(Boolean);

  return NextResponse.json({
    source: "brain-report-summary",
    generatedAt: new Date().toISOString(),
    userContext: {
      userId: accessResult.context.user.id ?? accessResult.context.user.email ?? null,
      role: accessResult.context.user.permissionRole ?? accessResult.context.user.role ?? accessResult.context.user.companyRole ?? null,
      companyIds: Array.from(accessResult.context.allowedCompanyIds ?? []),
      projectIds: [],
    },
    health,
    riskLevel,
    kpis: {
      nodes: visibleNodes.length,
      edges: visibleEdges.length,
      memories: memories.length,
      pendingNodes: pendingNodes.length,
      orphanNodes: orphanNodes.length,
      suggestions: openSuggestions.length,
      inboxPending: pendingInbox.length,
      auditEvents: auditLogs.length,
    },
    breakdown: {
      modules: topEntries(moduleMap),
      types: topEntries(typeMap),
      statuses: topEntries(statusMap),
    },
    highlights: {
      pendingNodes: pendingNodes.slice(0, 10).map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        module: moduleOf(node as unknown as AnyRecord),
        status: statusOf(node as unknown as AnyRecord),
      })),
      orphanNodes: orphanNodes.slice(0, 10).map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        module: moduleOf(node as unknown as AnyRecord),
      })),
      recentMemories: memories.slice(0, 8).map((memory) => ({
        id: memory.id,
        title: memory.title,
        memoryType: memory.memoryType,
        importance: memory.importance,
        updatedAt: memory.updatedAt,
      })),
      recentAudit: auditLogs.slice(0, 8).map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
      })),
    },
    recommendations,
  });
}
