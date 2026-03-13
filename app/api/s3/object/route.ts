import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

function contentTypeFromFile(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function resolveTarget(key: string) {
  const target = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
  }

  const target = resolveTarget(key);
  if (!target) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }
  try {
    const data = await fs.readFile(target);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFile(key),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });
  }

  const target = resolveTarget(key);
  if (!target) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }
  try {
    await fs.rm(target, { force: true });
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
