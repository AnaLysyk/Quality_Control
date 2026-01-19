import { NextResponse } from "next/server";
import { getCompanyQualitySummary, getCompanyDefects } from "@/lib/quality";
import { getAllReleases } from "@/release/data";
import { appendGoalAlert, readGoalAlerts, readGoalStatusStore, writeGoalStatusStore } from "@/lib/qualityGoalAlerts";

type Operator = ">=" | "<=";
type GoalType = "score" | "gate" | "mttr";

type QualityGoal = {
  id: string;
  company_slug: string | null;
  type: GoalType;
  operator: Operator;
  value: number;
  period: "30d" | "90d";
};

type GoalStatus = "met" | "risk" | "violated";

const DEFAULT_GOALS: QualityGoal[] = [
  { id: "goal-score-85", company_slug: null, type: "score", operator: ">=", value: 85, period: "30d" },
  { id: "goal-mttr-72h", company_slug: null, type: "mttr", operator: "<=", value: 72, period: "30d" },
  { id: "goal-gate-no-fail", company_slug: null, type: "gate", operator: "<=", value: 0, period: "30d" },
];

function evaluateStatus(current: number | null | undefined, goal: QualityGoal): GoalStatus {
  if (current == null) return "risk";
  const diff = current - goal.value;
  if (goal.operator === ">=") {
    if (current >= goal.value) return "met";
    if (diff >= -5) return "risk";
    return "violated";
  }
  // <=
  if (current <= goal.value) return "met";
  if (diff <= 5) return "risk";
  return "violated";
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  // Goals: global defaults + específicos da empresa se existissem
  const goals = DEFAULT_GOALS.filter((g) => g.company_slug === null || g.company_slug === slug);

  // Dados existentes
  const summary = await getCompanyQualitySummary(slug, "30d");
  const defects = await getCompanyDefects(slug, "30d");
  const openDefects = defects.filter((d: any) => d.status !== "done").length;
  const releases = await getAllReleases();
  const failedReleases = releases.filter((r) => r.project === slug || r.app === slug).filter((r) => (r.status ?? "").toLowerCase() === "failed").length;

  const prevStatuses = await readGoalStatusStore();
  const now = new Date().toISOString();
  const items = goals.map((goal) => {
    let current = 0;
    let goalLabel = "";
    if (goal.type === "score") {
      current = summary.qualityScore ?? 0;
      goalLabel = "Score médio";
    } else if (goal.type === "mttr") {
      current = summary.mttrAvg ?? 0;
      goalLabel = "MTTR médio (h)";
    } else if (goal.type === "gate") {
      current = failedReleases;
      goalLabel = "Releases bloqueadas";
    }
    const status = evaluateStatus(current, goal);
    const goalText = `${goalLabel} ${goal.operator} ${goal.value}`;
    const prev = prevStatuses.find((s) => s.company_slug === slug && s.goal_id === goal.id);
    if (!prev || prev.status !== status) {
      appendGoalAlert({
        company_slug: slug,
        goal_id: goal.id,
        from: prev?.status ?? null,
        to: status,
        created_at: now,
        goal: goalText,
      }).catch(() => {});
    }
    return {
      id: goal.id,
      goal: goalText,
      current,
      status,
    };
  });

  // persistir status atual
  const nextStatus = goals.map((g, idx) => ({
    company_slug: slug,
    goal_id: g.id,
    status: items[idx]?.status ?? "risk",
    updated_at: now,
  }));
  await writeGoalStatusStore([
    ...prevStatuses.filter((s) => s.company_slug !== slug),
    ...nextStatus,
  ]);

  return NextResponse.json(items, { status: 200 });
}
