
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "@/lib/jwtAuth";


export const runtime = "nodejs";
const BASE_DIR = path.resolve(process.cwd(), "data", "s3");

export async function DELETE(req: Request) {
  // Authenticate user (JWT, etc.)
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
  }

  // Path traversal protection
  const target = path.resolve(BASE_DIR, key);
  if (!target.startsWith(BASE_DIR)) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }

  try {
    await fs.rm(target, { force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log error for audit
    console.error("DELETE s3 object error", err);
    return NextResponse.json({ ok: false, error: "delete failed" }, { status: 500 });
  }
}
