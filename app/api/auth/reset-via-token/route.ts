import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prismaClient";
import { hashPasswordSha256 } from "@/lib/passwordHash";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!token || !newPassword) {
    return NextResponse.json(
      { error: "Token e nova senha são obrigatórios" },
      { status: 400 }
    );
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 8 caracteres" },
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

  try {
    // Hash da nova senha
    const hashedPassword = hashPasswordSha256(newPassword);

    // Atualizar senha no banco (campo correto: password_hash)
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    // Remover token usado
    await redis.del(`reset:${token}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
