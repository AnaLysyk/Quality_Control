import { NextResponse } from "next/server";

import { consumePasswordResetToken } from "@/backend/auth/passwordResetToken";
import { updateLocalUser } from "@/backend/auth/localStore";
import { hashPassword } from "@/backend/passwordHash";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { rateLimit } from "@/backend/rateLimit";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string | null; newPassword?: string | null } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token || token.length > 256 || !newPassword) {
    return NextResponse.json({ error: "Token e nova senha obrigatórios" }, { status: 400 });
  }

  const limiter = await rateLimit(req, `password-reset-consume:${token}`, 10, 60);
  if (limiter.limited) return limiter.response;

  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres" }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 400 });
  }

  await updateLocalUser(userId, { password_hash: hashPassword(newPassword) });

  addAuditLogSafe({
    actorUserId: userId,
    action: "auth.password.reset",
    entityType: "user",
    entityId: userId,
    metadata: { method: "reset_password_confirm" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
