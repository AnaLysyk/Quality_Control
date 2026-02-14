import fs from "fs/promises";
import path from "path";
const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";

const STATUS_STORE = path.join(process.cwd(), "data", "quality_goal_status.json");
const ALERT_STORE = path.join(process.cwd(), "data", "quality_goal_alerts.json");
let memoryStatus: GoalStatusRecord[] = [];
let memoryAlerts: GoalAlert[] = [];

/**
 * Registro de status de meta de qualidade para uma empresa.
 */
export type GoalStatusRecord = {
  company_slug: string;
  goal_id: string;
  status: string;
  updated_at: string;
};

/**
 * Alerta de mudança de status de meta de qualidade.
 */
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

/**
 * Lê o store de status de metas de qualidade.
 * @returns Lista de registros de status
 */
export async function readGoalStatusStore(): Promise<GoalStatusRecord[]> {
  if (USE_MEMORY_ALERTS) return memoryStatus;
  await ensureFile(STATUS_STORE, "[]");
  try {
    const raw = await fs.readFile(STATUS_STORE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoalStatusRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persiste a lista de status de metas de qualidade.
 * @param data Lista de registros de status
 */
export async function writeGoalStatusStore(data: GoalStatusRecord[]) {
  if (USE_MEMORY_ALERTS) {
    memoryStatus = data;
    return;
  }
  await ensureFile(STATUS_STORE, "[]");
  await fs.writeFile(STATUS_STORE, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Adiciona um alerta de meta de qualidade ao store.
 * @param alert Alerta a ser adicionado
 */
export async function appendGoalAlert(alert: GoalAlert) {
  if (USE_MEMORY_ALERTS) {
    memoryAlerts = [...memoryAlerts, alert];
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

/**
 * Lê os alertas de meta de qualidade, filtrando por empresa se informado.
 * @param companySlug Slug da empresa (opcional)
 * @returns Lista de alertas
 */
export async function readGoalAlerts(companySlug?: string): Promise<GoalAlert[]> {
  if (USE_MEMORY_ALERTS) {
    let arr = [...memoryAlerts];
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
