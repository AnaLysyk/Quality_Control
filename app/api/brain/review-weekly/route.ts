import { NextResponse } from "next/server";

import { getBrainGaps } from "@/lib/brain";
import { BrainGraphAnalyticsService } from "@/lib/brain/graphAnalyticsService";
import { resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase() || undefined;

  const analytics = new BrainGraphAnalyticsService();

  try {
    const [highImpact, suggestions, staleMemories, scriptsBroken, pendingInbox, gaps] = await Promise.all([
      analytics.identifyHighImpactEntities({ companySlug, limit: 15 }),
      prisma.brainSuggestion.findMany({
        where: { status: "suggested", ...(companySlug ? { companySlug } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.brainMemory.findMany({
        where: {
          status: "ACTIVE",
          updatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: "asc" },
        take: 30,
      }),
      prisma.brainNode.findMany({
        where: {
          type: "AutomationScript",
          OR: [
            { metadata: { path: ["status"], equals: "broken" } },
            { metadata: { path: ["flakiness"], equals: "high" } },
          ],
        },
        take: 30,
      }),
      prisma.brainInboxItem.findMany({
        where: { status: "pending", ...(companySlug ? { companySlug } : {}) },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      getBrainGaps({ companySlug, sampleSize: 80 }),
    ]);

    const scriptsWithoutCase = suggestions.filter((item) => item.type === "test_gap").slice(0, 20);
    const orphanNodes = suggestions.filter((item) => item.type === "orphan_node").slice(0, 20);
    const defectsWithoutRun = gaps.samples.defectsWithoutRun.slice(0, 20);
    const casesWithoutPlan = gaps.samples.casesWithoutPlan.slice(0, 20);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      companySlug: companySlug ?? null,
      summary: {
        highImpact: highImpact.length,
        pendingSuggestions: suggestions.length,
        pendingInbox: pendingInbox.length,
        staleMemories: staleMemories.length,
        scriptsBroken: scriptsBroken.length,
        scriptsWithoutCase: scriptsWithoutCase.length,
        orphanNodes: orphanNodes.length,
        defectsWithoutRunCandidates: gaps.summary.defectsWithoutRun,
        casesWithoutPlanCandidates: gaps.summary.casesWithoutPlan,
      },
      items: {
        highImpact,
        suggestions,
        pendingInbox,
        staleMemories,
        scriptsBroken,
        scriptsWithoutCase,
        orphanNodes,
        defectsWithoutRun,
        casesWithoutPlan,
      },
    });
  } catch (error) {
    console.error("[brain/review-weekly] GET error:", error);
    return NextResponse.json({ error: "Erro ao montar revisÃ£o semanal do Brain" }, { status: 500 });
  }
}

