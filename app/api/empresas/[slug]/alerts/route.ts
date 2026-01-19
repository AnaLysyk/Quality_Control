import { NextResponse } from "next/server";
import { readGoalAlerts } from "@/lib/qualityGoalAlerts";

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const alerts = await readGoalAlerts(slug);
  return NextResponse.json(alerts, { status: 200 });
}
