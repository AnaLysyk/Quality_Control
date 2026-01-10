import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuthLoginRequestSchema, AuthLoginResponseSchema, type AuthLoginResponse } from "@/contracts/auth";
import { ErrorResponseSchema } from "@/contracts/errors";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const jsonError = (message: string, status: number) =>
  NextResponse.json(ErrorResponseSchema.parse({ error: message }), { status });

function makeAuthResponse(token: string, user: { id: string; email: string }) {
  const headers = new Headers({ "Content-Type": "application/json" });
  // set-cookie header expected by tests
  headers.set("set-cookie", `auth_token=${token}; Path=/; HttpOnly`);
  const body = JSON.stringify({ token, user });
  return new Response(body, { status: 200, headers });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = AuthLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid payload", 400);
  }

  const { login, password } = parsed.data;

  if (SUPABASE_MOCK) {
    const token = "mock-token";
    const user = { id: "mock-uid", email: login };
    return makeAuthResponse(token, user);
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

export async function GET(request: Request) {
  if (SUPABASE_MOCK) {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/auth_token=([^;]+)/);
    if (match?.[1] === "mock-token") {
      const user = { id: "mock-uid", email: "ana.testing.company@gmail.com" };
      return new Response(JSON.stringify({ user }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(null, { status: 401 });
  }

  // Non-mock behavior: delegate to /api/me route if needed
  return new Response(null, { status: 501 });
}
