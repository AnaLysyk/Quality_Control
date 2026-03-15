import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { getAccessContext } from "@/lib/auth/session";
import { updateLocalCompany } from "@/lib/auth/localStore";

export const runtime = "nodejs";

const BASE_DIR = path.join(process.cwd(), "data", "s3");
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function safeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveTarget(key: string) {
  const target = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

function extractObjectKey(logoUrl?: string | null) {
  if (!logoUrl) return null;
  const marker = "/api/s3/object?key=";
  const idx = logoUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = logoUrl.slice(idx + marker.length).trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await getAccessContext(req);
    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "ID da empresa invalido" }, { status: 400 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Formulario invalido" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Envie uma imagem valida" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter no maximo 5 MB" }, { status: 400 });
    }

    const ext = path.extname(file.name || "").toLowerCase() || ".png";
    const companySegment = safeSegment(id.trim());
    const key = path.posix.join("logos", `${companySegment}-${Date.now()}-${randomUUID()}${ext}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const target = resolveTarget(key);
    if (!target) {
      return NextResponse.json({ error: "Arquivo invalido" }, { status: 400 });
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    const logoUrl = `/api/s3/object?key=${encodeURIComponent(key)}`;

    // Fetch current logo to clean up old file
    const { findLocalCompanyById } = await import("@/lib/auth/localStore");
    const existing = await findLocalCompanyById(id.trim());
    if (existing) {
      const previousKey = extractObjectKey(existing.logo_url as string | null);
      if (previousKey && previousKey !== key) {
        const previousTarget = resolveTarget(previousKey);
        if (previousTarget) {
          await fs.rm(previousTarget, { force: true }).catch(() => undefined);
        }
      }
    }

    const updated = await updateLocalCompany(id.trim(), { logo_url: logoUrl });
    if (!updated) {
      return NextResponse.json({ error: "Nao foi possivel atualizar o logo" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logoUrl }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Nao foi possivel enviar o logo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
