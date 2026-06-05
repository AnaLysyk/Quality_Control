import "server-only";

import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";
const STORE_KEY = "qc:quality_gate_history:v1";
const USE_PERSISTENT_STORE = !USE_MEMORY_ALERTS && !USE_POSTGRES && canUsePersistentJsonStore();

let memoryStore: QualityGateHistoryEntry[] = [];

export type QualityGateHistoryEntry = {
  id: string;
  company_slug: string;
  release_slug: string;
  gate_status: "approved" | "warning" | "failed";
  mttr_hours: number;
  open_defects: number;
  fail_rate: number;
  reasons: string[];
  evaluated_at: string;
  decision?: "approved_with_override";
  override?: {
    by: string;
    reason: string;
    at: string;
  };
};

function pgRowToEntry(r: { id: string; companySlug: string; releaseSlug: string; gateStatus: string; mttrHours: number; openDefects: number; failRate: number; reasons: unknown; evaluatedAt: Date; decision: string | null; overrideData: unknown }): QualityGateHistoryEntry {
  return {
    id: r.id,
    company_slug: r.companySlug,
    release_slug: r.releaseSlug,
    gate_status: r.gateStatus as QualityGateHistoryEntry["gate_status"],
    mttr_hours: r.mttrHours,
    open_defects: r.openDefects,
    fail_rate: r.failRate,
    reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
    evaluated_at: r.evaluatedAt.toISOString(),
    decision: r.decision as QualityGateHistoryEntry["decision"],
    override: (r.overrideData && typeof r.overrideData === "object" && !Array.isArray(r.overrideData))
      ? r.overrideData as { by: string; reason: string; at: string }
      : undefined,
  };
}

function sortQualityGateHistory(
  entries: QualityGateHistoryEntry[],
): QualityGateHistoryEntry[] {
  return [...entries].sort((a, b) =>
    String(b.evaluated_at).localeCompare(String(a.evaluated_at)),
  );
}

function filterQualityGateHistory(
  entries: QualityGateHistoryEntry[],
  companySlug?: string,
  releaseSlug?: string,
) {
  return sortQualityGateHistory(
    entries.filter((entry) => {
      if (companySlug && entry.company_slug !== companySlug) return false;
      return !(releaseSlug && entry.release_slug !== releaseSlug);
    }),
  );
}

export async function appendQualityGateHistory(entry: QualityGateHistoryEntry) {
  if (USE_MEMORY_ALERTS) {
    memoryStore = [...memoryStore, entry];
    return;
  }

  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    await prisma.qualityGateHistory.create({
      data: {
        id: entry.id,
        companySlug: entry.company_slug,
        releaseSlug: entry.release_slug,
        gateStatus: entry.gate_status,
        mttrHours: entry.mttr_hours,
        openDefects: entry.open_defects,
        failRate: entry.fail_rate,
        reasons: entry.reasons,
        evaluatedAt: new Date(entry.evaluated_at),
        decision: entry.decision ?? null,
        overrideData: entry.override ?? undefined,
      },
    });
    return;
  }

  if (USE_PERSISTENT_STORE) {
    const current = await readPersistentJson<QualityGateHistoryEntry[]>(STORE_KEY, []);
    const next = [...(Array.isArray(current) ? current : []), entry];
    await writePersistentJson(STORE_KEY, next);
    return;
  }

  memoryStore = [...memoryStore, entry];
}

export async function readQualityGateHistory(
  companySlug?: string,
  releaseSlug?: string,
): Promise<QualityGateHistoryEntry[]> {
  if (USE_MEMORY_ALERTS) {
    return filterQualityGateHistory(memoryStore, companySlug, releaseSlug);
  }

  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.qualityGateHistory.findMany({
      where: {
        ...(companySlug ? { companySlug } : {}),
        ...(releaseSlug ? { releaseSlug } : {}),
      },
      orderBy: { evaluatedAt: "desc" },
    });
    return rows.map(pgRowToEntry);
  }

  let entries: QualityGateHistoryEntry[] = [];

  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<QualityGateHistoryEntry[]>(STORE_KEY, []);
    entries = Array.isArray(persisted) ? persisted : [];
  } else {
    entries = memoryStore;
  }

  return filterQualityGateHistory(entries, companySlug, releaseSlug);
}
