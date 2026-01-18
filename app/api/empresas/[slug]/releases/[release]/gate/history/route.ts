import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "data", "quality_gate_history.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request, context: { params: Promise<{ slug: string; release: string }> }) {
  const { slug, release } = await context.params;
  const all = await readStore();
  const filtered = all.filter(
    (item: any) => item.company_slug === slug && item.release_slug === release
  );
  filtered.sort((a: any, b: any) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
  return NextResponse.json(filtered);
}
