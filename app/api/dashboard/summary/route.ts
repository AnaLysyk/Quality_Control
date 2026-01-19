import { NextResponse } from "next/server";
import { getCompanyQualitySummary, getCompanyDefects } from "@/lib/quality";
import { getAllReleases } from "@/release/data";
import { sendQualityAlert, readAlertsStore } from "@/lib/qualityAlert";
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
  const defects = await getCompanyDefects(slug);
  const open = defects.filter((d: any) => d.status !== "done").length;
  const overSla = defects.filter((d: any) => {
    if (d.status === "done") return false;
    const opened = new Date(d.openedAt).getTime();
    return Number.isFinite(opened) && Date.now() - opened > 172800000;
  }).length;
  const allReleases = await getAllReleases();
  const impacted = allReleases
    .filter((r) => r.project === slug || r.app === slug)
    .map((r) => ({ version: r.title, status: r.status || "unknown" }));

  if (summary.qualityScore < 70) {
    await sendQualityAlert({
      companySlug: slug,
      type: "quality_score",
      severity: "critical",
      message: `Quality Score crítico: ${summary.qualityScore}`,
      metadata: { score: summary.qualityScore },
      timestamp: new Date().toISOString(),
    });
  }
  if (summary.slaOverdue > 0) {
    await sendQualityAlert({
      companySlug: slug,
      type: "sla",
      severity: "critical",
      message: `Defeitos fora do SLA: ${summary.slaOverdue}`,
      metadata: { slaOverdue: summary.slaOverdue },
      timestamp: new Date().toISOString(),
    });
  }
  if (summary.mttrAvg != null && summary.mttrAvg > 48) {
    await sendQualityAlert({
      companySlug: slug,
      type: "mttr",
      severity: "critical",
      message: `MTTR alto: ${summary.mttrAvg} dias`,
      metadata: { mttr: summary.mttrAvg },
      timestamp: new Date().toISOString(),
    });
  }
  const failedRelease = impacted.find((r) => r.status === "failed");
  if (failedRelease) {
    await sendQualityAlert({
      companySlug: slug,
      type: "release_failed",
      severity: "critical",
      message: `Release falhou: ${failedRelease.version}`,
      metadata: { version: failedRelease.version },
      timestamp: new Date().toISOString(),
    });
  }

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
