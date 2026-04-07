import { NextResponse } from "next/server";
import { getCompanyQualitySummary, getCompanyDefectsExport } from "@/lib/companyQuality";
import { getAllReleases } from "@/release/data";
import { ensureSummaryAlerts, readAlertsStore } from "@/lib/qualityAlert";
import { getRedis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
import { calculateQualityScore } from "@/lib/qualityScore";

export async function GET(req: Request, context: { params: Promise<{ slug?: string }> }) {
    // Rate limit: 30 req/min per IP
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "unknown";
    const rate = await rateLimit(req, `dashboard-summary:${ip}`);
    if (rate.limited) return rate.response;
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || (context.params && (await context.params).slug) || null;
  if (!slug) {
    return NextResponse.json({ error: "Empresa não informada" }, { status: 400 });
  }
  const period = url.searchParams.get("period") || "30d";
  const cacheKey = `dash:${slug}:${period}`;
  const redis = getRedis();
  // Try cache first
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try {
      return NextResponse.json(JSON.parse(cached));
    } catch {}
  }

  // --- Original logic ---
  const summary = await getCompanyQualitySummary(slug);
  const defects = await getCompanyDefectsExport(slug);
  const defectItems = Array.isArray(defects)
    ? (defects as Array<{ status?: string; openedAt?: string }>)
    : [];
  const open = defectItems.filter((d) => d.status !== "done").length;
  const overSla = defectItems.filter((d) => {
    if (d.status === "done") return false;
    const opened = d.openedAt ? new Date(d.openedAt).getTime() : NaN;
    return Number.isFinite(opened) && Date.now() - opened > 172800000;
  }).length;
  const allReleases = await getAllReleases();
  const impacted = allReleases
    .filter((r) => r.project === slug || r.app === slug)
    .map((r) => ({ version: r.title, status: r.status || "unknown" }));

  try {
    await ensureSummaryAlerts({ companySlug: slug, summary, releases: impacted });
  } catch {}

  const allAlerts = await readAlertsStore();
  const recentAlerts = allAlerts
    .filter((a) => a.companySlug === slug)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((a) => new Date(a.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
    .slice(0, 10);

  const response = {
    score: summary.qualityScore,
    quality_score: calculateQualityScore({
      gate_status: summary.qualityScore >= 90 ? "approved" : summary.qualityScore >= 70 ? "warning" : "failed",
      mttr_hours: summary.mttrAvg ?? null,
      open_defects: summary.openDefects ?? null,
      fail_rate: undefined,
    }),
    mttr: { value: summary.mttrAvg, trend: "flat" },
    defects: { open, overSla },
    releases: impacted,
    alerts: recentAlerts,
  };
  // Cache only successful responses
  await redis.set(cacheKey, JSON.stringify(response), { ex: 120 });
  return NextResponse.json(response);
}
