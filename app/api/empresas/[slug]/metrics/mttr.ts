import { NextResponse } from "next/server";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { listQaseRuns } from "@/lib/qaseRuns";
import { readManualReleaseStore } from "../../../../data/manualData";
import { calcMTTR } from "@/lib/mttr";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = typeof PERIODS[number];

function parsePeriod(period: string | undefined): Period {
  if (!period) return "30d";
  if (PERIODS.includes(period as Period)) return period as Period;
  return "30d";
}

function dateFromPeriod(period: Period): Date {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period") || undefined);
  const fromDate = dateFromPeriod(period);

  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => {
    const openedAt = r.createdAt;
    const closedAt = r.closedAt ?? null;
    return {
      origin: "manual",
      openedAt,
      closedAt,
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

  let qaseDefects: { origin: "qase"; openedAt: string; closedAt: string | null; mttrMs: number | null }[] = [];
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
        const status = (d.status ?? "").toLowerCase();
        const isDone = status === "done" || status === "closed" || status === "aprovado";
        const openedAt = d.created_at ?? d.updated_at ?? new Date().toISOString();
        const closedAt = d.closed_at ?? (isDone ? d.updated_at ?? null : null);
        return {
          origin: "qase" as const,
          openedAt,
          closedAt,
          mttrMs: calcMTTR(openedAt, closedAt),
        };
      })
    );
  }

  // Merge and filter by period
  const all = [...manualDefects, ...qaseDefects].filter((d) => d.openedAt && new Date(d.openedAt) >= fromDate);
  const closed = all.filter((d) => d.closedAt && d.mttrMs != null);
  const countClosed = closed.length;
  const avgMttrMs = countClosed ? closed.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / countClosed : null;
  const byOrigin: Record<string, number | null> = {};
  ["manual", "qase"].forEach((origin) => {
    const group = closed.filter((d) => d.origin === origin);
    byOrigin[origin] = group.length ? group.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / group.length : null;
  });

  return NextResponse.json({ period, countClosed, avgMttrMs, byOrigin }, { status: 200 });
}
