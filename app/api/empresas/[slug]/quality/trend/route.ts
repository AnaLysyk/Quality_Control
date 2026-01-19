import { NextResponse } from "next/server";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";

type Trend = "improving" | "stable" | "degrading";

function calculateChangePercent(recent: number | null, previousAvg: number | null): number {
  if (recent == null || previousAvg == null) return 0;
  if (previousAvg === 0) return 0;
  return Math.round(((recent - previousAvg) / previousAvg) * 100);
}

function classifyTrend(mttrChange: number, defectsChange: number): Trend {
  const improving = mttrChange < -10 && defectsChange < -10;
  const degrading = mttrChange > 10 || defectsChange > 10;
  if (improving) return "improving";
  if (degrading) return "degrading";
  return "stable";
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const history = await readQualityGateHistory(slug);
  // Pega o snapshot mais recente por release
  const latestByRelease = new Map<string, any>();
  history.forEach((entry) => {
    const key = entry.release_slug;
    const current = latestByRelease.get(key);
    if (!current || String(entry.evaluated_at).localeCompare(String(current.evaluated_at)) > 0) {
      latestByRelease.set(key, entry);
    }
  });
  // Ordena por data desc e pega últimas 5
  const releases = Array.from(latestByRelease.values()).sort((a, b) =>
    String(b.evaluated_at).localeCompare(String(a.evaluated_at))
  );
  const window = releases.slice(0, 5);
  if (!window.length) {
    return NextResponse.json(
      { window: "last_5_releases", trend: "stable", metrics: { mttr_change_percent: 0, defects_change_percent: 0 } },
      { status: 200 }
    );
  }

  const recent = window[0];
  const previous = window.slice(1);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const prevMttrAvg = avg(previous.map((r) => r.mttr_hours ?? 0));
  const prevDefectsAvg = avg(previous.map((r) => r.open_defects ?? 0));

  const mttrChangePercent = calculateChangePercent(recent.mttr_hours ?? null, prevMttrAvg);
  const defectsChangePercent = calculateChangePercent(recent.open_defects ?? null, prevDefectsAvg);
  const trend = classifyTrend(mttrChangePercent, defectsChangePercent);

  return NextResponse.json(
    {
      window: "last_5_releases",
      trend,
      metrics: {
        mttr_change_percent: mttrChangePercent,
        defects_change_percent: defectsChangePercent,
      },
    },
    { status: 200 }
  );
}
