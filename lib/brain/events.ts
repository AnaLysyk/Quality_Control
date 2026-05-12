import "server-only";

import { randomUUID } from "node:crypto";
import { publishBrianImpulse } from "@/lib/brain/sdk";
import type { BrianImpulseType } from "@/lib/brain/contextual/types";

type BrainEventPayload = {
  type: BrianImpulseType;
  subject: string;
  source: string;
  actorId: string;
  actorRole?: string;
  companyId?: string | null;
  companySlug?: string | null;
  projectId?: string | null;
  data?: Record<string, unknown>;
};

/**
 * Emits a Brian impulse event in shadow mode (non-blocking, fire-and-forget).
 * Safe to call from any server-side context — failures are silently swallowed
 * so they never break the calling flow.
 */
export function emitBrainEvent(payload: BrainEventPayload): void {
  const now = new Date().toISOString();
  const impulse = {
    id: randomUUID(),
    specversion: "brian.v1" as const,
    schemaVersion: 1,
    type: payload.type,
    source: payload.source,
    subject: payload.subject,
    time: now,
    actor: {
      id: payload.actorId,
      name: payload.actorId,
      role: payload.actorRole ?? "system",
    },
    context: {
      traceId: randomUUID(),
      sessionId: randomUUID(),
      pathname: payload.source,
      companyId: payload.companyId ?? null,
      companySlug: payload.companySlug ?? null,
      userId: payload.actorId,
      role: payload.actorRole ?? "system",
      permissions: [],
    },
    data: payload.data ?? {},
  };

  // Fire-and-forget: never blocks the caller
  publishBrianImpulse(impulse, { shadowMode: true }).catch(() => undefined);
}
