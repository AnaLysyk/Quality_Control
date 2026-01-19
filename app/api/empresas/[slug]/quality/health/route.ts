import { NextResponse } from "next/server";
import { readGoalStatusStore } from "@/lib/qualityGoalAlerts";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";
import { calculateHealthScore } from "@/lib/healthScore";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const goalStatuses = await readGoalStatusStore();
  const goals = goalStatuses
    .filter((g) => g.company_slug === slug)
    .map((g) => (["met", "risk", "violated"].includes(g.status) ? (g.status as any) : "risk"));

  const gateHistory = await readQualityGateHistory(slug);
  const latestByRelease = new Map<string, any>();
  gateHistory.forEach((entry) => {
    const key = entry.release_slug;
    const current = latestByRelease.get(key);
    if (!current || String(entry.evaluated_at).localeCompare(String(current.evaluated_at)) > 0) {
      latestByRelease.set(key, entry);
    }
  });
  const releases = Array.from(latestByRelease.values())
    .sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)))
    .map((r) => {
      if (r.gate_status === "failed") return "violated";
      if (r.gate_status === "warning") return "risk";
      return "ok";
    });

  const input = {
    goals,
    trend: null, // trend opcional aqui; pode ser carregado e injetado depois
    releases,
  };
  const health = calculateHealthScore(input);
  return NextResponse.json(health, { status: 200 });
}
