
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "@/lib/jwtAuth";


export const runtime = "nodejs";
const BASE_DIR = path.resolve(process.cwd(), "data", "s3");

export async function POST(req: Request) {
  // Authenticate user (JWT, etc.)
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid form" }, { status: 400 });
  }

  const file = form.get("file");
  const keyRaw = form.get("key");
  const key = typeof keyRaw === "string" && keyRaw.trim() ? keyRaw.trim() : null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }

  // Defensive: sanitize key (block path traversal)
  let safeKey = key ?? file.name ?? `upload-${Date.now()}`;
  if (safeKey.includes("..") || safeKey.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }

  // Only allow relative keys (no absolute path)
  const target = path.resolve(BASE_DIR, safeKey);
  if (!target.startsWith(BASE_DIR)) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return NextResponse.json({ ok: true, key: safeKey, size: buffer.length }, { status: 200 });
  } catch (err) {
    console.error("POST s3 upload error", err);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }
}
