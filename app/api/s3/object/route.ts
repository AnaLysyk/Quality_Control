import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
  }

  const target = path.join(BASE_DIR, key);
  try {
    await fs.rm(target, { force: true });
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
