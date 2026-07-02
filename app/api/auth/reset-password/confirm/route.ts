import { NextResponse } from "next/server";

import { consumePasswordResetToken } from "@/lib/auth/passwordResetToken";
import { updateLocalUser } from "@/lib/auth/localStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { addAuditLogSafe } from "@/data/auditLogRepository";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string | null; newPassword?: string | null } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token e nova senha obrigatÃ³rios" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres" }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token invÃ¡lido ou expirado" }, { status: 400 });
  }

  await updateLocalUser(userId, { password_hash: hashPasswordSha256(newPassword) });

  addAuditLogSafe({
    actorUserId: userId,
    action: "auth.password.reset",
    entityType: "user",
    entityId: userId,
    metadata: { method: "reset_password_confirm" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

