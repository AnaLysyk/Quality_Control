import { NextResponse } from "next/server";

export async function POST(request: Request) {
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
    });

    return response;
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set("auth", adminUser, {
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 horas
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
