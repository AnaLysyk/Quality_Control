import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

type SessionUser = {
  userId?: string;
  id?: string;
  role?: string;
  isGlobalAdmin?: boolean;
};

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

async function resolveSession(req: NextRequest): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (sessionId) {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return parsed as SessionUser;
      } catch {
        return null;
      }
    }
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
  const cookieToken = readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub?: string;
      role?: string;
      isGlobalAdmin?: boolean;
    };
    return {
      userId: typeof payload.sub === "string" ? payload.sub : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      isGlobalAdmin: payload.isGlobalAdmin === true,
    };
  } catch {
    return null;
  }
}

function isAdminRole(role?: string | null, isGlobal?: boolean) {
  if (isGlobal) return true;
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "global_admin" || normalized === "super-admin";
}

function mapLink(link: { user: { id: string; email: string; name: string; active: boolean }; role: string }) {
  return {
    id: link.user.id,
    role: (link.role ?? "user").toLowerCase() === "admin" ? "ADMIN" : "USER",
    active: link.user.active === true,
    name: link.user.name ?? "",
    email: link.user.email,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await resolveSession(req);
  if (!session?.userId && !session?.id) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const userId = session.userId ?? session.id!;
  const isAdmin = isAdminRole(session.role, session.isGlobalAdmin);
  const { searchParams } = new URL(req.url);
  const requestAll = searchParams.get("all") === "true";
  if (requestAll && !isAdmin) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const { id: companyId } = await context.params;
  const where = requestAll && isAdmin
    ? { company_id: companyId }
    : { company_id: companyId, user_id: userId };

  const links = await prisma.userCompany.findMany({
    where,
    include: { user: true },
  });

  return NextResponse.json({ items: links.map(mapLink) }, { status: 200 });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" && body.role.toUpperCase() === "ADMIN" ? "admin" : "user";
  if (!email) {
    return NextResponse.json({ message: "Email obrigatorio" }, { status: 400 });
  }

  const { id: companyId } = await context.params;
  const existing = await prisma.userCompany.findFirst({
    where: { company_id: companyId, user: { email } },
    include: { user: true },
  });
  if (existing) {
    return NextResponse.json({ message: "Usuario ja vinculado" }, { status: 409 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = hashPasswordSha256(`${Date.now()}-${email}`);
    user = await prisma.user.create({
      data: {
        email,
        name: "",
        password_hash: tempPassword,
        active: true,
      },
    });
  }

  await prisma.userCompany.create({
    data: {
      user_id: user.id,
      company_id: companyId,
      role,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ message: "userId obrigatorio" }, { status: 400 });
  }

  const { id: companyId } = await context.params;
  const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;
  const active = typeof body?.active === "boolean" ? body.active : null;

  if (active === false) {
    await prisma.userCompany.delete({
      where: { user_id_company_id: { user_id: userId, company_id: companyId } },
    }).catch(() => null);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const data: { role?: string } = {};
  if (role) {
    data.role = role === "ADMIN" ? "admin" : "user";
  }

  const updated = await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: userId, company_id: companyId } },
    update: data,
    create: { user_id: userId, company_id: companyId, role: data.role ?? "user" },
  });

  return NextResponse.json({ ok: true, role: updated.role }, { status: 200 });
}
