import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { BrainGraphAnalyticsService } from "@/backend/brain/graphAnalyticsService";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "overview").trim().toLowerCase();
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
  const threshold = Number(url.searchParams.get("threshold") ?? "0.3");

  const analytics = new BrainGraphAnalyticsService();

  try {
    if (mode === "centrality") {
      const centrality = await analytics.calculateCentrality({ companySlug, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, centrality });
    }

    if (mode === "communities") {
      const communities = await analytics.identifyCommunities({ companySlug, minSize: 3 });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, communities });
    }

    if (mode === "orphans") {
      const orphanNodes = await analytics.identifyOrphanNodes({ companySlug, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, orphanNodes });
    }

    if (mode === "weak-relations") {
      const weakRelations = await analytics.identifyWeakRelations({ companySlug, threshold, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, threshold, weakRelations });
    }

    if (mode === "impact") {
      const highImpact = await analytics.identifyHighImpactEntities({ companySlug, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, highImpact });
    }

    if (mode === "bottlenecks") {
      const bottlenecks = await analytics.identifyQualityBottlenecks({ companySlug, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, bottlenecks });
    }

    if (mode === "suggestions") {
      const suggestions = await analytics.buildSuggestions({ companySlug, limit });
      return NextResponse.json({ mode, companySlug: companySlug ?? null, suggestions });
    }

    const [centrality, communities, orphanNodes, weakRelations, bottlenecks] = await Promise.all([
      analytics.calculateCentrality({ companySlug, limit: Math.min(limit, 20) }),
      analytics.identifyCommunities({ companySlug, minSize: 3 }),
      analytics.identifyOrphanNodes({ companySlug, limit: Math.min(limit, 50) }),
      analytics.identifyWeakRelations({ companySlug, threshold, limit: Math.min(limit, 50) }),
      analytics.identifyQualityBottlenecks({ companySlug, limit: Math.min(limit, 20) }),
    ]);

    return NextResponse.json({
      mode: "overview",
      companySlug: companySlug ?? null,
      centrality,
      communities,
      orphanNodes,
      weakRelations,
      bottlenecks,
    });
  } catch (error) {
    console.error("[brain/graph/analytics] GET error:", error);
    return NextResponse.json({ error: "Erro ao processar analytics do Brain" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req, { requireManage: true });
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { companySlug?: string };
    const companySlug = body.companySlug?.trim().toLowerCase();
    const analytics = new BrainGraphAnalyticsService();
    const result = await analytics.recalculateNodeScores({ companySlug });

    return NextResponse.json({
      ok: true,
      companySlug: companySlug ?? null,
      updated: result.updated,
      scores: result.scores,
    });
  } catch (error) {
    console.error("[brain/graph/analytics] POST error:", error);
    return NextResponse.json({ error: "Erro ao recalcular scores do Brain" }, { status: 500 });
  }
}

