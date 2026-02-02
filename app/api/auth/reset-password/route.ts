import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { updateLocalUser } from "@/lib/auth/localStore";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token e nova senha obrigatorios" }, { status: 400 });
  }

  const redis = getRedis();
  const userId = await redis.get<string>(`reset:${token}`);
  if (!userId) {
    return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
  }

  const hashedPassword = hashPasswordSha256(newPassword);
  await updateLocalUser(userId, { password_hash: hashedPassword });
  await redis.del(`reset:${token}`);

  return NextResponse.json({ ok: true });
}
