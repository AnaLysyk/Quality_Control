
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCompanyQualitySummary } from "@/lib/quality";
import clients from "@/data/mock-clients.json";
import { getAllReleases } from "@/release/data";
import { getRedis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";

// Helper to compute risk
function computeRisk(score: number, failedReleases: number) {
  if (score < 70) return "high";
  if (score < 85 || failedReleases > 0) return "medium";
  return "low";
}

export async function GET(req: Request) {
  // Rate limit: 30 req/min per IP
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(req, `admin-bench:${ip}`);
  if (rate.limited) return rate.response;

  // Observability: x-request-id and latency
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const start = Date.now();
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "30d";
  const cacheKey = `bench:${period}`;
  const redis = getRedis();
  // Try cache first
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try {
      const res = NextResponse.json(JSON.parse(cached));
      res.headers.set("x-request-id", requestId);
      console.log(JSON.stringify({ endpoint: "/api/admin/benchmark", requestId, period, latencyMs: Date.now() - start, status: 200, cache: true }));
      return res;
    } catch {}
  }

  // --- Original logic ---
  const companies = Array.isArray(clients) ? clients : [];
  const items = await Promise.all(
    companies.map(async (c: any) => {
      const slug = c.slug || c.company_name || c.name;
      const summary = await getCompanyQualitySummary(slug, period);
      const allReleases = await getAllReleases();
      // Treat only "FINALIZADA" as failed (type-safe)
      const failedReleases = allReleases.filter(
        (r) => (r.project === slug || r.app === slug) && r.status === "FINALIZADA"
      ).length;
      const trend = "flat";
      const risk = computeRisk(summary.qualityScore, failedReleases);
      return {
        companySlug: slug,
        companyName: summary.companyName,
        score: summary.qualityScore,
        mttrDays: summary.mttrAvg,
        openDefects: summary.openDefects,
        overSla: summary.slaOverdue,
        failedReleases,
        trend,
        risk,
      };
    })
  );
  const response = { period, items };
  // Cache only successful responses
  await redis.set(cacheKey, JSON.stringify(response), { ex: 120 });
  const res = NextResponse.json(response);
  res.headers.set("x-request-id", requestId);
  console.log(JSON.stringify({ endpoint: "/api/admin/benchmark", requestId, period, latencyMs: Date.now() - start, status: 200, cache: false }));
  return res;
}
