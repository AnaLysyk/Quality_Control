import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";
const STORE_PATH = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "quality_gate_history.json");
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

async function ensureStore() {
  if (USE_MEMORY_ALERTS || USE_PERSISTENT_STORE || USE_POSTGRES) return;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
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

  try {
    await ensureStore();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    let arr: QualityGateHistoryEntry[] = [];
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? (parsed as QualityGateHistoryEntry[]) : [];
    } catch {
      arr = [];
    }
    arr.push(entry);
    await fs.writeFile(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.warn("qualityGateHistory: unable to write store", err);
  }
}

export async function readQualityGateHistory(
  companySlug?: string,
  releaseSlug?: string,
): Promise<QualityGateHistoryEntry[]> {
  if (USE_MEMORY_ALERTS) {
    let arr = [...memoryStore];
    if (companySlug) arr = arr.filter((i) => i.company_slug === companySlug);
    if (releaseSlug) arr = arr.filter((i) => i.release_slug === releaseSlug);
    arr.sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
    return arr;
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

  let arr: QualityGateHistoryEntry[] = [];

  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<QualityGateHistoryEntry[]>(STORE_KEY, []);
    arr = Array.isArray(persisted) ? persisted : [];
  } else {
    try {
      await ensureStore();
      const raw = await fs.readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? (parsed as QualityGateHistoryEntry[]) : [];
    } catch (err) {
      console.warn("qualityGateHistory: unable to read store", err);
      return [];
    }
  }

  if (companySlug) arr = arr.filter((item) => item.company_slug === companySlug);
  if (releaseSlug) arr = arr.filter((item) => item.release_slug === releaseSlug);
  arr.sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
  return arr;
}
