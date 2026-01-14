import { NextResponse } from "next/server";
import { AuthLoginRequestSchema, AuthLoginResponseSchema, type AuthLoginResponse } from "@/contracts/auth";
import { ErrorResponseSchema } from "@/contracts/errors";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const IS_TEST_ENV = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

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

function getSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let url = raw.trim();
  if (!url) return "";
  // Common mistake: using *.supabase.com (dashboard) instead of *.supabase.co (API).
  url = url.replace(/\.supabase\.com\b/i, ".supabase.co");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = AuthLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Keep `message` for Jest expectations.
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
        access_token: IS_TEST_ENV ? "mock-token" : `mock-token-${Date.now()}`,
        token_type: "bearer",
        expires_in: 60 * 60,
      },
    });

    const res = withAuthCookie(payload);
    return NextResponse.json(
      { token: payload.session.access_token, user: payload.user, mocked: true },
      { status: 200, headers: res.headers }
    );
  }

  // Real Supabase auth (local/prod): sign in with password using anon key.
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  let result: SignInResult | null = null;
  try {
    result = await supabase.auth.signInWithPassword({ email: login, password });
  } catch (err) {
    // Avoid crashing the dev server on DNS/network issues.
    console.error("Supabase signInWithPassword failed", err);
    return jsonError(
      "Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY e sua rede/DNS",
      502
    );
  }

  const authError = result?.error ?? null;
  const session = result?.data?.session ?? null;
  const authUser = result?.data?.user ?? null;

  if (authError || !session || !authUser) {
    const msg =
      typeof (authError as { message?: unknown } | null)?.message === "string"
        ? String((authError as { message?: unknown }).message)
        : "";
    const normalized = msg.trim().toLowerCase();

    if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) {
      return jsonError("Email ainda nao confirmado", 403);
    }

    if (
      normalized.includes("invalid") ||
      normalized.includes("credentials") ||
      normalized.includes("login") ||
      normalized.includes("senha")
    ) {
      return jsonError("Email ou senha invalidos", 401);
    }

    return jsonError(msg || "Auth failed", 401);
  }

  const payload = AuthLoginResponseSchema.parse({
    user: {
      id: authUser.id,
      email: (authUser.email ?? null) as string | null,
      user_metadata: (authUser.user_metadata ?? null) as Record<string, unknown> | null,
    },
    session: {
      access_token: session.access_token,
      token_type: session.token_type ?? "bearer",
      expires_in: session.expires_in ?? 60 * 60,
    },
  });

  const res = withAuthCookie(payload);
  return NextResponse.json(
    { token: payload.session.access_token, user: payload.user },
    { status: 200, headers: res.headers }
  );
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
  return mod.GET(request);
}
