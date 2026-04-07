import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById, updateLocalUser } from "@/lib/auth/localStore";

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

function extractObjectKey(avatarUrl?: string | null) {
  if (!avatarUrl) return null;
  const marker = "/api/s3/object?key=";
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = avatarUrl.slice(idx + marker.length).trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveTarget(key: string) {
  const target = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

export async function POST(req: Request) {
  try {
    const access = await getAccessContext(req);
    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const user = await getLocalUserById(access.userId);
    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
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
    const userSegment = safeSegment(user.id || "user");
    const key = path.posix.join("avatars", `${userSegment}-${Date.now()}-${randomUUID()}${ext}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const target = resolveTarget(key);
    if (!target) {
      return NextResponse.json({ error: "Arquivo invalido" }, { status: 400 });
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    const previousKey = extractObjectKey(user.avatar_url);
    if (previousKey && previousKey !== key) {
      const previousTarget = resolveTarget(previousKey);
      if (previousTarget) {
        await fs.rm(previousTarget, { force: true }).catch(() => undefined);
      }
    }

    const avatarUrl = `/api/s3/object?key=${encodeURIComponent(key)}`;
    const updated = await updateLocalUser(user.id, { avatar_url: avatarUrl });
    if (!updated) {
      return NextResponse.json({ error: "Nao foi possivel atualizar o avatar" }, { status: 500 });
    }

    addAuditLogSafe({
      action: "user.avatar.changed",
      entityType: "user",
      entityId: user.id,
      entityLabel: updated.user ?? updated.email ?? null,
      actorUserId: user.id,
      actorEmail: updated.email ?? null,
      metadata: {},
    });

    const displayName =
      (typeof updated.full_name === "string" ? updated.full_name.trim() : "") ||
      (typeof updated.name === "string" ? updated.name.trim() : "") ||
      updated.email;

    return NextResponse.json(
      {
        ok: true,
        avatarUrl,
        user: {
          id: updated.id,
          email: updated.email,
          name: displayName,
          user: updated.user ?? updated.email,
          username: updated.user ?? updated.email,
          phone: updated.phone ?? null,
          avatarUrl: updated.avatar_url ?? null,
          active: updated.active !== false,
          status: updated.active === false ? "inactive" : updated.status ?? "active",
          jobTitle: updated.job_title ?? null,
          job_title: updated.job_title ?? null,
          linkedinUrl: updated.linkedin_url ?? null,
          linkedin_url: updated.linkedin_url ?? null,
          fullName: updated.full_name ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Nao foi possivel enviar a foto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
