import { NextResponse } from "next/server";
import { hashPasswordSha256 } from "@/backend/passwordHash";
import { updateLocalUser } from "@/backend/auth/localStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { consumePasswordResetToken } from "@/backend/auth/passwordResetToken";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token e nova senha obrigatorios" }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
  }

  const hashedPassword = hashPasswordSha256(newPassword);
  await updateLocalUser(userId, { password_hash: hashedPassword });

  addAuditLogSafe({
    actorUserId: userId,
    action: "auth.password.reset",
    entityType: "user",
    entityId: userId,
    metadata: { method: "reset_token" },
  });

  return NextResponse.json({ ok: true });
}

