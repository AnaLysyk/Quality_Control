
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "@/lib/jwtAuth";


export const runtime = "nodejs";
const BASE_DIR = path.resolve(process.cwd(), "data", "s3");

export async function GET(req: Request) {
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
    const data = await fs.readFile(target);
    // Defensive: sanitize filename for header
    const safeFilename = path.basename(target).replace(/"/g, '');
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}
