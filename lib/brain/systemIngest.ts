import type { Prisma } from "@prisma/client";

import { addMemory, connectNodes, upsertNode } from "@/lib/brain";
import type { AuditLogInput } from "@/lib/audit/writeAuditLog";

type IngestContext = Record<string, unknown>;

type SystemEntityInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  metadata?: IngestContext | null;
};

const TRACKED_ACTIONS = new Set([
  "create",
  "created",
  "import",
  "update",
  "updated",
  "status_change",
  "approve",
  "reject",
  "archive",
  "delete",
  "restore",
]);

const NODE_TYPE_BY_ENTITY: Record<string, string> = {
  Application: "Application",
  AuditLog: "AuditEvent",
  AccessRequest: "AccessRequest",
  Company: "Company",
  CompanyIntegration: "Integration",
  Defect: "Defect",
  Document: "Document",
  Project: "Project",
  Release: "Release",
  SupportRequest: "SupportRequest",
  TestCase: "TestCase",
  TestPlan: "TestPlan",
  ManualTestPlan: "TestPlan",
  TestRun: "TestRun",
  Ticket: "Ticket",
  User: "User",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pickText(metadata: IngestContext | null | undefined, keys: string[]) {
  if (!metadata) return "";
  for (const key of keys) {
    const value = normalizeText(metadata[key]);
    if (value) return value;
  }
  return "";
}

function shouldIngest(input: SystemEntityInput) {
  const action = normalizeText(input.action).toLowerCase();
  if (!action) return false;
  if (!TRACKED_ACTIONS.has(action)) return false;
  if (!normalizeText(input.entityType)) return false;
  if (!normalizeText(input.entityId) && !normalizeText(input.entityLabel)) return false;
  return true;
}

function resolveNodeType(entityType: string) {
  return NODE_TYPE_BY_ENTITY[entityType] ?? entityType.replace(/[^a-zA-Z0-9]/g, "") || "SystemRecord";
}

function buildDescription(input: SystemEntityInput) {
  const label = normalizeText(input.entityLabel) || normalizeText(input.entityId) || "registro";
  const action = normalizeText(input.action) || "evento";
  const entity = normalizeText(input.entityType) || "Sistema";
  const company = pickText(input.metadata, ["companySlug", "companyId", "clientSlug"]);
  const project = pickText(input.metadata, ["projectSlug", "projectId", "projectCode", "testProjectCode"]);
  const parts = [`${entity} "${label}" registrado por ação ${action}.`];
  if (company) parts.push(`Empresa/contexto: ${company}.`);
  if (project) parts.push(`Projeto/operação: ${project}.`);
  if (input.actorEmail) parts.push(`Ator: ${input.actorEmail}.`);
  return parts.join(" ");
}

async function connectContextNodes(args: {
  entityNodeId: string;
  input: SystemEntityInput;
  metadata: IngestContext;
}) {
  const companySlug = pickText(args.metadata, ["companySlug", "clientSlug", "companyId"]);
  const projectId = pickText(args.metadata, ["projectId", "projectSlug", "projectCode", "testProjectCode"]);
  const applicationId = pickText(args.metadata, ["applicationId", "applicationSlug", "application"]);

  if (companySlug) {
    const companyNode = await upsertNode({
      type: "Company",
      label: pickText(args.metadata, ["companyName", "clientName"]) || companySlug,
      refType: "Company",
      refId: companySlug,
      description: `Empresa/contexto ${companySlug} conectado automaticamente pelo Brain.`,
      metadata: { companySlug, source: "system-audit-ingest" } as Prisma.InputJsonValue,
      userId: args.input.actorUserId ?? undefined,
    });
    await connectNodes(companyNode.id, args.entityNodeId, "HAS_SYSTEM_RECORD", { source: "system-audit-ingest" } as Prisma.InputJsonValue, args.input.actorUserId ?? undefined);
  }

  if (projectId) {
    const projectNode = await upsertNode({
      type: "Project",
      label: pickText(args.metadata, ["projectName", "testProjectName"]) || projectId,
      refType: "Project",
      refId: projectId,
      description: `Projeto/operação ${projectId} conectado automaticamente pelo Brain.`,
      metadata: { companySlug: companySlug || null, projectId, source: "system-audit-ingest" } as Prisma.InputJsonValue,
      userId: args.input.actorUserId ?? undefined,
    });
    await connectNodes(projectNode.id, args.entityNodeId, "HAS_SYSTEM_RECORD", { source: "system-audit-ingest" } as Prisma.InputJsonValue, args.input.actorUserId ?? undefined);
  }

  if (applicationId) {
    const applicationNode = await upsertNode({
      type: "Application",
      label: pickText(args.metadata, ["applicationName"]) || applicationId,
      refType: "Application",
      refId: applicationId,
      description: `Aplicação ${applicationId} conectada automaticamente pelo Brain.`,
      metadata: { companySlug: companySlug || null, applicationId, source: "system-audit-ingest" } as Prisma.InputJsonValue,
      userId: args.input.actorUserId ?? undefined,
    });
    await connectNodes(applicationNode.id, args.entityNodeId, "HAS_SYSTEM_RECORD", { source: "system-audit-ingest" } as Prisma.InputJsonValue, args.input.actorUserId ?? undefined);
  }
}

export async function ingestSystemEventIntoBrain(input: SystemEntityInput) {
  if (!shouldIngest(input)) return null;

  const metadata = input.metadata ?? {};
  const entityType = normalizeText(input.entityType);
  const entityId = normalizeText(input.entityId) || normalizeSlug(input.entityLabel) || `${entityType}-${Date.now()}`;
  const label = normalizeText(input.entityLabel) || `${entityType} ${entityId}`;
  const nodeType = resolveNodeType(entityType);
  const action = normalizeText(input.action).toLowerCase();
  const description = buildDescription(input);

  const node = await upsertNode({
    type: nodeType,
    label,
    refType: entityType,
    refId: entityId,
    description,
    metadata: {
      ...metadata,
      source: "system-audit-ingest",
      action,
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      entityType,
      entityId,
    } as Prisma.InputJsonValue,
    userId: input.actorUserId ?? undefined,
  });

  await addMemory({
    title: `${action}: ${label}`.slice(0, 180),
    summary: description,
    memoryType: action === "delete" || action === "archive" ? "EXCEPTION" : action === "status_change" ? "TECHNICAL_NOTE" : "CONTEXT",
    importance: action === "create" || action === "import" ? 7 : 4,
    relatedNodeIds: [node.id],
    sourceType: entityType,
    sourceId: entityId,
    userId: input.actorUserId ?? undefined,
  });

  await connectContextNodes({ entityNodeId: node.id, input, metadata });
  return node;
}

export function ingestAuditLogInputIntoBrain(input: AuditLogInput): void {
  (async () => {
    try {
      await ingestSystemEventIntoBrain({
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        metadata: input.metadata,
      });
    } catch (error) {
      console.warn("[brain-ingest] system event ignored", error);
    }
  })();
}
