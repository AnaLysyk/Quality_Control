import { NextResponse } from "next/server";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { readManualReleaseStore } from "../../../../data/manualData";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";

const SLA_MS = 172800000; // 48h
const DAY_MS = 24 * 60 * 60 * 1000;

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const now = Date.now();
  const currentStart = now - 7 * DAY_MS;
  const previousStart = now - 14 * DAY_MS;
  const previousEnd = now - 7 * DAY_MS;

  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => {
    const status = normalizeDefectStatus(r.status);
    const openedAt = resolveOpenedAt((r as any).openedAt ?? r.createdAt);
    const closedAt = resolveClosedAt(status, r.closedAt ?? null, r.updatedAt ?? null);
    return {
      openedAt,
      closedAt,
      status,
      origin: "manual",
      mttrMs: calcMTTR(openedAt, closedAt),
    };
  });

  // Qase defects
  const clientSettings = await getClientQaseSettings(slug);
  const token = clientSettings?.token || process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
  const projectCodesSet = new Set<string>();
  const settingsCodes = clientSettings?.projectCodes ?? [];
  settingsCodes.forEach((code) => {
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (normalized) projectCodesSet.add(normalized);
  });
  if (!projectCodesSet.size && clientSettings?.projectCode) {
    const normalized = clientSettings.projectCode.trim().toUpperCase();
    if (normalized) projectCodesSet.add(normalized);
  }
  const projectCodes = Array.from(projectCodesSet);

  let qaseDefects: { openedAt: string; closedAt: string | null; status: string; origin: "qase"; mttrMs: number | null }[] = [];
  for (const code of projectCodes) {
    const defects = await fetch(`https://api.qase.io/v1/defect/${code}?limit=1000`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => Array.isArray(json?.result?.entities) ? json.result.entities : [])
      .catch(() => []);
    qaseDefects.push(
      ...defects.map((d: any) => {
        const status = normalizeDefectStatus(d.status ?? "open");
        const openedAt = resolveOpenedAt(d.created_at ?? d.updated_at);
        const closedAt = resolveClosedAt(status, d.closed_at ?? null, d.updated_at ?? null);
        return {
          openedAt,
          closedAt,
          status,
          origin: "qase" as const,
          mttrMs: calcMTTR(openedAt, closedAt),
        };
      })
    );
  }

  // Merge all defects
  const all = [...manualDefects, ...qaseDefects].filter((d) => d.openedAt);

  // MTTR trend
  const closedCurrent = all.filter(
    (d) => d.closedAt && new Date(d.closedAt).getTime() >= currentStart
  );
  const closedPrevious = all.filter(
    (d) => d.closedAt && new Date(d.closedAt).getTime() >= previousStart && new Date(d.closedAt).getTime() < previousEnd
  );
  const mttrCurrent = avg(closedCurrent.map((d) => d.mttrMs ?? 0));
  const mttrPrevious = avg(closedPrevious.map((d) => d.mttrMs ?? 0));
  const mttrDelta =
    mttrCurrent != null && mttrPrevious != null ? mttrCurrent - mttrPrevious : null;

  // SLA trend
  const openCurrent = all.filter(
    (d) => d.status !== "done" && new Date(d.openedAt).getTime() >= currentStart
  );
  const openPrevious = all.filter(
    (d) => d.status !== "done" && new Date(d.openedAt).getTime() >= previousStart && new Date(d.openedAt).getTime() < previousEnd
  );
  const overSlaCurrent = openCurrent.filter((d) => {
    const opened = new Date(d.openedAt).getTime();
    return Number.isFinite(opened) && now - opened > SLA_MS;
  });
  const overSlaPrevious = openPrevious.filter((d) => {
    const opened = new Date(d.openedAt).getTime();
    return Number.isFinite(opened) && previousEnd - opened > SLA_MS;
  });
  const slaCurrentPct = openCurrent.length ? Math.round((overSlaCurrent.length / openCurrent.length) * 100) : null;
  const slaPreviousPct = openPrevious.length ? Math.round((overSlaPrevious.length / openPrevious.length) * 100) : null;
  const slaDelta =
    slaCurrentPct != null && slaPreviousPct != null ? slaCurrentPct - slaPreviousPct : null;

  return NextResponse.json({
    mttr: {
      current: mttrCurrent != null ? Math.round(mttrCurrent / 3600000 * 10) / 10 : null, // horas, 1 decimal
      previous: mttrPrevious != null ? Math.round(mttrPrevious / 3600000 * 10) / 10 : null,
      delta: mttrDelta != null ? Math.round(mttrDelta / 3600000 * 10) / 10 : null,
    },
    sla: {
      currentOverPct: slaCurrentPct,
      previousOverPct: slaPreviousPct,
      delta: slaDelta,
    },
  }, { status: 200 });
}
