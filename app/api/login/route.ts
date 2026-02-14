import { NextResponse } from "next/server";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const secureCookies = shouldUseSecureCookies(request);
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProd) {
    const r = NextResponse.json(
      { error: "Rota desativada. Use /api/auth/login." },
      { status: 410 }
    );
    r.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });
    return r;
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { user, password } = body ?? {};

  if (!user || !password) {
    const r = NextResponse.json(
      { error: "Credenciais obrigatórias" },
      { status: 400 }
    );
    r.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });
    return r;
  }

  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (user !== adminUser || password !== adminPassword) {
    const r = NextResponse.json(
      { error: "Credenciais inválidas" },
      { status: 401 }
    );
    r.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });
    return r;
  }

  const r = NextResponse.json({ ok: true });

  r.cookies.set("auth", adminUser, {
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 horas
    path: "/",
    sameSite: "lax",
    secure: secureCookies,
  });

  return r;
}
