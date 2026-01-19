import fs from "fs/promises";
import path from "path";

const STATUS_STORE = path.join(process.cwd(), "data", "quality_goal_status.json");
const ALERT_STORE = path.join(process.cwd(), "data", "quality_goal_alerts.json");

export type GoalStatusRecord = {
  company_slug: string;
  goal_id: string;
  status: string;
  updated_at: string;
};

export type GoalAlert = {
  company_slug: string;
  goal_id: string;
  from: string | null;
  to: string;
  created_at: string;
  goal?: string;
};

async function ensureFile(filePath: string, initial: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initial, "utf8");
  }
}

export async function readGoalStatusStore(): Promise<GoalStatusRecord[]> {
  await ensureFile(STATUS_STORE, "[]");
  try {
    const raw = await fs.readFile(STATUS_STORE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoalStatusRecord[]) : [];
  } catch {
    return [];
  }
}

export async function writeGoalStatusStore(data: GoalStatusRecord[]) {
  await ensureFile(STATUS_STORE, "[]");
  await fs.writeFile(STATUS_STORE, JSON.stringify(data, null, 2), "utf8");
}

export async function appendGoalAlert(alert: GoalAlert) {
  await ensureFile(ALERT_STORE, "[]");
  let arr: GoalAlert[] = [];
  try {
    const raw = await fs.readFile(ALERT_STORE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) arr = parsed as GoalAlert[];
  } catch {
    arr = [];
  }
  arr.push(alert);
  await fs.writeFile(ALERT_STORE, JSON.stringify(arr, null, 2), "utf8");
}

export async function readGoalAlerts(companySlug?: string): Promise<GoalAlert[]> {
  await ensureFile(ALERT_STORE, "[]");
  try {
    const raw = await fs.readFile(ALERT_STORE, "utf8");
    const parsed = JSON.parse(raw);
    let arr: GoalAlert[] = Array.isArray(parsed) ? (parsed as GoalAlert[]) : [];
    if (companySlug) {
      arr = arr.filter((a) => a.company_slug === companySlug);
    }
    return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  } catch {
    return [];
  }
}
