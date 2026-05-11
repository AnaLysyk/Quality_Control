import type { BrianEvidence, BrianEvidenceSourceType, BrianImpulseEnvelope } from "./types";
import { normalizeText, stableId } from "./normalizer";

function compactExcerpt(value: unknown, max = 240) {
  if (typeof value !== "string") return undefined;
  const compacted = value.replace(/\s+/g, " ").trim();
  if (!compacted) return undefined;
  return compacted.length > max ? `${compacted.slice(0, max - 1)}…` : compacted;
}

export function createEvidence(input: {
  sourceType: BrianEvidenceSourceType;
  impulseId: string;
  sourceId?: string | null;
  sourceRoute?: string | null;
  field?: string | null;
  excerpt?: string | null;
  capturedAt?: string | null;
}): BrianEvidence {
  const sourceType = input.sourceType;
  const field = input.field ?? undefined;
  const excerpt = compactExcerpt(input.excerpt);
  return {
    id: stableId("evidence", [
      input.impulseId,
      sourceType,
      input.sourceId ?? input.sourceRoute ?? field ?? excerpt ?? "source",
    ]),
    sourceType,
    sourceId: input.sourceId ?? undefined,
    sourceRoute: input.sourceRoute ?? undefined,
    field,
    excerpt,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
  };
}

export function extractEvidenceFromImpulse(impulse: BrianImpulseEnvelope): BrianEvidence[] {
  const evidences: BrianEvidence[] = [];
  const push = (item: Omit<Parameters<typeof createEvidence>[0], "impulseId" | "capturedAt">) => {
    evidences.push(createEvidence({ ...item, impulseId: impulse.id, capturedAt: impulse.time }));
  };

  push({
    sourceType: "route",
    sourceId: impulse.subject,
    sourceRoute: impulse.source || impulse.context.pathname,
    field: "source",
    excerpt: impulse.source || impulse.context.pathname,
  });

  for (const field of ["title", "description", "summary", "reason", "status", "priority", "severity", "release", "environment"]) {
    const value = impulse.data[field];
    if (typeof value === "string" && value.trim()) {
      push({
        sourceType: field === "description" ? "description" : "payload",
        sourceId: impulse.subject,
        sourceRoute: impulse.source,
        field,
        excerpt: value,
      });
    }
  }

  if (impulse.actor.id) {
    push({
      sourceType: "user_action",
      sourceId: impulse.actor.id,
      sourceRoute: impulse.source,
      field: "actor",
      excerpt: `${impulse.actor.name} (${impulse.actor.role})`,
    });
  }

  return dedupeEvidence(evidences);
}

export function findEvidenceForField(evidences: BrianEvidence[], field: string) {
  return evidences.find((item) => item.field === field) ?? evidences[0] ?? null;
}

export function evidenceConfidence(evidence: BrianEvidence | null | undefined) {
  if (!evidence) return 0;
  if (evidence.sourceType === "database" || evidence.sourceType === "payload" || evidence.sourceType === "user_action") return 0.92;
  if (evidence.sourceType === "route" || evidence.sourceType === "audit_log") return 0.82;
  if (evidence.sourceType === "description" || evidence.sourceType === "comment" || evidence.sourceType === "ticket_description") return 0.72;
  if (evidence.sourceType === "test_execution" || evidence.sourceType === "automation_run") return 0.86;
  return 0.55;
}

export function dedupeEvidence(evidences: BrianEvidence[]) {
  const byId = new Map<string, BrianEvidence>();
  for (const evidence of evidences) {
    byId.set(evidence.id, {
      ...evidence,
      excerpt: normalizeText(evidence.excerpt, ""),
    });
  }
  return [...byId.values()];
}
