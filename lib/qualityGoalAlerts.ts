import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

const USE_POSTGRES = shouldUsePostgresPersistence();
async function getPrisma() {
  const { prisma } = await import("@/lib/prismaClient");
  return prisma;
}

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";

const STATUS_KEY = "qc:quality_goal_status:v1";
const ALERT_KEY = "qc:quality_goal_alerts:v1";
const USE_PERSISTENT_STORE = !USE_MEMORY_ALERTS && !USE_POSTGRES && canUsePersistentJsonStore();
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

export async function readGoalStatusStore(): Promise<GoalStatusRecord[]> {
  if (USE_MEMORY_ALERTS) return memoryStatus;
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.qualityGoalStatus.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((r) => ({ company_slug: r.companySlug, goal_id: r.goalId, status: r.status, updated_at: r.updatedAt.toISOString() }));
  }
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<GoalStatusRecord[]>(STATUS_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }
  return memoryStatus;
}

export async function writeGoalStatusStore(data: GoalStatusRecord[]) {
  if (USE_MEMORY_ALERTS) {
    memoryStatus = data;
    return;
  }
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    for (const record of data) {
      await prisma.qualityGoalStatus.upsert({
        where: { companySlug_goalId: { companySlug: record.company_slug, goalId: record.goal_id } },
        create: { companySlug: record.company_slug, goalId: record.goal_id, status: record.status },
        update: { status: record.status },
      });
    }
    return;
  }
  if (USE_PERSISTENT_STORE) {
    await writePersistentJson(STATUS_KEY, data);
    return;
  }
  memoryStatus = data;
}

export async function appendGoalAlert(alert: GoalAlert) {
  if (USE_MEMORY_ALERTS) {
    memoryAlerts = [...memoryAlerts, alert];
    return;
  }
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    await prisma.qualityGoalAlert.create({
      data: {
        companySlug: alert.company_slug,
        goalId: alert.goal_id,
        goal: alert.goal ?? null,
        fromStatus: alert.from,
        toStatus: alert.to,
        createdAt: new Date(alert.created_at),
      },
    });
    return;
  }
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<GoalAlert[]>(ALERT_KEY, []);
    const next = [...(Array.isArray(persisted) ? persisted : []), alert];
    await writePersistentJson(ALERT_KEY, next);
    return;
  }
  memoryAlerts = [...memoryAlerts, alert];
}

export async function readGoalAlerts(companySlug?: string): Promise<GoalAlert[]> {
  if (USE_MEMORY_ALERTS) {
    let arr = [...memoryAlerts];
    if (companySlug) arr = arr.filter((a) => a.company_slug === companySlug);
    return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  if (USE_POSTGRES) {
    const prisma = await getPrisma();
    const rows = await prisma.qualityGoalAlert.findMany({
      where: companySlug ? { companySlug } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ company_slug: r.companySlug, goal_id: r.goalId, goal: r.goal ?? undefined, from: r.fromStatus, to: r.toStatus, created_at: r.createdAt.toISOString() }));
  }
  if (USE_PERSISTENT_STORE) {
    let arr = await readPersistentJson<GoalAlert[]>(ALERT_KEY, []);
    if (!Array.isArray(arr)) arr = [];
    if (companySlug) arr = arr.filter((a) => a.company_slug === companySlug);
    return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  let arr = [...memoryAlerts];
  if (companySlug) arr = arr.filter((a) => a.company_slug === companySlug);
  return arr.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
