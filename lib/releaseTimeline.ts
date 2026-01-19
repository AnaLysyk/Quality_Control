import path from "path";
import fs from "fs/promises";
import { readManualReleaseStore } from "@/data/manualData";
import { getReleaseBySlug } from "@/release/data";

export type TimelineType =
  | "release_created"
  | "run_created"
  | "run_failed"
  | "defect_created"
  | "defect_closed"
  | "gate_evaluated"
  | "gate_override";

export type TimelineEvent = {
  id: string;
  type: TimelineType;
  label: string;
  occurred_at: string;
  meta?: Record<string, unknown>;
};

const GATE_STORE = path.join(process.cwd(), "data", "quality_gate_history.json");

async function ensureGateStore() {
  await fs.mkdir(path.dirname(GATE_STORE), { recursive: true });
  try {
    await fs.access(GATE_STORE);
  } catch {
    await fs.writeFile(GATE_STORE, "[]", "utf8");
  }
}

async function readGateHistory() {
  await ensureGateStore();
  const raw = await fs.readFile(GATE_STORE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusIsFail(value?: string | null) {
  const v = (value ?? "").toString().toLowerCase();
  return v === "fail" || v === "failed" || v === "falha";
}

export async function getReleaseTimeline(companySlug: string, releaseSlug: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  const manual = (await readManualReleaseStore()).find((r) => r.slug === releaseSlug) ?? null;
  const apiRelease = manual ? null : (await getReleaseBySlug(releaseSlug).catch(() => null));
  const releaseData = manual || apiRelease;
  const releaseTitle =
    (releaseData as any)?.title ||
    (releaseData as any)?.name ||
    (releaseData as any)?.slug ||
    releaseSlug;

  // Release created
  const createdAt =
    (releaseData as any)?.createdAt ||
    (releaseData as any)?.created_at ||
    null;
  if (createdAt) {
    events.push({
      id: `release_created:${releaseSlug}`,
      type: "release_created",
      label: `Release ${releaseTitle} criada`,
      occurred_at: createdAt,
    });
  }

  // Run created / failed
  if (releaseData) {
    const runCreatedAt = createdAt || (releaseData as any)?.updatedAt || new Date().toISOString();
    events.push({
      id: `run_created:${releaseSlug}`,
      type: "run_created",
      label: `Run ${releaseTitle} criada`,
      occurred_at: runCreatedAt,
    });
    if (statusIsFail((releaseData as any)?.status)) {
      events.push({
        id: `run_failed:${releaseSlug}`,
        type: "run_failed",
        label: `Run ${releaseTitle} falhou`,
        occurred_at: (releaseData as any)?.updatedAt || runCreatedAt,
      });
    }
  }

  // Gate history
  const gateHistory = await readGateHistory();
  gateHistory
    .filter(
      (entry: any) =>
        entry.company_slug === companySlug &&
        entry.release_slug === releaseSlug
    )
    .forEach((entry: any) => {
      const isOverride = entry.decision === "approved_with_override";
      const occurredAt = isOverride && entry.override?.at ? entry.override.at : entry.evaluated_at;
      const label = isOverride
        ? `Override aplicado: ${entry.override?.reason || "liberação manual"}`
        : `Quality Gate: ${entry.gate_status}`;
      const type: TimelineType = isOverride ? "gate_override" : "gate_evaluated";
      const meta: Record<string, unknown> = {
        gate_status: entry.gate_status,
        mttr_hours: entry.mttr_hours,
        open_defects: entry.open_defects,
        fail_rate: entry.fail_rate,
        reasons: entry.reasons,
      };
      if (entry.override) {
        meta.override = entry.override;
      }
      events.push({
        id: entry.id || `${type}:${releaseSlug}:${occurredAt}`,
        type,
        label,
        occurred_at: occurredAt || new Date().toISOString(),
        meta,
      });
    });

  events.sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  return events;
}
