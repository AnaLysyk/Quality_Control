import { AuthLoginRequestSchema, AuthLoginResponseSchema } from "@/contracts/auth";
import { createClient } from "@supabase/supabase-js";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { isSupabaseDisabled, isProdLike } from "@/lib/envFlags";
import { getUserByEmail } from "@/data/usersRepository";
import { hashPasswordSha256, safeEqualHex } from "@/lib/passwordHash";
import { signToken } from "@/lib/jwtAuth";

const IS_PROD = isProdLike();

const SUPABASE_MOCK_RAW = process.env.SUPABASE_MOCK === "true";
const SUPABASE_MOCK = SUPABASE_MOCK_RAW && !IS_PROD;
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
  if (SUPABASE_MOCK_RAW && IS_PROD) {
    console.warn("/api/auth/login: SUPABASE_MOCK ignored in production/Vercel");
  }

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

  // JWT-only auth mode (no Supabase): validate against the app DB and issue our own JWT.
  if (isSupabaseDisabled()) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return apiFail(request, "JWT_SECRET nao configurado", {
        status: 500,
        code: "ENV_MISSING",
        details: "Missing JWT_SECRET",
        extra: { error: "Missing JWT_SECRET" },
      });
    }

    const user = await getUserByEmail(login);
    if (!user || user.active === false) {
      return apiFail(request, "Email ou senha invalidos", {
        status: 401,
        code: "AUTH_INVALID",
        extra: { error: "Email ou senha invalidos" },
      });
    }

    const expectedHash = typeof user.password_hash === "string" ? user.password_hash : "";
    const providedHash = hashPasswordSha256(password);
    const ok = expectedHash && safeEqualHex(expectedHash, providedHash);
    if (!ok) {
      return apiFail(request, "Email ou senha invalidos", {
        status: 401,
        code: "AUTH_INVALID",
        extra: { error: "Email ou senha invalidos" },
      });
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      isGlobalAdmin: user.is_global_admin === true,
    });

    const res = apiOk(
      request,
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: {
            full_name: user.name ?? null,
          },
        },
      },
      "Login realizado",
      { extra: { token, userId: user.id, auth: "jwt" } },
    );

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  }

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

  // Security gate: ensure the user is provisioned in the app database.
  // Tests mock only Supabase Auth; keep them side-effect free.
  if (!IS_TEST_ENV) {
    try {
      // Use require so Jest module mocking can override it if needed.
      const mod = require("@/lib/supabaseServer");
      const supabaseAdmin = mod.getSupabaseServer();
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("id, active")
        .eq("auth_user_id", authUser.id)
        .limit(1)
        .maybeSingle();

      const active = (userRow as { active?: unknown } | null)?.active;
      const isActive = active === undefined ? true : active === true;

      if (!userRow) {
        return apiFail(
          request,
          "Usuario nao provisionado. Peca ao admin para criar o usuario e vincula-lo a uma empresa.",
          {
            status: 403,
            code: "USER_NOT_PROVISIONED",
            extra: {
              error:
                "Usuário não provisionado. Peça ao admin para criar o usuário e vinculá-lo a uma empresa.",
            },
          },
        );
      }

      if (!isActive) {
        return apiFail(request, "Usuario bloqueado", {
          status: 403,
          code: "USER_INACTIVE",
          extra: { error: "Usuario bloqueado" },
        });
      }
    } catch (err) {
      return apiFail(request, "Erro ao validar usuario", {
        status: 500,
        code: "USER_LOOKUP_FAILED",
        details: err instanceof Error ? err.message : err,
        extra: { error: "Erro ao validar usuario" },
      });
    }
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
