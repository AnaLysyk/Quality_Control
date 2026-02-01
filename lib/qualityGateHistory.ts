// Utilitário para registrar snapshot do quality gate
// Importa fs e path só em ambiente Node/server
let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}
const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";

const STORE_PATH = path && path.join(process.cwd(), "data", "quality_gate_history.json");
let memoryStore: QualityGateHistoryEntry[] = [];
export type QualityGateHistoryEntry = {
  id: string;
  company_slug: string;
  release_slug: string;
  gate_status: "approved" | "warning" | "failed";
  mttr_hours: number;
  open_defects: number;
  fail_rate: number;
  reasons: string[];
  evaluated_at: string; // ISO
  // Campos para override explícito
  decision?: "approved_with_override";
  override?: {
    by: string;
    reason: string;
    at: string;
  };
};

async function ensureStore() {
  if (USE_MEMORY_ALERTS) return;
  if (!fs || !path || !STORE_PATH) return;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

export async function appendQualityGateHistory(entry: QualityGateHistoryEntry) {
  if (USE_MEMORY_ALERTS) {
    memoryStore = [...memoryStore, entry];
    return;
  }
  if (!fs || !STORE_PATH) return;
  try {
    await ensureStore();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    let arr: QualityGateHistoryEntry[] = [];
    try {
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch {}
    arr.push(entry);
    await fs.writeFile(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.warn("qualityGateHistory: unable to write store", err);
  }
}

export async function readQualityGateHistory(companySlug?: string, releaseSlug?: string): Promise<QualityGateHistoryEntry[]> {
  if (USE_MEMORY_ALERTS) {
    let arr = [...memoryStore];
    if (companySlug) {
      arr = arr.filter((item) => item.company_slug === companySlug);
    }
    if (releaseSlug) {
      arr = arr.filter((item) => item.release_slug === releaseSlug);
    }
    arr.sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
    return arr;
  }
  if (!fs || !STORE_PATH) return [];
  try {
    await ensureStore();
  } catch (err) {
    console.warn("qualityGateHistory: unable to ensure store", err);
    return [];
  }
  let raw = "";
  try {
    raw = await fs.readFile(STORE_PATH, "utf8");
  } catch (err) {
    console.warn("qualityGateHistory: unable to read store", err);
    return [];
  }
  let arr: QualityGateHistoryEntry[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) arr = parsed as QualityGateHistoryEntry[];
  } catch {
    arr = [];
  }
  if (companySlug) {
    arr = arr.filter((item) => item.company_slug === companySlug);
  }
  if (releaseSlug) {
    arr = arr.filter((item) => item.release_slug === releaseSlug);
  }
  arr.sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
  return arr;
}
