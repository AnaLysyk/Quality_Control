import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!token || !newPassword) {
    return NextResponse.json(
      { error: "Token e nova senha obrigatórios" },
      { status: 400 }
    );
  }

  const redis = getRedis();

  // Buscar userId pelo token
  const userId = await redis.get<string>(`reset:${token}`);
  if (!userId) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 400 }
    );
  }

  // Hash da nova senha
  const hashedPassword = hashPasswordSha256(newPassword);

  // Atualizar senha no banco
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: hashedPassword },
  });

  // Deletar token do Redis
  await redis.del(`reset:${token}`);

  return NextResponse.json({ ok: true });
}
