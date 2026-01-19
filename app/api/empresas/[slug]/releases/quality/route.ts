import { NextResponse } from "next/server";
import { getCompanyQualitySummary } from "@/lib/quality";
import { getAllReleases } from "@/release/data";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";
import { calculateQualityScore } from "@/lib/qualityScore";

type ReleaseQuality = {
  release: string;
  started_at?: string | null;
  ended_at?: string | null;
  defects: { total: number; open: number; closed: number };
  mttr_hours: number | null;
  quality_status: "ok" | "risk" | "violated";
  quality_score: number | null;
};

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const summary = await getCompanyQualitySummary(slug, "90d");
  const releases = await getAllReleases();
  const gateHistory = await readQualityGateHistory(slug);

  const items: ReleaseQuality[] = releases
    .filter((r) => r.project === slug || r.app === slug)
    .map((rel) => {
      const gate = gateHistory.find((g) => g.release_slug === rel.slug) ?? null;
      const mttr = gate?.mttr_hours ?? summary.mttrAvg ?? null;
      const openDefects = summary.openDefects ?? 0;
      const closedDefects = (summary.closedDefects as number | null) ?? 0;
      const totalDefects = openDefects + closedDefects;
      let quality_status: "ok" | "risk" | "violated" = "ok";
      if (gate?.gate_status === "failed") quality_status = "violated";
      else if (gate?.gate_status === "warning") quality_status = "risk";
      const quality_score =
        gate && typeof gate.fail_rate === "number"
          ? calculateQualityScore({
              gate_status: gate.gate_status,
              mttr_hours: gate.mttr_hours,
              open_defects: gate.open_defects,
              fail_rate: gate.fail_rate,
            })
          : null;
      return {
        release: rel.slug,
        started_at: rel.createdAt ?? null,
        ended_at: rel.closedAt ?? null,
        defects: {
          total: totalDefects,
          open: openDefects,
          closed: closedDefects,
        },
        mttr_hours: mttr,
        quality_status,
        quality_score,
      };
    })
    .sort((a, b) => String(b.started_at || b.release).localeCompare(String(a.started_at || a.release)));

  return NextResponse.json({ releases: items }, { status: 200 });
}
