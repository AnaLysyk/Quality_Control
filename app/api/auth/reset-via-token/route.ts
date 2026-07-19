import { NextResponse } from "next/server";
import { hashPassword } from "@/backend/passwordHash";
import { updateLocalUser } from "@/backend/auth/localStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { consumePasswordResetToken } from "@/backend/auth/passwordResetToken";
import { rateLimit } from "@/backend/rateLimit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!token || token.length > 256 || !newPassword) {
    return NextResponse.json({ error: "Token e nova senha sao obrigatorios" }, { status: 400 });
  }

  const limiter = await rateLimit(req, `password-reset-consume:${token}`, 10, 60);
  if (limiter.limited) return limiter.response;

  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres" }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
  }

  try {
    const hashedPassword = hashPassword(newPassword);
    await updateLocalUser(userId, { password_hash: hashedPassword });
    addAuditLogSafe({
      action: "auth.password.reset",
      entityType: "user",
      entityId: userId,
      entityLabel: null,
      actorUserId: userId,
      actorEmail: null,
      metadata: { method: "token" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
