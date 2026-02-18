import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "data", "history-log.json");

async function readHistory() {
  try {
    const data = await fs.readFile(HISTORY_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url!);
  const companyId = searchParams.get("companyId");
  const userId = searchParams.get("userId");
  const entityType = searchParams.get("entityType");
  const dateStart = searchParams.get("dateStart");
  const dateEnd = searchParams.get("dateEnd");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  let history = await readHistory();
  if (companyId) history = history.filter((e: any) => e.companyId === companyId);
  if (userId) history = history.filter((e: any) => e.userId === userId);
  if (entityType) history = history.filter((e: any) => e.entityType === entityType);
  if (dateStart) history = history.filter((e: any) => new Date(e.timestamp) >= new Date(dateStart));
  if (dateEnd) history = history.filter((e: any) => new Date(e.timestamp) <= new Date(dateEnd));
  const total = history.length;
  const paginated = history.slice(offset, offset + limit);
  return NextResponse.json({ total, events: paginated });
}
