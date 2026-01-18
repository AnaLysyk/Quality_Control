import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const MOCK_PASSWORD = "senha";
const MOCK_EMAILS = new Set(["admin@example.com", "user@example.com"]);

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

// Validação real no banco
async function validateUser(
  email: string,
  password: string,
  cookieHeader: string | null = null
) {
  if (SUPABASE_MOCK) {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !MOCK_EMAILS.has(normalizedEmail)) {
      return null;
    }

    if (password !== MOCK_PASSWORD) {
      return null;
    }

    const mockRole = (readCookieValue(cookieHeader, "mock_role") ?? "admin")
      .trim()
      .toLowerCase();
    const mockSlug = (readCookieValue(cookieHeader, "mock_client_slug") ?? "griaule").trim();
    const companySlug = mockSlug || "griaule";
    const role = mockRole === "admin" ? "admin" : "user";

    return {
      userId: `${role}-mock-${companySlug}`,
      email: normalizedEmail,
      name: role === "admin" ? "Mock Admin" : "Mock User",
      companyId: `mock-company-${companySlug}`,
      companySlug,
      role,
    };
  }

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
    return null;
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

  const cookieHeader = req.headers.get("cookie") ?? null;
  const user = await validateUser(email, password, cookieHeader);
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
