import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  // Fetch quality metrics
  const [qualityRes, trendRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/empresas/${slug}/metrics/quality`),
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/empresas/${slug}/metrics/trend`),
  ]);
  const quality = await qualityRes.json();
  const trend = await trendRes.json();
  const alerts = [];

  // SLA alert
  if (quality.overSlaCount > 0) {
    alerts.push({
      type: "sla",
      severity: "critical",
      message: `${quality.overSlaCount} defeitos fora do SLA`,
    });
  }

  // MTTR trend alert
  if (trend.mttr && trend.mttr.current != null && trend.mttr.delta > 0) {
    alerts.push({
      type: "mttr",
      severity: "warning",
      message: `MTTR aumentou em ${Math.round(trend.mttr.delta)}h`,
    });
  }

  return NextResponse.json({ alerts }, { status: 200 });
}
