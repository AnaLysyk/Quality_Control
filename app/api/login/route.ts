import { NextResponse } from "next/server";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const secureCookies = shouldUseSecureCookies(request);
  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || typeof process.env.VERCEL_ENV === "string";
  if (isProd) {
    const response = NextResponse.json(
      { error: "Rota desativada. Use /api/auth/login." },
      { status: 410 },
    );
    response.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });
    return response;
  }

  const { user, password } = await request.json();

  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!user || !password) {
    const response = NextResponse.json(
      { error: "Login e senha são obrigatórios" },
      { status: 400 }
    );

    response.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });

    return response;
  }

  if (user !== adminUser || password !== adminPassword) {
    const response = NextResponse.json(
      { error: "Senha incorreta" },
      { status: 401 }
    );

    response.cookies.set("auth", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookies,
    });

    return response;
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set("auth", adminUser, {
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 horas
    path: "/",
    sameSite: "lax",
    secure: secureCookies,
  });

  return response;
}
