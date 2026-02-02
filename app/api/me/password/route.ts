import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById, updateLocalUser } from "@/lib/auth/localStore";
import { hashPasswordSha256, safeEqualHex } from "@/lib/passwordHash";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

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

  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const user = await getLocalUserById(access.userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const currentHash = hashPasswordSha256(currentPassword);
  if (!safeEqualHex(currentHash, user.password_hash)) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  const newHash = hashPasswordSha256(newPassword);
  await updateLocalUser(user.id, { password_hash: newHash });

  return NextResponse.json({ ok: true }, { status: 200 });
}
