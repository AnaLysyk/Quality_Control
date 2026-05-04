import { NextResponse } from "next/server";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { findLocalUserByEmailOrId, updateLocalUser } from "@/lib/auth/localStore";
import { addAuditLogSafe } from "@/data/auditLogRepository";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = typeof body?.user === "string" ? body.user.trim().toLowerCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!login || !email || !newPassword) {
    return NextResponse.json(
      { error: "Usuário, email e nova senha obrigatorios." },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `A nova senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const user = await findLocalUserByEmailOrId(login);
  if (!user || (user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Usuário e email não conferem." }, { status: 400 });
  }

  try {
    const hashedPassword = hashPasswordSha256(newPassword);
    await updateLocalUser(user.id, { password_hash: hashedPassword });
    addAuditLogSafe({
      action: "auth.password.reset",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.user ?? user.email ?? null,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      metadata: { method: "direct" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resetting password via direct flow:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
