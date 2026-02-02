import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
  }

  const target = path.join(BASE_DIR, key);
  try {
    const data = await fs.readFile(target);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${path.basename(target)}`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}
