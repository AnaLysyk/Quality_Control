import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

// SVG placeholders for missing images
const AVATAR_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#e5e7eb"/>
  <circle cx="64" cy="48" r="24" fill="#9ca3af"/>
  <ellipse cx="64" cy="112" rx="40" ry="32" fill="#9ca3af"/>
</svg>`;

const LOGO_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#f3f4f6"/>
  <rect x="24" y="24" width="80" height="80" rx="8" fill="#d1d5db"/>
  <text x="64" y="72" font-family="sans-serif" font-size="24" fill="#6b7280" text-anchor="middle">Logo</text>
</svg>`;

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

function getPlaceholder(key: string): string | null {
  if (key.startsWith("avatars/")) return AVATAR_PLACEHOLDER_SVG;
  if (key.startsWith("logos/")) return LOGO_PLACEHOLDER_SVG;
  return null;
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
    // Return placeholder for avatars/logos, 404 for other files
    const placeholder = getPlaceholder(key);
    if (placeholder) {
      return new NextResponse(placeholder, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
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
