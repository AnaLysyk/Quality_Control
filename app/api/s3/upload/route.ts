import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid form" }, { status: 400 });
  }

  const file = form.get("file");
  const keyRaw = form.get("key");
  const key = typeof keyRaw === "string" && keyRaw.trim() ? keyRaw.trim() : null;

  if (!file || !(file instanceof File)) {
    return new NextResponse("missing file", { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeKey = key ?? file.name ?? `upload-${Date.now()}`;
  const target = path.join(BASE_DIR, safeKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);

  return NextResponse.json({ ok: true, key: safeKey, size: buffer.length }, { status: 200 });
}
