import path from "path";
import fs from "fs/promises";
import { readManualReleaseStore } from "@/data/manualData";
import { getReleaseBySlug } from "@/release/data";

/**
 * Tipos de eventos possíveis na timeline de um release.
 */
export type TimelineType =
  | "release_created"
  | "run_created"
  | "run_failed"
  | "defect_created"
  | "defect_closed"
  | "gate_evaluated"
  | "gate_override";

/**
 * Evento da timeline de um release, com tipo, label, data e metadados.
 */
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

const GATE_STORE = path.join(process.cwd(), "data", "quality_gate_history.json");

async function ensureGateStore() {
  await fs.mkdir(path.dirname(GATE_STORE), { recursive: true });
  try {
    await fs.access(GATE_STORE);
  } catch {
    await fs.writeFile(GATE_STORE, "[]", "utf8");
  }
}

async function readGateHistory(): Promise<GateEntry[]> {
  await ensureGateStore();
  const raw = await fs.readFile(GATE_STORE, "utf8");
  try {
    const parsed = JSON.parse(raw) as GateEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusIsFail(value?: string | null) {
  const v = (value ?? "").toString().toLowerCase();
  return v === "fail" || v === "failed" || v === "falha";
}

/**
 * Gera a timeline de eventos de um release, incluindo criação, runs e histórico de quality gate.
 * @param companySlug Slug da empresa
 * @param releaseSlug Slug do release
 * @returns Lista de eventos ordenados por data
 */
export async function getReleaseTimeline(companySlug: string, releaseSlug: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  const manual = (await readManualReleaseStore()).find((r) => r.slug === releaseSlug) ?? null;
  const apiRelease = manual ? null : (await getReleaseBySlug(releaseSlug).catch(() => null));
  const releaseData = manual || apiRelease;
  const releaseRecord = releaseData as ReleaseData | null;
  const releaseTitle =
    releaseRecord?.title ||
    releaseRecord?.name ||
    releaseRecord?.slug ||
    releaseSlug;

  // Release created
  const createdAt =
    releaseRecord?.createdAt ||
    releaseRecord?.created_at ||
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

  // Gate history
  const gateHistory = await readGateHistory();
  gateHistory
    .filter(
      (entry) =>
        entry.company_slug === companySlug &&
        entry.release_slug === releaseSlug
    )
    .forEach((entry) => {
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
