import { NextResponse } from "next/server";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function getStatus(score: number) {
  if (score >= 80) return { status: "healthy", badge: "🟢 Saudável" };
  if (score >= 60) return { status: "attention", badge: "🟡 Atenção" };
  return { status: "risk", badge: "🔴 Em risco" };
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  // Fetch metrics
  const [qualityRes, trendRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/empresas/${slug}/metrics/quality`),
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/empresas/${slug}/metrics/trend`),
  ]);
  const quality = await qualityRes.json();
  const trend = await trendRes.json();

  let score = 100;
  let overSla = quality.overSlaCount ?? null;
  let mttrDelta = trend.mttr?.delta ?? null;
  let openCount = quality.openCount ?? null;
  let openPrev = trend.openPrevious ?? null;
  let openTrend: "up" | "down" | "same" | null = null;

  // Penalidades
  if (typeof overSla === "number" && overSla > 0) score -= overSla * 10;
  if (typeof mttrDelta === "number" && mttrDelta > 0) score -= 5;
  if (typeof openCount === "number" && typeof openPrev === "number") {
    if (openCount > openPrev) {
      score -= 5;
      openTrend = "up";
    } else if (openCount < openPrev) {
      openTrend = "down";
    } else {
      openTrend = "same";
    }
  }
  score = clamp(score, 0, 100);

  // Status
  const { status } = getStatus(score);

  // Signals
  const signals = {
    overSla: overSla ?? 0,
    mttrTrend: mttrDelta == null ? null : mttrDelta > 0 ? "up" : mttrDelta < 0 ? "down" : "same",
    openTrend,
  };

  return NextResponse.json({ score, status, signals }, { status: 200 });
}
