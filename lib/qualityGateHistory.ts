// Utilitário para registrar snapshot do quality gate
import fs from "fs/promises";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "data", "quality_gate_history.json");

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
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

export async function appendQualityGateHistory(entry: QualityGateHistoryEntry) {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  let arr: QualityGateHistoryEntry[] = [];
  try {
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch {}
  arr.push(entry);
  await fs.writeFile(STORE_PATH, JSON.stringify(arr, null, 2), "utf8");
}
