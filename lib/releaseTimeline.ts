import { readManualReleaseStore } from "@/data/manualData";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";
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

type ReleaseData = {
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  status?: string | null;
};

type GateEntry = {
  id?: string;
  company_slug?: string;
  release_slug?: string;
  decision?: string;
  override?: { at?: string; reason?: string; by?: string };
  evaluated_at?: string;
  gate_status?: string;
  mttr_hours?: number;
  open_defects?: number;
  fail_rate?: number;
  reasons?: unknown;
};

function statusIsFail(value?: string | null) {
  const v = (value ?? "").toString().toLowerCase();
  return v === "fail" || v === "failed" || v === "falha";
}

export async function getReleaseTimeline(companySlug: string, releaseSlug: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  const manual = (await readManualReleaseStore()).find((r) => r.slug === releaseSlug) ?? null;
  const apiRelease = manual ? null : (await getReleaseBySlug(releaseSlug).catch(() => null));
  const releaseData = manual || apiRelease;
  const releaseRecord = releaseData as ReleaseData | null;
  const releaseTitle = releaseRecord?.title || releaseRecord?.name || releaseRecord?.slug || releaseSlug;

  const createdAt = releaseRecord?.createdAt || releaseRecord?.created_at || null;
  if (createdAt) {
    events.push({
      id: `release_created:${releaseSlug}`,
      type: "release_created",
      label: `Release ${releaseTitle} criada`,
      occurred_at: createdAt,
    });
  }

  if (releaseData) {
    const runCreatedAt = createdAt || releaseRecord?.updatedAt || new Date().toISOString();
    events.push({
      id: `run_created:${releaseSlug}`,
      type: "run_created",
      label: `Run ${releaseTitle} criada`,
      occurred_at: runCreatedAt,
    });
    if (statusIsFail(releaseRecord?.status ?? null)) {
      events.push({
        id: `run_failed:${releaseSlug}`,
        type: "run_failed",
        label: `Run ${releaseTitle} falhou`,
        occurred_at: releaseRecord?.updatedAt || runCreatedAt,
      });
    }
  }

  const gateHistory = (await readQualityGateHistory(companySlug, releaseSlug)) as GateEntry[];
  gateHistory.forEach((entry) => {
    const isOverride = entry.decision === "approved_with_override";
    const occurredAt = isOverride && entry.override?.at ? entry.override.at : entry.evaluated_at;
    const label = isOverride
      ? `Override aplicado: ${entry.override?.reason || "liberacao manual"}`
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
