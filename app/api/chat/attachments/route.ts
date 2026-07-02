import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { getAccessContext } from "@/lib/auth/session";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";
import type { ChatAttachment } from "@/lib/chatStore";

export const runtime = "nodejs";
export const revalidate = 0;

const BASE_DIR = path.join(process.cwd(), "data", "s3");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

function safeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveTarget(key: string) {
  const target = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) return null;
  return target;
}

function extensionFor(file: File) {
  if (file.type === "image/png") return ".png";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  if (file.type === "application/pdf") return ".pdf";
  return ".txt";
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function sourceLabelFor(file: File) {
  if (file.type === "image/gif") return "GIF";
  if (file.type.startsWith("image/")) return "Imagem";
  if (file.type === "application/pdf") return "PDF";
  return "Arquivo";
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });

  const files = form
    .getAll("files")
    .filter((item): item is File => item instanceof File)
    .slice(0, MAX_FILES);

  const fallbackFile = form.get("file");
  if (files.length === 0 && fallbackFile instanceof File) files.push(fallbackFile);
  if (files.length === 0) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const userSegment = safeSegment(access.userId || "user") || "user";
  const attachments: ChatAttachment[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: ${file.name || "sem nome"}` }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: `Arquivo vazio: ${file.name || "sem nome"}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Arquivo acima de 10 MB: ${file.name || "sem nome"}` }, { status: 400 });
    }

    const safeName = safeSegment(file.name || "arquivo") || "arquivo";
    const key = path.posix.join("chat", userSegment, `${Date.now()}-${randomUUID()}-${safeName}${extensionFor(file)}`);
    const target = resolveTarget(key);
    if (!target) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));

    attachments.push({
      id: randomUUID(),
      kind: "file",
      label: file.name || "Arquivo",
      url: `/api/s3/object?key=${encodeURIComponent(key)}`,
      mimeType: file.type,
      sizeLabel: formatSize(file.size),
      sourceLabel: sourceLabelFor(file),
    });
  }

  return NextResponse.json({ ok: true, attachments }, { headers: NO_STORE_HEADERS });
}

