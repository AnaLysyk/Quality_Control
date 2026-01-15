import { AuthLoginRequestSchema, AuthLoginResponseSchema } from "@/contracts/auth";
import { createClient } from "@supabase/supabase-js";
import { apiFail, apiOk } from "@/lib/apiResponse";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const IS_TEST_ENV = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;

// Note: keep this route side-effect free for tests (no DB calls).

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
    const msg = "Email e senha sao obrigatorios";
    return apiFail(request, msg, {
      status: 400,
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
      extra: { message: msg },
    });
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

    const res = apiOk(
      request,
      { token: payload.session.access_token, user: payload.user },
      "Login realizado",
      { extra: { token: payload.session.access_token, user: payload.user, mocked: true } },
    );
    res.cookies.set("auth_token", payload.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: payload.session.expires_in,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  // Real Supabase auth (local/prod): sign in with password using anon key.
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return apiFail(request, "Supabase nao configurado", {
      status: 500,
      code: "ENV_MISSING",
      details: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      extra: { error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  let result: SignInResult | null = null;
  try {
    result = await supabase.auth.signInWithPassword({ email: login, password });
  } catch (err) {
    // Avoid crashing the dev server on DNS/network issues.
    console.error("Supabase signInWithPassword failed", err);
    return apiFail(request, "Falha ao conectar no Supabase", {
      status: 502,
      code: "SUPABASE_NETWORK",
      details: err instanceof Error ? err.message : err,
      extra: {
        error:
          "Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY e sua rede/DNS",
      },
    });
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
      return apiFail(request, "Email ainda nao confirmado", {
        status: 403,
        code: "AUTH_EMAIL_NOT_CONFIRMED",
        details: msg,
        extra: { error: "Email ainda nao confirmado" },
      });
    }

    if (
      normalized.includes("invalid") ||
      normalized.includes("credentials") ||
      normalized.includes("login") ||
      normalized.includes("senha")
    ) {
      return apiFail(request, "Email ou senha invalidos", {
        status: 401,
        code: "AUTH_INVALID",
        details: msg,
        extra: { error: "Email ou senha invalidos" },
      });
    }

    return apiFail(request, msg || "Auth failed", {
      status: 401,
      code: "AUTH_FAILED",
      details: msg,
      extra: { error: msg || "Auth failed" },
    });
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

  const res = apiOk(
    request,
    { token: payload.session.access_token, user: payload.user },
    "Login realizado",
    { extra: { token: payload.session.access_token, user: payload.user } },
  );
  res.cookies.set("auth_token", payload.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: payload.session.expires_in,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

// Re-export GET from the /api/me handler so tests that import GET from
// this file continue to work (some tests expect GET to live here).
export async function GET(request: Request) {
  if (SUPABASE_MOCK) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    const token = match?.[1] ?? null;
    if (!token) {
      return apiFail(request, "Nao autenticado", {
        status: 401,
        code: "NO_TOKEN",
        extra: { user: null },
      });
    }

    const user = { id: "mock-uid", email: "ana.testing.company@gmail.com", name: "Usuario Mock" };
    return apiOk(request, { user }, "OK", { extra: { user } });
  }

  const mod = await import("../../me/route");
  return mod.GET(request);
}
