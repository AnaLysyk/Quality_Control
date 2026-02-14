
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "@/lib/jwtAuth";

const BASE_DIR = path.resolve(process.cwd(), "data", "s3");

async function listFiles(dir: string, prefix: string, out: string[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(BASE_DIR, full).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      await listFiles(full, prefix, out);
    } else if (!prefix || rel.startsWith(prefix)) {
      out.push(rel);
    }
  }
  return out;
}

export async function GET(req: Request) {
  // Authenticate user (JWT, etc.)
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const prefix = url.searchParams.get("prefix")?.trim() ?? "";

  // Path traversal protection for prefix
  if (prefix && (prefix.includes("..") || prefix.startsWith("/"))) {
    return NextResponse.json({ ok: false, error: "invalid prefix" }, { status: 400 });
  }

  try {
    await fs.mkdir(BASE_DIR, { recursive: true });
    const objects = await listFiles(BASE_DIR, prefix);
    return NextResponse.json({ ok: true, objects });
  } catch (err) {
    console.error("GET s3 objects error", err);
    return NextResponse.json({ ok: false, error: "list failed" }, { status: 500 });
  }
}
