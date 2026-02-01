import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { getRedis } from "@/lib/redis";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

async function resolveUserId(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (sessionId) {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const id = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
        if (id) return id;
      } catch {
        return null;
      }
    }
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
  const cookieToken = readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function sanitizePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;

  const currentPassword = sanitizePassword(record?.currentPassword);
  const newPassword = sanitizePassword(record?.newPassword);

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Senha atual e nova senha sao obrigatorias" }, { status: 400 });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Nova senha deve ter entre 8 e 128 caracteres" }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Nova senha deve ser diferente da atual" }, { status: 400 });
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const currentHash = hashPasswordSha256(currentPassword);
  if (currentHash !== user.password_hash) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  const newHash = hashPasswordSha256(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newHash },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
