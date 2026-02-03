import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const STORE_PATH = path.join(process.cwd(), "data", "quality_goal_status.json");

type QualityGoal = {
  company_slug?: string;
  goal?: string;
  status?: string;
  value?: number;
  target?: number;
  evaluated_at?: string;
};

async function readGoals(): Promise<QualityGoal[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QualityGoal[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug") || url.searchParams.get("company") || null;
  const goals = await readGoals();
  const filtered = companySlug
    ? goals.filter((item) => (item.company_slug ?? "").toLowerCase() === companySlug.toLowerCase())
    : goals;

  return NextResponse.json({ items: filtered }, { status: 200 });
}
