import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

type SessionUser = {
  userId?: string;
  id?: string;
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

async function resolveUserId(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (sessionId) {
    const redis = getRedis();
    const raw = await redis.get<string>(`session:${sessionId}`);
    if (raw) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const session = parsed as SessionUser;
        return session.userId ?? session.id ?? null;
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
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const links = await prisma.userCompany.findMany({
    where: { user_id: userId },
    include: { company: true },
  });

  const items = links.map((link) => ({
    client_id: link.company.id,
    client_name: link.company.name,
    client_slug: link.company.slug,
    client_active: true,
    role: (link.role ?? "user").toUpperCase() === "ADMIN" ? "ADMIN" : "USER",
    link_active: true,
  }));

  return NextResponse.json({ items });
}
