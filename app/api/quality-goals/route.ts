import { NextResponse } from "next/server";
import { readGoalStatusStore } from "@/backend/qualityGoalAlerts";
import { requirePermission } from "@/backend/rbac/requirePermission";

export const runtime = "nodejs";

type QualityGoal = {
  company_slug?: string;
  goal?: string;
  status?: string;
  value?: number;
  target?: number;
  evaluated_at?: string;
};

export async function GET(req: Request) {
  const guard = await requirePermission(req, "metrics", "view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug") || url.searchParams.get("company") || null;
  const goals = await readGoalStatusStore();
  const normalized: QualityGoal[] = goals.map((item) => ({
    company_slug: item.company_slug,
    goal: item.goal_id,
    status: item.status,
    evaluated_at: item.updated_at,
  }));

  const filtered = companySlug
    ? normalized.filter((item) => (item.company_slug ?? "").toLowerCase() === companySlug.toLowerCase())
    : normalized;

  return NextResponse.json({ items: filtered }, { status: 200 });
}
