import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";

// Validação real no banco
async function validateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userCompanies: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user || !user.active) {
    return null;
  }

  const hashedInput = hashPasswordSha256(password);
  if (hashedInput !== user.password_hash) {
    return null;
  }

  // Assumir primeira empresa como ativa (pode ser melhorado depois)
  const activeCompany = user.userCompanies[0];
  if (!activeCompany) {
    return null; // Usuário sem empresa
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: activeCompany.company.id,
    companySlug: activeCompany.company.slug,
    role: activeCompany.role,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha obrigatórios" },
      { status: 400 }
    );
  }

  const user = await validateUser(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Credenciais inválidas" },
      { status: 401 }
    );
  }

  const sessionId = randomUUID();
  const redis = getRedis();

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(user),
    { ex: 60 * 60 * 8 } // 8 horas
  );

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return res;
}
