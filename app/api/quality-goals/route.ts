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
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("Formato inválido em quality_goal_status.json");
      return [];
    }
    return parsed.filter((item) => typeof item === "object" && item !== null);
  } catch (error) {
    console.error("Erro ao ler metas de qualidade:", error);
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
