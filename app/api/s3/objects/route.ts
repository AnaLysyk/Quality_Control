import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.join(process.cwd(), "data", "s3");

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
  const url = new URL(req.url);
  const prefix = url.searchParams.get("prefix")?.trim() ?? "";
  await fs.mkdir(BASE_DIR, { recursive: true });
  const objects = await listFiles(BASE_DIR, prefix);
  return NextResponse.json({ ok: true, objects });
}
