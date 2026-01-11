import { NextResponse } from "next/server";
import { AuthLoginRequestSchema, AuthLoginResponseSchema, type AuthLoginResponse } from "@/contracts/auth";
import { ErrorResponseSchema } from "@/contracts/errors";
import { getUserByEmail } from "@/data/usersRepository";
import { signToken } from "@/lib/jwtAuth";
import crypto from "crypto";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

// Note: this route uses local `usersRepository` for auth; do not create
// a Supabase client here to avoid accidental network calls in tests.

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

function withAuthCookie(payload: AuthLoginResponse) {
  const response = NextResponse.json(payload, { status: 200 });
  response.cookies.set("auth_token", payload.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: payload.session.expires_in,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = AuthLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Email e senha sao obrigatorios" }, { status: 400 });
  }

  const { login, password } = parsed.data;

  if (SUPABASE_MOCK) {
    const payload = AuthLoginResponseSchema.parse({
      user: {
        id: "mock-uid",
        email: login,
        user_metadata: {
          full_name: "Usuario Mock",
        },
      },
      session: {
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 60 * 60,
      },
    });

    // Return token + user to satisfy tests that expect `token` top-level
    const res = withAuthCookie(payload);
    // Overwrite body to include `token` and `user` fields for tests
    return NextResponse.json({ token: payload.session.access_token, user: payload.user }, { status: 200, headers: res.headers });
  }

  // Use local users repository for auth in tests and service mode.
  const user = await getUserByEmail(login);
  if (!user || !user.active) return jsonError("Auth failed", 401);

  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (!user.password_hash || user.password_hash !== hash) return jsonError("Auth failed", 401);

  // Issue JWT for application auth flows
  const token = signToken({ sub: user.id, email: user.email, isGlobalAdmin: !!user.is_global_admin });
  const payload = AuthLoginResponseSchema.parse({
    user: { id: user.id ?? "", email: user.email ?? "", user_metadata: null },
    session: { access_token: token, token_type: "bearer", expires_in: 60 * 60 },
  });

  const res = withAuthCookie(payload);
  return NextResponse.json({ token, user: { id: user.id, email: user.email } }, { status: 200, headers: res.headers });
}

// Re-export GET from the /api/me handler so tests that import GET from
// this file continue to work (some tests expect GET to live here).
export async function GET(request: Request) {
  if (SUPABASE_MOCK) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    const token = match?.[1] ?? null;
    if (!token) return NextResponse.json({ user: null }, { status: 401 });

    return NextResponse.json({ user: { id: "mock-uid", email: "ana.testing.company@gmail.com", name: "Usuario Mock" } }, { status: 200 });
  }

  const mod = await import("../../me/route");
  return mod.GET(request as any);
}
