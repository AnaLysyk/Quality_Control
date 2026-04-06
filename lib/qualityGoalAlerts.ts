import fs from "fs/promises";
import path from "path";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";

const STATUS_STORE = path.join(process.cwd(), "data", "quality_goal_status.json");
const ALERT_STORE = path.join(process.cwd(), "data", "quality_goal_alerts.json");
const STATUS_KEY = "qc:quality_goal_status:v1";
const ALERT_KEY = "qc:quality_goal_alerts:v1";
const USE_PERSISTENT_STORE = !USE_MEMORY_ALERTS && canUsePersistentJsonStore();
let memoryStatus: GoalStatusRecord[] = [];
let memoryAlerts: GoalAlert[] = [];

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
  if (USE_MEMORY_ALERTS) return memoryStatus;
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<GoalStatusRecord[]>(STATUS_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }
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
  if (USE_MEMORY_ALERTS) {
    memoryStatus = data;
    return;
  }
  if (USE_PERSISTENT_STORE) {
    await writePersistentJson(STATUS_KEY, data);
    return;
  }
  await ensureFile(STATUS_STORE, "[]");
  await fs.writeFile(STATUS_STORE, JSON.stringify(data, null, 2), "utf8");
}

export async function appendGoalAlert(alert: GoalAlert) {
  if (USE_MEMORY_ALERTS) {
    memoryAlerts = [...memoryAlerts, alert];
    return;
  }
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<GoalAlert[]>(ALERT_KEY, []);
    const next = [...(Array.isArray(persisted) ? persisted : []), alert];
    await writePersistentJson(ALERT_KEY, next);
    return;
  }
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
  if (USE_MEMORY_ALERTS) {
    let arr = [...memoryAlerts];
    if (companySlug) {
      arr = arr.filter((a) => a.company_slug === companySlug);
    }
    return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  if (USE_PERSISTENT_STORE) {
    let arr = await readPersistentJson<GoalAlert[]>(ALERT_KEY, []);
    if (!Array.isArray(arr)) arr = [];
    if (companySlug) {
      arr = arr.filter((a) => a.company_slug === companySlug);
    }
    return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
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
