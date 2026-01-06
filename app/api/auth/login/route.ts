import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuthLoginRequestSchema, AuthLoginResponseSchema, type AuthLoginResponse } from "@/contracts/auth";
import { ErrorResponseSchema } from "@/contracts/errors";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

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
    return jsonError("Invalid payload", 400);
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

    return withAuthCookie(payload);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonError("Supabase URL/KEY not configured", 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({ email: login, password });

  if (error) {
    return jsonError(error.message, 401);
  }

  if (!data.user || !data.session) {
    return jsonError("Auth failed", 401);
  }

  const payload = AuthLoginResponseSchema.parse({
    user: {
      id: data.user.id,
      email: data.user.email ?? login,
      user_metadata: data.user.user_metadata ?? null,
    },
    session: {
      access_token: data.session.access_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
    },
  });

  return withAuthCookie(payload);
}
