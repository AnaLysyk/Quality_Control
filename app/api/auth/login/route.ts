import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { prisma, isPrismaConfigured } from "@/lib/prismaClient";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { getRedis } from "@/lib/redis";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

function setCookie(res: NextResponse, name: string, value: string, maxAgeSeconds: number) {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

function buildAuthToken(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(payload, secret, { expiresIn: `${SESSION_TTL_SECONDS}s` });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 });
  }

  if (!isPrismaConfigured()) {
    return NextResponse.json(
      { error: "Banco nao configurado (defina DATABASE_URL)" },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { userCompanies: { include: { company: true } } },
  });

  if (!user || !user.active) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  const hashedInput = hashPasswordSha256(password);
  if (hashedInput !== user.password_hash) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  const activeCompany = user.userCompanies[0];
  if (!activeCompany) {
    return NextResponse.json({ error: "Usuario sem empresa vinculada" }, { status: 403 });
  }

  const sessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: activeCompany.company.id,
    companySlug: activeCompany.company.slug,
    role: activeCompany.role,
    isGlobalAdmin: false,
  };

  const sessionId = randomUUID();
  const redis = getRedis();
  await redis.set(`session:${sessionId}`, JSON.stringify(sessionPayload), { ex: SESSION_TTL_SECONDS });

  const res = NextResponse.json({ ok: true });
  setCookie(res, "session_id", sessionId, SESSION_TTL_SECONDS);

  const authToken = buildAuthToken({
    sub: user.id,
    email: user.email,
    role: activeCompany.role,
    companyId: activeCompany.company.id,
    companySlug: activeCompany.company.slug,
    isGlobalAdmin: false,
  });
  if (authToken) {
    setCookie(res, "auth_token", authToken, SESSION_TTL_SECONDS);
  }

  return res;
}
