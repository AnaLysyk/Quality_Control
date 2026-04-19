import "server-only";

import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}

const USE_MEMORY_ALERTS =
  process.env.QUALITY_ALERTS_IN_MEMORY === "true" || process.env.NODE_ENV === "test";
const STORE_PATH = path && path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "quality_gate_history.json");
const STORE_KEY = "qc:quality_gate_history:v1";
const USE_PERSISTENT_STORE = !USE_MEMORY_ALERTS && canUsePersistentJsonStore();

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
  evaluated_at: string;
  decision?: "approved_with_override";
  override?: {
    by: string;
    reason: string;
    at: string;
  };
};

async function ensureStore() {
  if (USE_MEMORY_ALERTS || USE_PERSISTENT_STORE) return;
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

  if (USE_PERSISTENT_STORE) {
    const current = await readPersistentJson<QualityGateHistoryEntry[]>(STORE_KEY, []);
    const next = [...(Array.isArray(current) ? current : []), entry];
    await writePersistentJson(STORE_KEY, next);
    return;
  }

  if (!fs || !STORE_PATH) return;
  try {
    await ensureStore();
    const raw = await fs.readFile(STORE_PATH, "utf8");
    let arr: QualityGateHistoryEntry[] = [];
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? (parsed as QualityGateHistoryEntry[]) : [];
    } catch {
      arr = [];
    }
    arr.push(entry);
    await fs.writeFile(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.warn("qualityGateHistory: unable to write store", err);
  }
}

export async function readQualityGateHistory(
  companySlug?: string,
  releaseSlug?: string,
): Promise<QualityGateHistoryEntry[]> {
  let arr: QualityGateHistoryEntry[] = [];

  if (USE_MEMORY_ALERTS) {
    arr = [...memoryStore];
  } else if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<QualityGateHistoryEntry[]>(STORE_KEY, []);
    arr = Array.isArray(persisted) ? persisted : [];
  } else {
    if (!fs || !STORE_PATH) return [];
    try {
      await ensureStore();
      const raw = await fs.readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? (parsed as QualityGateHistoryEntry[]) : [];
    } catch (err) {
      console.warn("qualityGateHistory: unable to read store", err);
      return [];
    }
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
