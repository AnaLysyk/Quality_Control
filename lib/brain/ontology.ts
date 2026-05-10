import type { Prisma } from "@prisma/client";

export const OFFICIAL_BRAIN_NODE_TYPES = [
  "Company",
  "User",
  "Profile",
  "Application",
  "Module",
  "TestCase",
  "TestPlan",
  "TestRun",
  "AutomationScript",
  "Defect",
  "Ticket",
  "Document",
  "Note",
  "AssistantConversation",
  "AssistantMemory",
  "AgentRun",
  "GitHubPullRequest",
  "QaseCase",
  "Artifact",
] as const;

export const OFFICIAL_BRAIN_EDGE_TYPES = [
  "BELONGS_TO",
  "CREATED_BY",
  "UPDATED_BY",
  "LINKED_TO",
  "EXECUTED_IN",
  "FAILED_IN",
  "FOUND_DEFECT",
  "AUTOMATED_BY",
  "GENERATED_BY_AI",
  "PUBLISHED_TO_GITHUB",
  "SYNCHRONIZED_FROM_QASE",
  "MENTIONED_IN",
  "DOCUMENTED_BY",
  "HAS_PERMISSION",
  "VISIBLE_TO",
] as const;

export const OFFICIAL_CONFIDENCE_LEVELS = [1.0, 0.8, 0.6, 0.4] as const;

export type OfficialBrainNodeType = (typeof OFFICIAL_BRAIN_NODE_TYPES)[number];
export type OfficialBrainEdgeType = (typeof OFFICIAL_BRAIN_EDGE_TYPES)[number];

type JsonRecord = Record<string, unknown>;

export function toRecord(value: Prisma.InputJsonValue | Prisma.JsonValue | undefined): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConfidence(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const clamped = Math.max(0, Math.min(1, num));
  const closest = OFFICIAL_CONFIDENCE_LEVELS.reduce((best, current) => {
    return Math.abs(current - clamped) < Math.abs(best - clamped) ? current : best;
  }, OFFICIAL_CONFIDENCE_LEVELS[0]);
  return closest;
}

export function isOfficialBrainNodeType(type: string) {
  return (OFFICIAL_BRAIN_NODE_TYPES as readonly string[]).includes(type);
}

export function isOfficialBrainEdgeType(type: string) {
  return (OFFICIAL_BRAIN_EDGE_TYPES as readonly string[]).includes(type);
}

export function resolveEdgeConfidence(source: string | null | undefined, explicit?: unknown) {
  const explicitConfidence = normalizeConfidence(explicit);
  if (explicitConfidence !== null) return explicitConfidence;

  const normalizedSource = String(source ?? "").trim().toLowerCase();
  if (!normalizedSource) return 1.0;
  if (normalizedSource.includes("ai") || normalizedSource.includes("suggest")) return 0.6;
  if (normalizedSource.includes("infer") || normalizedSource.includes("semantic") || normalizedSource.includes("text")) return 0.4;
  if (normalizedSource.includes("event") || normalizedSource.includes("created") || normalizedSource.includes("linked")) return 0.8;
  return 1.0;
}

export function normalizeNodeContract(input: {
  type: string;
  label: string;
  refType?: string;
  refId?: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  enforceOntology?: boolean;
}) {
  const metadata = toRecord(input.metadata);
  const companySlug = normalizeString(metadata.companySlug) ?? "global";
  const source = normalizeString(metadata.source) ?? "manual_link";
  const createdBy = normalizeString(metadata.createdBy) ?? normalizeString(input.userId) ?? "system";
  const createdAt = normalizeString(metadata.createdAt) ?? new Date().toISOString();
  const refType = normalizeString(input.refType) ?? undefined;
  const refId = normalizeString(input.refId) ?? undefined;

  if (input.enforceOntology && !isOfficialBrainNodeType(input.type)) {
    throw new Error(`Tipo de no nao permitido pela ontologia oficial: ${input.type}`);
  }

  if (input.enforceOntology && ((refType && !refId) || (!refType && refId))) {
    throw new Error("refType e refId devem ser enviados juntos para entidade real");
  }

  return {
    refType,
    refId,
    metadata: {
      ...metadata,
      companySlug,
      source,
      createdBy,
      createdAt,
    } as Prisma.InputJsonValue,
  };
}

export function normalizeEdgeContract(input: {
  type: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
  enforceOntology?: boolean;
}) {
  const metadata = toRecord(input.metadata);

  if (input.enforceOntology && !isOfficialBrainEdgeType(input.type)) {
    throw new Error(`Tipo de relacao nao permitido pela ontologia oficial: ${input.type}`);
  }

  const source = normalizeString(metadata.source) ?? "manual_link";
  const reason = normalizeString(metadata.reason) ?? "operational_link";
  const createdBy = normalizeString(metadata.createdBy) ?? normalizeString(input.userId) ?? "system";
  const createdAt = normalizeString(metadata.createdAt) ?? new Date().toISOString();
  const companySlug = normalizeString(metadata.companySlug) ?? "global";
  const confidence = resolveEdgeConfidence(source, metadata.confidence);

  return {
    confidence,
    metadata: {
      ...metadata,
      source,
      reason,
      createdBy,
      createdAt,
      companySlug,
      confidence,
    } as Prisma.InputJsonValue,
  };
}
