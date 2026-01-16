import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { email } = body ?? {};

  if (!email) {
    return NextResponse.json(
      { error: "Email obrigatório" },
      { status: 400 }
    );
  }

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Não revelar se email existe ou não, por segurança
    return NextResponse.json({ ok: true });
  }

  // Gerar token
  const token = randomUUID();
  const redis = getRedis();

  // Salvar token no Redis com TTL de 15 minutos
  await redis.set(
    `reset:${token}`,
    user.id,
    { ex: 15 * 60 } // 15 minutos
  );

  // Enviar email de reset
  const emailSent = await emailService.sendPasswordResetEmail(email, token);

  if (!emailSent) {
    console.error("Failed to send reset email to:", email);
    // Ainda retorna sucesso por segurança (não revelar falhas de email)
  }

  return NextResponse.json({ ok: true });
}